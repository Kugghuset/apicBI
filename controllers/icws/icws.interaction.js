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

/** @type {LokiCollection<{}>} */
var Interactions = icwsStorage.getCollection('interactions');

/** @type {LokiDynamicView<T>} */
var TimeDiffView = icwsStorage.getView(Interactions, 'timeDiffView', initTimeDiffView);

/** @type {LokiDynamicView<T>} */
var DailyInteractionView = icwsStorage.getView(Interactions, 'dailyInteractionView', initDailyInteractionView)

/** @type {LokiDynamicView<T>} */
var WeeklyInteractionView = icwsStorage.getView(Interactions, 'weeklyInteractionView', initWeeklyInteractionView)

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
 * The differance in seconds in comparison to the server.
 *
 * @type {Number}
 */
var __localTimeDiff = null;

/**
 * Object containing information about the queues.
 *
 * @type { csa: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, partnerService: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number } }
 */
var __queueInfo = {
    csa: { queueTime: 0, id: null, queueLength: 0, abandonedLength: 0, completedLength: 0, abandonRate: 0 },
    partnerService: { queueTime: 0, id: null, queueLength: 0, abandonedLength: 0, completedLength: 0, abandonRate: 0 },
};

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

    updateQueueInfo();
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
            }

            return interaction;
        }));

        /**
         * Push or update persisted data.
         */
        _.forEach(_added, function (interaction) {
            if (icwsUtils.canCalculateQueueTime(interaction)) {
                interaction.queueTime = icwsUtils.calculateQueueTime(interaction);
            }

            var _updated = Interactions.findOne({ id: _.toString(interaction.id) });

            if (_.isNull(_updated)) {
                // Insert the interaction as it's a legitimately new one
                Interactions.insert(interaction);
            } else {
                // Update the interaction
                _updated = _.assign(_updated, interaction);
                Interactions.update(_updated);
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
                console.log('Failed to find interaction to update: ' + interaction.id);
                return;
            }

            // If there is no queueTime but both queueDate and connectedDate exists, set queueTime
            if (icwsUtils.canCalculateQueueTime(_updated)) {
                _updated.queueTime = icwsUtils.calculateQueueTime(_updated);
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
            Interactions.update(_updated);
        });
    }

    // Handle removed interactions
    if (_.some(_removed)) {
        var _removedItems = _.remove(__activeInteractions, function (interaction) { return !!~_removed.indexOf(interaction.id); });

        _.forEach(_removed, function (removedId) {
            var _updated = Interactions.findOne({ id: _.toString(removedId) });

            if (_.isNull(_updated)) {
                console.log('Failed to remove interaction, could not find it: ' + removedId);
                return;
            }

            // Update the interaction
            _updated.isCurrent = false;
            Interactions.update(_updated);
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

        console.log('There are now {num} workstations!'.replace('{num}', __workstations.length));

        // Get the ids to added workstations, if any, subscribe to their queues
        var _addedIds = _.map(_added, 'id');
        if (_.some(_addedIds)) {
            queueSub('subscribe', 'kugghuset-1', _addedIds);
        }

        // If removed, unsubscribe
        if (_.some(_removed)) {
            queueSub('unsubscribe', _removed);
        }
    }
}

/**
 * @param {String} granularity
 * @return {Number}
 */
function getGlobalTimeDiff() {
    var _diffs = TimeDiffView
        .data()
        .reduce(function (arr, item, i) { return arr.length < 10 ? arr.concat([item]) : arr; }, [])
        .sort(icwsUtils.compareQueueDiff)
        .map(function (item) { return item.localQueueTime - item.queueTime });

    if (!_.some(_diffs)) {
        return 0;
    }

    return _.sum(_diffs) / _diffs.length;
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
        _correctedQueueTime = getInteractionQueueTime(interaction, true);
        _localQueueTime = getInteractionQueueTime(interaction, false);
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

    if (_storedInteraction) {
        _storedInteraction = _.assign(_storedInteraction, _updated);
        Interactions.update(_storedInteraction);
    }
}

/**
 * @param {String} workgroupName
 * @param {String} span
 * @return {{ queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number })
 */
function getQueueInfoData(workgroupName, span) {
    return _.chain(Interactions.where(function (item) { return _.every([
        item.isCurrent,
        item.workgroup === workgroupName,
        item.inQueue,
    ])}))
        .map(function (interaction) { return _.assign({}, interaction, { correctedQueueTime: getInteractionQueueTime(interaction, true) }) })
        .orderBy('correctedQueueTime', 'desc')
        .thru(function (interactions) { return _.map(interactions, function (interaction) { return _.assign({}, interaction, { queueLength: interactions.length }); }); })
        .first()
        .thru(function (interaction) {
            return _.isUndefined(interaction)
            ? { id: null, queueTime: 0, queueLength: 0 }
            : { id: interaction.id, queueTime: interaction.correctedQueueTime, queueLength: interaction.queueLength }
        })
        .thru(function (queueInfo) { return _.assign({}, queueInfo, getQueueData(workgroupName, span)); })
        .value();
}

/**
 * Updates the longest queue time and ID.
 * @reuturn {{ daily: csa: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, partnerService: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, weekly: csa: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, partnerService: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number } }}
 */
function updateQueueInfo() {
    __queueInfo = {
        daily: {
            csa: getQueueInfoData('CSA', 'daily'),
            partnerService: getQueueInfoData('Partner Service', 'daily'),
        },
        weekly: {
            csa: getQueueInfoData('CSA', 'weekly'),
            partnerService: getQueueInfoData('Partner Service', 'weekly'),
        },
        timeDiff: __localTimeDiff
    };
    return __queueInfo;
}

/**
 * @param {String} workgroupName
 * @param {String} span
 * @return {{ abandonRate: Number, abandonedLength: Number, completedLength: Number, totalLength: Number }}
 */
function getQueueData(workgroupName, span) {
    // Get all either abandoned or completed items, either from today or this week.
    var _total = (
        span === 'daily'
            ? DailyInteractionView
            : WeeklyInteractionView
        )
        .data()
        .filter(function (interaction) { return interaction.workgroup === workgroupName; });

    // Get only the abandoned items
    var _abandoned = _total.filter(function (item) { return item.isAbandoned; });

    // Get the completed items
    var _completed = _total.filter(function (item) { return item.isCompleted; });

    return {
        abandonRate: ((_abandoned.length / (_total.length || 1)) * 100).toFixed(2),
        abandonedLength: _abandoned.length,
        completedLength: _completed.length,
        totalLength: _total.length,
    }
}

/**
 *
 * @param {{ queueDate: Date }} interaction The interaction object to get values from
 * @param {Boolean} [useGlobalTimeDiff=false] Defaults to false
 * @return {Number}
 */
function getInteractionQueueTime(interaction, useGlobalTimeDiff) {
    useGlobalTimeDiff = _.isUndefined(useGlobalTimeDiff)
        ? false
        : useGlobalTimeDiff;

    __localTimeDiff = getGlobalTimeDiff();

    var _globalTimeDiff = useGlobalTimeDiff
        ? __localTimeDiff // getGlobalTimeDiff()
        : 0;

    return moment(new Date()).diff(interaction.queueDate, 'seconds') - _globalTimeDiff;
}

/****************
 * Subscriptions
 ****************/

/**
 * Subscribes or unsubscribes to workstations which are 'CSA'
 * with the subscription id *subId*.
 *
 * @param {String} action The action to run
 * @param {String} subId Defaults to 'kugghuset-1'
 * @return {Promise}
 */
function workStationSub(action, subId) {
    subId = !_.isUndefined(subId)
        ? subId
        : 'kugghuset-1';

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
        : 'kugghuset-1';

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

    console.log('Subscribing to {num} queue(s)!'.replace('{num}', _queueIds.length));

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
 * Initializes the TimeDiffView with items only from the last week,
 * items not in queue and where there is a localQueueTime and queueTime
 * and sorts them in reverse as to their natural order (by '$loki', Loki's ID).
 *
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initTimeDiffView(view) {
    return view
        .applyWhere(function (item) { return moment().subtract(7, 'days').isBefore(item.startDate); })
        .applyWhere(function (item) { return !item.inQueue; })
        .applyWhere(function (item) { return _.every([item.localQueueTime, item.queueTime], _.isNumber); })
        .applySimpleSort('$loki', true)
}

/**
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initDailyInteractionView(view) {
    return view
        .applyWhere(function (item) {
            return _.every([
                icwsUtils.contains(['Partner Service', 'CSA'], item.workgroup),
                icwsUtils.isParsableOrDate(item.endDate),
                icwsUtils.isToday(item),
            ]);
        });
}

/**
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initWeeklyInteractionView(view) {
    return view
        .applyWhere(function (item) {
            return _.every([
                icwsUtils.contains(['Partner Service', 'CSA'], item.workgroup),
                icwsUtils.isParsableOrDate(item.endDate),
                icwsUtils.isThisWeek(item),
            ]);
        });
}

/**
 * Sets up the stored data.
 */
function setupStorage() {
    Interactions = icwsStorage.getCollection('interactions');
    TimeDiffView = icwsStorage.getView(Interactions, 'timeDiffView', initTimeDiffView);
    DailyInteractionView = icwsStorage.getView(Interactions, 'dailyInteractionView', initDailyInteractionView)
    WeeklyInteractionView = icwsStorage.getView(Interactions, 'weeklyInteractionView', initWeeklyInteractionView)

    // Update all values
    Interactions.findAndUpdate(function () { return true; }, function (item) {
        return _.assign(item, icwsUtils.updateQueueState(item), { isCurrent: false });
    });
}

/**
 * Sets the workgroup subscriptions up.
 *
 * @param {String} subId Subscription ID string, defaults ot 'kugghuset-1'
 * @return {Promise}
 */
function setup(subId) {
  // Use default value of subId if undefined
    subId = !_.isUndefined(subId)
        ? subId
        : 'kugghuset-1';

    setupStorage();

    __localTimeDiff = getGlobalTimeDiff();

    return workStationSub('subscribe', subId);
}

module.exports = {
    watch: watch,
    setup: setup,
    getInteractions: function () {
        return {
            activeInteractions: __activeInteractions,
            _activeInteractions: Interactions.where(function (item) { return item.isCurrent; }),
            csaInteractions: Interactions.where(function (item) { return item.workgroup === 'CSA', item.isCurrent }),
            partnerServiceInteractions: Interactions.where(function (item) { return item.workgroup === 'Partner Service', item.isCurrent }),
        }
    },
    getQueueInfo: function () {
        return __queueInfo;
    },
}
