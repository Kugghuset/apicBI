'use strict'

var _ = require('lodash');
var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');
var moment = require('moment');

var icwsSub = require('./icws.sub');
var icws = require('../../lib/icwsModule');

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

var _workstations = [];
var _activeInteractions = [];
var _finishedInteractions = [];

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
            return !!_data
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
}

/**
 * @param {Array} dataArr The array retuerned from polling
 */
function updateInteractions(data) {

    // Get all added interactions
    var _added = _.map(data.interactionsAdded, function (interaction) {
        // Return all of the following properties where there is a value.
        return _.reduce({
            id: _.get(interaction, 'interactionId'),
            type: _.get(interaction, 'attributes.Eic_ObjectType'),
            callType: _.get(interaction, 'attributes.Eic_CallType') === 'E' ? 'external' : 'intercom',
            callDirection: _.get(interaction, 'attributes.Eic_CallDirection') === 'I' ? 'incoming' : 'outgoing',
            remoteAddress: _.get(interaction, 'attributes.Eic_RemoteAddress'),
            remoteId: _.get(interaction, 'attributes.Eic_RemoteId'),
            remoteName: _.get(interaction, 'attributes.Eic_RemoteName'),
            duration: _.get(interaction, 'attributes.Eic_ConnectDurationTime'),
            state: getState(interaction),
            workgroup: _.get(interaction, 'attributes.Eic_WorkgroupName'),
            userName: _.get(interaction, 'attributes.Eic_UserName'),
            startDate: getDate(interaction, 'Eic_InitiationTime'),
            endDate: getDate(interaction, 'Eic_TerminationTime'),
        }, function (obj, value, key) {
            return !!value
                ? _.assign({}, obj, _.set({}, key, value))
                : obj;
        }, {});
    });

    // Get all changed interactions
    var _changed = _.map(data.interactionsChanged, function (interaction) {
        // Return all of the following properties where there is a value.
        return _.reduce({
            id: _.get(interaction, 'interactionId'),
            type: _.get(interaction, 'attributes.Eic_ObjectType'),
            callType: _.get(interaction, 'attributes.Eic_CallType') === 'E' ? 'external' : 'intercom',
            callDirection: _.get(interaction, 'attributes.Eic_CallDirection') === 'I' ? 'incoming' : 'outgoing',
            remoteAddress: _.get(interaction, 'attributes.Eic_RemoteAddress'),
            remoteId: _.get(interaction, 'attributes.Eic_RemoteId'),
            remoteName: _.get(interaction, 'attributes.Eic_RemoteName'),
            duration: _.get(interaction, 'attributes.Eic_ConnectDurationTime'),
            state: getState(interaction),
            workgroup: _.get(interaction, 'attributes.Eic_WorkgroupName'),
            userName: _.get(interaction, 'attributes.Eic_UserName'),
            startDate: !!_.get(interaction, 'attributes.Eic_InitiationTime')
                ? new Date(_.get(interaction, 'attributes.Eic_InitiationTime'))
                : undefined,
            endDate: !!_.get(interaction, 'attributes.Eic_TerminationTime')
                ? new Date(_.get(interaction, 'attributes.Eic_TerminationTime'))
                : undefined,
        }, function (obj, value, key) {
            return !!value
                ? _.assign({}, obj, _.set({}, key, value))
                : obj;
        }, {});
    });

    // Get all removed interactions
    // NOTE: This is a simple array of ids
    var _removed = _.map(data.interactionsRemoved)

    // Handle added interactions
    if (_.some(_added)) {
        // Add them all
        _activeInteractions = _activeInteractions.concat(_added);

        console.log('\nAdded interactions:');
        console.log(JSON.stringify(_added, null, 4));

        var _interactionPath = path.resolve(__dirname, '../../assets/icws/addedInteractions{date}.json'.replace('{date}', moment().format('HHmmss')));
        // fs.writeFileSync(_interactionPath, JSON.stringify(_activeInteractions, null, 4), 'utf8');
    }

    // Handle changes
    if (_.some(_changed)) {
        _.forEach(_changed, function (interaction) {
            var _interaction = _.find(_activeInteractions, { id: interaction.id });
            // Update the interaction
            if (_interaction) {
                // Get the position of the item
                var _index = _.indexOf(_activeInteractions, _interaction);
                // Merge the objects
                var _updated = _.assign({}, _interaction, interaction);
                // Splice in the updated version instead of the original item
                _activeInteractions.splice(_index, 1, _updated);
            }
        });

        console.log('\nChanged interactions');
        console.log(JSON.stringify(_changed, null, 4));

        var _interactionPath = path.resolve(__dirname, '../../assets/icws/interactions{date}.json'.replace('{date}', moment().format('HHmmss')));
        // fs.writeFileSync(_interactionPath, JSON.stringify(_activeInteractions, null, 4), 'utf8');
    }

    // Handle removed interactions
    if (_.some(_removed)) {
        var _removedItems = _.remove(_activeInteractions, function (interaction) { return !!~_removed.indexOf(interaction.id); });
        _finishedInteractions.concat(_removedItems);
        console.log('\nRemoved interactions:');
        console.log(JSON.stringify(_removedItems, null, 4));

        var _finishedInteractionsPath = path.resolve(__dirname, '../../assets/icws/removedInteractions{date}.json'.replace('{date}', moment().format('HHmmss')));
        // fs.writeFileSync(_finishedInteractionsPath, JSON.stringify(_removedItems, null, 4), 'utf8');
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

    /**
     * TODO: Fill in the gap when there is no end date, but there's a start date and duration.
     *
     * TODO: push to some sort of database
     */

    if (_.some([_added, _changed, _removed]), _.some) {
        // Update _workStations
        _workstations = _.chain(_workstations)
            // Filter out removed workstations
            .filter(function (workstation) { return !!~_removed.indexOf(workstation); })
            // Filter out any modified workstations
            .filter(function (workstation) { return !_.find(_changed, { id: workstation.id }); })
            // Get the complete list of workstations
            .thru(function (workstations) { return workstations.concat(_added, _changed); })
            .value();

        console.log('There are now {num} workstations!'.replace('{num}', _workstations.length));

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
 * Returns a string of the current state.
 *
 * @param {Object} interaction The interaction object returned from ININ
 * @return {String} The state as a readable string instead of a single character
 */
function getState(interaction) {
    var _state;

    if (_.get(interaction, 'attributes.Eic_State') === 'A') {
        _state = 'Alerting agent'
    } else if (_.get(interaction, 'attributes.Eic_State') === 'C') {
        _state = 'On call';
    } else if (_.get(interaction, 'attributes.Eic_State') === 'H') {
        _state = 'On hold'
    } else if (_.get(interaction, 'attributes.Eic_State') === 'M') {
        _state = 'Voicemail';
    } else if (_.get(interaction, 'attributes.Eic_State') === 'O') {
        _state = 'Offering';
    } else if (_.get(interaction, 'attributes.Eic_State') === 'R') {
        _state = 'Awaiting answer';
    } else if (_.get(interaction, 'attributes.Eic_State') === 'P') {
        _state = 'Parked';
    } else if (_.get(interaction, 'attributes.Eic_State') === 'E') {
        _state = 'Call ended remotely';
    } else if (_.get(interaction, 'attributes.Eic_State') === 'I') {
        _state = 'Call ended locally';
    } else if (_.get(interaction, 'attributes.Eic_State') === 'S') {
        _state = 'Dialing';
    } else {
        console.log(_.get(interaction, 'attributes.Eic_State'));
        _state = 'Unknown';
    }

    return _state;
}

/**
 * @param {Object} interaction The interaction object returned
 * @param {String} dateType The type of date to return
 * @return {Date}
 */
function getDate(interaction, dateType) {
    var _date;

    if (dateType === 'Eic_InitiationTime') {
        _date = !!_.get(interaction, 'attributes.Eic_InitiationTime')
            ? moment(_.get(interaction, 'attributes.Eic_InitiationTime')).toDate()
            : undefined
    } else if (dateType === 'Eic_TerminationTime') {
        _date = !!_.get(interaction, 'attributes.Eic_TerminationTime')
            ? moment(_.get(interaction, 'attributes.Eic_TerminationTime')).toDate()
            : undefined;
    }

    return _date;
}

/****************
 * Subscriptions
 ****************/

/**
 * Subscribes or unsubscribes to workstations which are 'CSA'
 * with the subscription id *subId*.
 *
 * @param {String} action The action to run
 * @param {Number} subId Defaults to 1
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
                // 'Partner Service',
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
 * Enumeration of the various queueTypes
 */
var _queueTypes = {
    system: 0,
    user: 1,
    workgroup: 2,
    station: 3,
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
                // 'Partner Service',
            ].indexOf(item.queueName);
        })
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
            'Eic_CallId',
            'Eic_RemoteAddress',
            'Eic_RemoteId',
            'Eic_RemoteName',
            'Eic_UserName',
            'Eic_CallStateString',
            'Eic_CallDirection',
            'Eic_ObjectType',
            'Eic_CallType',
            'Eic_State',
            'Eic_ConnectDurationTime',
            'Eic_RemoteTn',
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
 * @param {String} subId Subscription ID string, defaults ot 'kugghuset-1'
 * @return {Promise}
 */
function setup(subId) {
  // Use default value of subId if undefined
    subId = !_.isUndefined(subId)
        ? subId
        : 'kugghuset-1';

    return workStationSub('subscribe', subId);
}

module.exports = {
    watch: watch,
    setup: setup,
}
