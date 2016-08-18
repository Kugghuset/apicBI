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

/**
 * @type {LokiCollection<{}>}
 */
var Interactions = icwsStorage.getCollection('interactions');;

/**
 * @type {LokiCollection<{}>}
 */
var WorkStations = icwsStorage.getCollection('workstations');;

/**
 * TODO:
 * - Handle abandonRate better
 * - Store all data to Loki.js
 * - Clear data every day/week
 * - Smooth out queue time diff
 */

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

var __workstations = [];
var __activeInteractions = [];
var __finishedInteractions = [];

/**
 * @type {{ id: String, abandonDate: Date }[]}
 */
var __abandonedCalls = [];

/**
 * @type {{ id: String, completedDate: Date }[]}
 */
var __completedCalls = [];

/**
 * The differance in milliseconds in comparison to the server.
 *
 * @type {Number}
 */
var __localTimeDiff = null;

/**
 * Array of time diffs between queueTime based on ININ data (queueDate - connectedDate)
 * and calculated queue time (__queueTime).
 *
 * Used for better handle current queue time.
 *
 * __localTimeDiff should be set to the mean value of the current day's diff.
 *
 * @type {Number[]}
 */
var __timeDiffs = [];

/**
 * The item which has been queueing the longest.
 * @type {{ queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }}
 */
var __queueInfo = { queueTime: 0, id: null, queueLength: 0, abandonedLength: 0, completedLength: 0, abandonRate: 0 };

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

    _.forEach(__activeInteractions, updateCalculatedValues);
    updateQueueInfo();
}

/**
 * @param {Array} dataArr The array retuerned from polling
 */
function updateInteractions(data) {
    // Get all added interactions
    var _added = _.map(data.interactionsAdded, function (interaction) { return _.assign({}, getInteractionData(interaction), { referenceDate: new Date() }) });

    // Get all changed interactions
    var _changed = _.map(data.interactionsChanged, getInteractionData);

    // Get all removed interactions
    // NOTE: This is a simple array of ids
    var _removed = _.map(data.interactionsRemoved)

    // Handle added interactions
    if (_.some(_added)) {
        // Add them all
        __activeInteractions = __activeInteractions.concat(_.map(_added, function (interaction) {
            // If there is no queueTime but both queueDate and connectedDate exists, set queueTime
            if (hasQueueTime(interaction)) {
                interaction.queueTime = getDateDiff(interaction.queueDate, interaction.connectedDate, 'seconds');
            }

            return interaction;
        }));

        /**
         * Push or update persisted data.
         */
        _.forEach(_added, function (interaction) {
            if (hasQueueTime(interaction)) {
                interaction.queueTime = getDateDiff(interaction.queueDate, interaction.connectedDate, 'seconds');
            }

            var _updated = Interactions.findOne({ id: _.toString(interaction.id) });

            if (_.isNull(_updated)) {
                // Insert the interaction as it's a legitimately new one
                console.log('\n');
                console.log('Inserting new interaction')
                console.log('\n');
                Interactions.insert(interaction);
            } else {
                // Update the interaction
                console.log('\n');
                console.log('Updating existing interaction')
                console.log('\n');
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
                if (hasQueueTime(_updated)) {
                    _updated.queueTime = getDateDiff(_updated.queueDate, _updated.connectedDate, 'seconds');
                }

                // Splice in the updated version instead of the original item
                __activeInteractions.splice(_index, 1, _updated);

                // Add interaction to __abandonedCalls if the call is abandoned and not on the abandoned list
                if (isAbandoned(_updated) && !_.find(__abandonedCalls, { id: _updated.id })) {
                    __abandonedCalls.push({ id: _updated.id, abandonDate: new Date() });
                }

                // Add interaction to __completedCalls if the call is completed and not on the completed list
                if (isCompleted(_updated) && !_.find(__completedCalls, { id: _updated.id })) {
                    __completedCalls.push({ id: _updated.id, completedDate: new Date() });
                }
            }
        });

        /**
         * Update persisted data.
         */
        _.forEach(_changed, function (interaction) {
            var _updated = Interactions.findOne({ id: _.toString(interaction.id) });

            if (_.isNull(_updated)) {
                console.log('Failed to find interaction: ' + interaction.id);
                return;
            }

            // If there is no queueTime but both queueDate and connectedDate exists, set queueTime
            if (hasQueueTime(_updated)) {
                _updated.queueTime = getDateDiff(_updated.queueDate, _updated.connectedDate, 'seconds');
            }

            if (isAbandoned(_updated) && !_updated.isAbandoned) {
                // Set isAbandoned and abandonDate
                _updated.isAbandoned = true;
                _updated.abandonDate = new Date();
            } else if (isCompleted(_updated) && !_updated.isAbandoned) {
                // Set isCompleted and completedDate
                _updated.isCompleted = true;
                _updated.completedDate = new Date();
            }

            // Update the interaction
            _updated = _.assign(_updated, interaction);
            Interactions.update(_updated);
        });
    }

    // Handle removed interactions
    if (_.some(_removed)) {
        var _removedItems = _.remove(__activeInteractions, function (interaction) { return !!~_removed.indexOf(interaction.id); });
        __finishedInteractions.concat(_removedItems);

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
 * Returns a more readable interaction object.
 *
 * @param {Object} interaction The interaction object returned from ININ
 * @return {{ id: String, type: String, callType: String, callDirection: String, remoteAddress: String, remoteId: String, remoteName: String, duration: Number, state: String, workgroup: String, userName: String, startDate: Date, endDate: Date, queueDate: Date, answerDate: Date, connectedDate: Date }}
 */
function getInteractionData(interaction) {
    return _.reduce({
        id: _.get(interaction, 'interactionId'),
        type: _.get(interaction, 'attributes.Eic_ObjectType'),
        callType: getCallType(interaction),
        callDirection: getCallDirection(interaction),
        remoteAddress: _.get(interaction, 'attributes.Eic_RemoteAddress'),
        remoteId: _.get(interaction, 'attributes.Eic_RemoteId'),
        remoteName: _.get(interaction, 'attributes.Eic_RemoteName'),
        duration: _.get(interaction, 'attributes.Eic_ConnectDurationTime'),
        state: getState(interaction),
        stateVal: _.get(interaction, 'attributes.Eic_State'),
        workgroup: _.get(interaction, 'attributes.Eic_WorkgroupName'),
        userName: _.get(interaction, 'attributes.Eic_UserName'),
        startDate: getDate(interaction, 'Eic_InitiationTime'),
        endDate: getDate(interaction, 'Eic_TerminationTime'),
        queueDate: getDate(interaction, 'Eic_LineQueueTimestamp'),
        answerDate: getDate(interaction, 'Eic_AnswerTime'),
        connectedDate: getDate(interaction, 'Eic_ConnectTime'),
        isCurrent: true,
    }, function (obj, value, key) {
        return !!value
            ? _.assign({}, obj, _.set({}, key, value))
            : obj;
    }, {});
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
        _state = undefined;
    }

    return _state;
}

/**
 * @param {Object} interaction The interaction object returned from ININ
 * @return {String} The call type as a readable string.
 */
function getCallType(interaction) {
    var callType = _.get(interaction, 'attributes.Eic_CallType');// === 'E' ? 'external' : 'intercom',

    if (callType === 'E') {
        return 'external';
    } else if (callType === 'I') {
        return 'intercom';
    } else {
        return undefined;
    }
}

/**
 * @param {Object} interaction The interaction object returned from ININ
 * @return {String} The call direction as a readable string.
 */
function getCallDirection(interaction) {
    var callDirection = _.get(interaction, 'attributes.Eic_CallDirection');

    if (callDirection === 'I') {
        return 'inbound';
    } else if (callDirection === 'O') {
        return 'outbound';
    } else {
        return undefined;
    }
}

/**
 * @param {Object} interaction The interaction object returned
 * @param {String} dateType The type of date to return
 * @return {Date}
 */
function getDate(interaction, dateType) {
    var _dateString = _.get(interaction, 'attributes.' + dateType);

    // If there is no value, return null.
    if (!_dateString) {
        return null;
    }

    var _date;

    if (moment(new Date(_dateString)).isValid()) {
        _date = new Date(_dateString);
    } else if (moment(_dateString).isValid()) {
        _date = moment(_dateString).toDate();
    } else {
        _date = _dateString;
    }

    return _date;
}


/**
 * @param {Object} interaction The interaction object to get values from
 * @param {String} dateType1
 * @param {String} dateType2
 * @return {Number}
 */
function getDateDiff(date1, date2, granularity, skipAbs) {
    skipAbs = _.isBoolean(skipAbs) ? skipAbs : false;

    granularity = !!granularity ? granularity : 'seconds';

    if (!date2) {
        return -1;
    }

    return skipAbs
        ? moment(date1).diff(date2, granularity)
        : Math.abs(moment(date1).diff(date2, granularity));
}

/**
 * Updates the local time differance variable if it's either null or higher
 * than the diff between startDate and referenceDate of *interaction*.
 *
 * @param {Object} interaction The interaction object to get values from
 */
function updateLocalTimeDiff(interaction) {
    //  Get the differance
    var _timeDiffStart = getDateDiff(interaction.referenceDate, interaction.startDate, 'milliseconds', true);
    var _timeDiffEnd = !_.isUndefined(interaction.endDate) ? null : getDateDiff(interaction.referenceDate, interaction.endDate, 'milliseconds', true);

    var currentLocalDiff = __localTimeDiff;

    // If __localTimeDiff is null or higher, correct it with _timeDiff
    if (_.isNull(__localTimeDiff) || Math.abs(_timeDiffStart) < Math.abs(__localTimeDiff)) {
        __localTimeDiff = _timeDiffStart;
    }

    if (!_.isNull(_timeDiffEnd) && Math.abs(_timeDiffEnd) < Math.abs(__localTimeDiff)) {
        __localTimeDiff = _timeDiffEnd;
    }

    if (currentLocalDiff !== __localTimeDiff) {
        console.log('Local time differance updated to: {timediff} ms'.replace('{timediff}', __localTimeDiff));
    }
}

/**
 * Updates *interaction* with the following properties:
 * - inQueue (boolean value of whether the *interaction* is in queue or not.)
 * - _queueTime (calculated time diff between queueDate and Date.now or the actual queueTime (connectedDate - queueDate))
 * - __queueTime (calculated between queueDate and now, only set when the diff won't grow)
 *
 * @param {Object} interaction The interaction object to get values from
 * @param {Number} index Index of the interaction
 */
function updateCalculatedValues(interaction, index) {
    // Create a variable for _queueTime to be used.
    var _queueTime;

    // Update the inQueue property
    if (isInQueue(interaction) && !interaction.inQueue) {
        interaction.inQueue = true;
    } else if (!isInQueue(interaction) && interaction.inQueue) {
        interaction.inQueue = false;
    }

    if (isAbandoned(interaction) && !interaction.abandoned) {
        interaction.abandoned = true;
    } else if (!isAbandoned(interaction) && interaction.abandoned) {
        interaction.abandoned = false;
    }

    // Set _queueTime to either the time diff returned form getInteractionQueueTime or the actual queueTime.
    if (interaction.inQueue) {
        _queueTime = getInteractionQueueTime(interaction);
    } else {
        _queueTime = interaction.queueTime || 0;
    }

    // Update the activeTime
    var _updated = _.assign(interaction, { _queueTime: _queueTime });

    // If __queueTime (calculated queueTime) is undefined and the *interaction* is not in queue, set __queueTime.
    if (_.isUndefined(_updated.__queueTime) && !interaction.inQueue) {
        interaction.__queueTime = getInteractionQueueTime(interaction);

        // Push the diff to __timeDiffs to store it.
        __timeDiffs.push(interaction.__queueTime - interaction._queueTime);
    }

    // Replace the item in the list.
    __activeInteractions.splice(index, 1, _updated);

    var _interaction = Interactions.find({ id: _.toString(interaction.id) });

    if (_interaction) {
        _interaction = _.assign(_interaction, _updated);
        Interactions.update(_interaction);
    }
}

/**
 * @param {Object} interaction The interaction object to get values from
 * @return {Boolean} Whether the *interaction* is assumed to be in queue or not.
 */
function isInQueue(interaction) {
    return !_.some([
        !_.isUndefined(interaction.queueTime),
        !!interaction.endDate,
        interaction.callDirection !== 'inbound'
    ]);
}

/**
 * @param {Object} interaction The interaction object to get values from
 * @return {Boolean} Whether the *interaction* has queueTime or not.
 */
function hasQueueTime(interaction) {
    return  _.isUndefined(interaction.queueTime) && !_.some([interaction.queueDate, interaction.connectedDate], _.isUndefined);
}

/**
 * @param {Object} interaction The interaction object to get values from
 * @return {Boolean} Whether the *interaction* is assumed to be completed or not.
 */
function isAbandoned(interaction) {
    return _.every([
        !!interaction.endDate,
        !interaction.connectedDate,
        interaction.state === 'Call ended remotely',
    ]);
}

/**
 * @param {Object} interaction The interaction object to get values from
 * @return {Boolean} Whether the *interaction* is assumed to be completed or not.
 */
function isCompleted(interaction) {
    return _.every([
        !!interaction.endDate,
        !!interaction.connectedDate,
        interaction.state !== 'On call',
    ]);
}

/**
 * Updates the longest queue time and ID.
 */
function updateQueueInfo() {
    __queueInfo = _.chain(__activeInteractions)
        .filter(function (interaction) { return interaction.inQueue; })
        .map(function (interaction) { return _.assign({}, interaction, { _queueTime: getInteractionQueueTime(interaction) }) })
        .orderBy('_queueTime', 'desc')
        .thru(function (interactions) { return _.map(interactions, function (interaction) { return _.assign({}, interaction, { queueLength: interactions.length }); }); })
        .first()
        .thru(function (interaction) {
            return _.isUndefined(interaction)
            ? { id: null, queueTime: 0, queueLength: 0 }
            : { id: interaction.id, queueTime: interaction._queueTime, queueLength: interaction.queueLength }
        })
        .thru(function (queueInfo) { return _.assign({}, queueInfo, getDailyQueueData()); })
        .value();
}

/**
 * @return {{ abandonDate: Number, abandonedLength: Number, completedDate: Number }}
 */
function getDailyQueueData() {
    var _startdate = { $gte: moment().startOf('day').toDate(), $lte: moment().endOf('day').toDate(), };

    var _abandoned = Interactions.find({ isAbandoned: true, startDate: _startdate });
    var _completed = Interactions.find({ isCompleted: true, startDate: _startdate });

    return {
        abandonRate: (((_abandoned.length / _completed.length) || 0) * 100).toFixed(2),
        abandonedLength: _abandoned.length,
        completedLength: _completed.length,
    }
}

/**
 *
 * @param {Object} interaction The interaction object to get values from
 * @return {Number}
 */
function getInteractionQueueTime(interaction) {
    // Should be less than.
    var _timeDiff = getDateDiff(interaction.referenceDate, interaction.queueDate, 'milliseconds', true);

    /**
     * TODO:
     * - Potentially add the time diff between __queueTime and (actual) queueTime to the diff
     *   for a closer value.
     */

    return moment(new Date()).diff(interaction.queueDate, 'seconds');
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
 * Sets up the stored data.
 */
function setupStorage() {
    Interactions = icwsStorage.getCollection('interactions');
    WorkStations = icwsStorage.getCollection('workstations');

    // Update all values
    Interactions.findAndUpdate(function () { return true; }, function (obj) {
        if (isAbandoned(obj)) {
            obj.isAbandoned = true;
        } else if (isCompleted(obj)) {
            obj.isCompleted = true;
        } else if (isInQueue(obj)) {
            obj.inQueue = true;
        }

        return _.assign(obj, { isCurrent: false, inQueue: false });
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

    return workStationSub('subscribe', subId);
}

module.exports = {
    watch: watch,
    setup: setup,
    getInteractions: function () {
        return {
            activeInteractions: __activeInteractions,
            _activeInteractions: Interactions.find({ isCurrent: true }),
            finishedInteractions: __finishedInteractions,
        }
    },
    getQueueInfo: function () {
        return __queueInfo;
    },
}
