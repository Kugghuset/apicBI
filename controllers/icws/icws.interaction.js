'use strict'

var _ = require('lodash');
var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var loki = require('lokijs');

var icwsSub = require('./icws.sub');
var icws = require('../../lib/icwsModule');
var icwsStorage = require('./icws.storage');
var icwsUtils = require('./icws.utils');
var icwsData = require('./icws.data');
var icwsPush = require('./icws.push');
var icwsDb = require('./icws.db');

var config = require('./../../configs/database');
var logger = require('./../../middlehand/logger');

/** @type {LokiCollection<{}>} */
var Interactions = icwsStorage.getCollection('interactions');
var PushedPowerBi = icwsStorage.getCollection('pushedPowerBi');

/**
 * The __types to watch changes for.
 *
 * The keys matches function used for processing the data,
 * and the values matches the __type properties from ININ.
 */
var _typeIds = {
    updateInteractions: 'urn:inin.com:queues:queueContentsMessage',
    updateWorkstations: 'urn:inin.com:configuration.people:workgroupsMessage',
};

/**
 * Enumeration of the various queueTypes
 */
var _queueTypes = {
    system: 0,
    user: 1,
    workgroup: 2,
    station: 3,
}

var __workstations = [];
var __activeInteractions = [];

/**
 * All watcher methods, exactly matching the keys of _typeIds
 * to allow watch(...) to call any only via the key found from _typeIds.
 */
var watchers = {
    updateInteractions: updateInteractions,
    updateWorkstations: updateWorkstations,
}

/**
 * @param {Array} dataArr The array retuerned from polling
 */
function watch(dataArr) {
    // Find all functions to call
    var toCall = _.chain(_typeIds)
        .map(function (__type, key) {
            var _data = _.find(dataArr, function (data) { return _.get(data, '__type') === __type });
            // If there is *_data*, return an object where *key* is the key and *_data* is the value.
            return !_.isUndefined(_data)
                ? _.set({}, key, _data)
                : undefined;
        })
        .filter()
        .reduce(function (obj, current) { return _.assign({}, obj, current); }, {})
        .value();

    // Call every matched watcher
    _.forEach(toCall, function (val, key) {
        // Call the function if it's defined
        if (_.isFunction(watchers[key])) { watchers[key](val); }
    });

    _.forEach(__activeInteractions, updateCalculatedValues);

    icwsData.updateQueueInfo();

    pushChanges();
}

/**
 * @param {Array} dataArr The array retuerned from polling
 */
function updateInteractions(data) {
    // Get all added interactions
    var _added = _.map(data.interactionsAdded, function (interaction) { return _.assign({}, icwsUtils.icws.getInteractionData(interaction), { referenceDate: new Date() }) });

    // Get all changed interactions
    var _changed = _.map(data.interactionsChanged, icwsUtils.icws.getInteractionData);

    // Get all removed interactions
    // NOTE: This is a simple array of ids
    var _removed = _.map(data.interactionsRemoved)

    // Handle added interactions
    if (_.some(_added)) {
        // Add them all
        __activeInteractions = __activeInteractions.concat(_.map(_added, function (interaction) {
            // If there is no queueTime but both queueDate and connectedDate exists, set queueTime
            if (icwsUtils.canCalculateQueueTime(interaction)) {
                interaction.queueTime = icwsUtils.calculateQueueTime(interaction);
                icwsData.updateTimeDiff();
            }

            return interaction;
        }));

        /**
         * Push or update persisted data.
         */
        _.forEach(_added, function (interaction) {
            if (icwsUtils.canCalculateQueueTime(interaction)) {
                interaction.queueTime = icwsUtils.calculateQueueTime(interaction);
                icwsData.updateTimeDiff();
            }

            var _updated = Interactions.findOne({ id: _.toString(interaction.id) });

            if (_.isNull(_updated)) {
                // Insert the interaction as it's a legitimately new one
                // Interactions.insert(interaction);
                storeInteraction(interaction);
            } else {
                // Update the interaction
                _updated = _.assign(_updated, interaction);
                storeInteraction(_updated);
            }
        });
    }

    // Handle changes
    if (_.some(_changed)) {
        _.forEach(_changed, function (interaction) {
            var _interaction = _.find(__activeInteractions, { id: interaction.id });
            // Update the interaction
            if (_interaction) {
                // Get the position of the item
                var _index = _.indexOf(__activeInteractions, _interaction);
                // Merge the objects
                var _updated = _.assign({}, _interaction, interaction);

                // If there is no queueTime but both queueDate and connectedDate exists, set queueTime
                if (icwsUtils.canCalculateQueueTime(_updated)) {
                    _updated.queueTime = icwsUtils.calculateQueueTime(_updated);
                    icwsData.updateTimeDiff();
                }

                // Splice in the updated version instead of the original item
                __activeInteractions.splice(_index, 1, _updated);
            }
        });

        /**
         * Update persisted data.
         */
        _.forEach(_changed, function (interaction) {
            var _updated = Interactions.findOne({ id: _.toString(interaction.id) });

            if (_.isNull(_updated)) {
                logger.log('Failed to find interaction to update', 'info', { interactionId: interaction.id });
                return;
            }

            // If there is no queueTime but both queueDate and connectedDate exists, set queueTime
            if (icwsUtils.canCalculateQueueTime(_updated)) {
                _updated.queueTime = icwsUtils.calculateQueueTime(_updated);
                icwsData.updateTimeDiff();
            }

            if (icwsUtils.isAbandoned(_updated) && !_updated.isAbandoned) {
                // Set isAbandoned
                _updated.isAbandoned = true;
            } else if (icwsUtils.isCompleted(_updated) && !_updated.isAbandoned) {
                // Set isCompleted
                _updated.isCompleted = true;
            }

            // Update the interaction
            _updated = _.assign(_updated, interaction);
            storeInteraction(_updated);
        });
    }

    // Handle removed interactions
    if (_.some(_removed)) {
        var _removedItems = _.remove(__activeInteractions, function (interaction) { return !!~_removed.indexOf(interaction.id); });

        _.forEach(_removed, function (removedId) {
            var _updated = Interactions.findOne({ id: _.toString(removedId) });

            if (_.isNull(_updated)) {
                logger.log('Failed to remove interaction, could not find it', 'info', { interactionId: removedId });
                return;
            }

            // Update the interaction
            _updated.isCurrent = false;
            storeInteraction(_updated);
        });
    }
}

/**
 * @param {Array} dataArr The array retuerned from polling
 */
function updateWorkstations(data) {
    // Get all added workstations
    var _added = _.map(data.added, function (workstation) {
        return {
            id: _.get(workstation, 'configurationId.id'),
            name: _.get(workstation, 'configurationId.displayName'),
            hasQueue: workstation.hasQueue,
            isActive: workstation.isActive,
        };
    });

    // Get all changed workstations
    var _changed = _.map(data.changed, function (workstation) {
        return {
            id: _.get(workstation, 'configurationId.id'),
            name: _.get(workstation, 'configurationId.displayName'),
            hasQueue: workstation.hasQueue,
            isActive: workstation.isActive,
        };
    });

    // Get all removed workstations
    var _removed = _.map(data.removed, function (workstation) { return _.get(workstation, 'configurationId.id'); });

    if (_.some([_added, _changed, _removed]), _.some) {
        // Update _workStations
        __workstations = _.chain(__workstations)
            // Filter out removed workstations
            .filter(function (workstation) { return !!~_removed.indexOf(workstation); })
            // Filter out any modified workstations
            .filter(function (workstation) { return !_.find(_changed, { id: workstation.id }); })
            // Get the complete list of workstations
            .thru(function (workstations) { return workstations.concat(_added, _changed); })
            .value();

        logger.log('Workstations updated', 'info', { workstationCount: __workstations.length });

        // Get the ids to added workstations, if any, subscribe to their queues
        var _addedIds = _.map(_added, 'id');
        if (_.some(_addedIds)) {
            queueSub('subscribe', config.icws_sub_id, _addedIds);
        }

        // If removed, unsubscribe
        if (_.some(_removed)) {
            queueSub('unsubscribe', _removed);
        }
    }
}

/**
 * Updates *interaction* with the following properties:
 * - inQueue (boolean value of whether the *interaction* is in queue or not.)
 * - correctedQueueTime (calculated time diff between queueDate and Date.now or the actual queueTime (connectedDate - queueDate))
 * - localQueueTime (calculated between queueDate and now)
 *
 * @param {Object} interaction The interaction object to get values from
 * @param {Number} index Index of the interaction
 */
function updateCalculatedValues(interaction, index) {
    // Create a variable for correctedQueueTime to be used.
    var _correctedQueueTime;
    var _localQueueTime;

    // Get the persisted interaction
    var _storedInteraction = Interactions.findOne({ id: _.toString(interaction.id) });

    // Set inQueue, isAbandoned, isCompleted
    interaction = icwsUtils.updateQueueState(interaction);

    // Set correctedQueueTime to either the time diff returned form getInteractionQueueTime or the actual queueTime.
    if (interaction.inQueue) {
        _correctedQueueTime = icwsData.getInteractionQueueTime(interaction, true);
        _localQueueTime = icwsData.getInteractionQueueTime(interaction, false);
    } else {
        _correctedQueueTime = interaction.queueTime || 0;
        _localQueueTime = _storedInteraction.localQueueTime || interaction.localQueueTime;
    }

    // Update the activeTime
    var _updated = _.assign(interaction, { correctedQueueTime: _correctedQueueTime, localQueueTime: _localQueueTime });

    // If localQueueTime (calculated queueTime) is undefined and the *interaction* is not in queue, set localQueueTime to null.
    if (_.isUndefined(_updated.localQueueTime) && !_updated.inQueue) {
        _updated.localQueueTime = null;
    }

    // Replace the item in the list.
    __activeInteractions.splice(index, 1, _updated);

    var _isUpdated = !icwsUtils.objectEquals(_storedInteraction,  _.assign({}, _storedInteraction, _updated));

    // If there's been an update and there's an object in the DB, push it.
    if (_storedInteraction && _isUpdated) {
        _storedInteraction = _.assign(_storedInteraction, _updated);
        storeInteraction(_storedInteraction);
    }
}

/**
 * Stores to DB (either inserts or updates) and,
 * if finished and not pushed, pushes to Power BI.
 *
 * @param {{ id: String, $loki: Number, ... }} interaction
 */
function storeInteraction(interaction) {
    if (!_.isUndefined(interaction.$loki)) {
        Interactions.update(interaction);
    } else {
        Interactions.insert(interaction);
    }

    if (icwsUtils.isFinished(interaction) && !icwsPush.isPushed(interaction.id)) {
        // Push it to power BI
        PushedPowerBi.insert({ id: interaction.id, dateAdded: Date.now(), isPushed: false });
        icwsPush.currentToPowerBi(interaction)
        .then(function (data) { /** Do something? */ })
        .catch(function (err) {
            // Must be caught, otherwise it might break stuff.
            logger.log('Failed to push data to PowerBI', 'error', { error: _.isError(err) ? err.toString() : err });
        });
    }
}

/**
 * Pushes any changes to the RethinkDB instance.
 */
function pushChanges() {
    _.chain(Interactions.getChanges())
        // Group by id to filter out objects with multiple updates
        .groupBy('obj.id')
        // Get only one of the objects
        .map(function (items) {
            // If there's only a single object, return it
            if (items.count === 1) {
                return items[0];
            }

            // Return either the deleted item or the first item.
            return _.some(items, { operation: 'R' })
                ? _.find(items, { operation: 'R' })
                : items[0];
        })
        .forEach(function (item) {
            // If the interaction was removed, disable it in the DB.
            // Otherwise find it and update or insert it
            var _interaction = item.operation !== 'R'
                ? Interactions.findOne({ id: item.obj.id })
                : _.assign({}, item.obj, { isDisabled: true });

            icwsDb.setInteraction(_interaction, true);
        })
        .value();

    // Clear the changes for Interactions
    Interactions.flushChanges();
}

/*********************
 * ICWS subscriptions
 *********************/

/**
 * Subscribes or unsubscribes to workstations which are 'CSA'
 * with the subscription id *subId*.
 *
 * @param {String} action The action to run
 * @param {String} subId Defaults to config.icws_sub_id
 * @return {Promise}
 */
function workStationSub(action, subId) {
    subId = !_.isUndefined(subId)
        ? subId
        : config.icws_sub_id;

    var path = 'messaging/subscriptions/configuration/workgroups/:id'
        .replace(':id', subId)

    return /unsub/i.test(action)
        ? icwsSub.unsubscribe(path)
        : icwsSub.subscribe(path, {
            configurationIds: [
                '*',
                'CSA',
            ],
            properties: [
                'hasQueue',
                'isActive',
                'isWrapUpActive',
                'isCallbackEnabled',
                'isAcdEmailRoutingActive',
                'queueType',
            ],
            rightsFilter: 'view'
        });
}

/**
 * Subscribes to all queus for *workstations*
 *
 * @param {String} action Should be either 'subscribe' or 'unsubscribe'
 * @param {String|Number} subId
 * @param {Array} workstations The workstation ids (firstname.lastname) to listen for.
 * @return {Promise}
 */
function queueSub(action, subId, workstations) {
    // Use default value of subId if undefined
    subId = !_.isUndefined(subId)
        ? subId
        : config.icws_sub_id;

    // Get all queueIds to subscribe to
    var _queueIds = _.chain(workstations)
        .map(function (workstation) { return { queueType: _queueTypes.workgroup, queueName: (workstation.id || workstation) }; })
        .filter(function (item) {
            // Filter out any not of interest workstations
            return !!~[
                'CSA',
                'Partner Service',
            ].indexOf(item.queueName);
        })
        // .uniqBy('queueType')
        .value();

    var _subPath = 'messaging/subscriptions/queues/:id'
        .replace(':id', subId)

    logger.log('Subscribing to new queues!', 'info', { queueCount: _queueIds.length });

    var _options = {
        queueIds: _queueIds,
        attributeNames: [
            'Eic_WorkgroupName',
            'Eic_InitiationTime',
            'Eic_TerminationTime',
            'Eic_AnswerTime',
            'Eic_ConnectTime',
            'Eic_LineQueueTimestamp',
            'Eic_CallId',
            'Eic_RemoteAddress',
            'Eic_RemoteId',
            'Eic_RemoteName',
            'Eic_UserName',
            'Eic_CallDirection',
            'Eic_ObjectType',
            'Eic_CallType',
            'Eic_State',
            'Eic_ConnectDurationTime',
        ],
        rightsFilter: 'view',
    };

    return /unsub/i.test(action)
        ? icwsSub.unsubscribe(_subPath)
        : icwsSub.subscribe(_subPath, _options);
}

/**
 * Sets the workgroup subscriptions up.
 *
 * @param {String} subId Subscription ID string, defaults ot config.icws_sub_id
 * @return {Promise}
 */
function setup(subId) {
  // Use default value of subId if undefined
    subId = !_.isUndefined(subId)
        ? subId
        : config.icws_sub_id;

    Interactions = icwsStorage.getCollection('interactions');
    PushedPowerBi = icwsStorage.getCollection('pushedPowerBi');

    return workStationSub('subscribe', subId);
}

module.exports = {
    watch: watch,
    setup: setup,
}
