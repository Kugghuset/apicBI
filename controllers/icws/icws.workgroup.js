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
 * Remember to turn back time a minute on the dev laptop.
 */

/**
 * @type {LokiCollection<{}>}
 */
var Interactions = icwsStorage.getCollection('interactions');

/**
 * @type {LokiCollection<{}>}
 */
var WorkStations = icwsStorage.getCollection('workstations');

var TimeDiffView = icwsStorage.getView(Interactions, 'timeDiffView', initTimeDiffView);

/**
 * TODO:
 * - Clear data every day/week
 * - Smooth out queue time diff
 * - Store queue time diff in global variable instead of querying every time.
 * - Ensure updated queue time values are modified elsewhere too.
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
            if (canCalculateQueueTime(interaction)) {
                var _lastDate = isAbandoned(interaction)
                    ? interaction.endDate
                    : interaction.connectedDate;

                interaction.queueTime = getDateDiff(interaction.queueDate, _lastDate, 'seconds');
            }

            return interaction;
        }));

        /**
         * Push or update persisted data.
         */
        _.forEach(_added, function (interaction) {
            if (canCalculateQueueTime(interaction)) {
                var _lastDate = isAbandoned(interaction)
                    ? interaction.endDate
                    : interaction.connectedDate;

                interaction.queueTime = getDateDiff(interaction.queueDate, _lastDate, 'seconds');
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
                if (canCalculateQueueTime(_updated)) {
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
            if (canCalculateQueueTime(_updated)) {
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
 * @param {String} granularity
 * @return {Number}
 */
function getGlobalTimeDiff() {
    /**
     * TODO:
     * - figure out why the time diff keep getting smaller
     */
    var _diffs = TimeDiffView
        .data()
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

    // Update the inQueue property
    if (isInQueue(interaction) && !interaction.inQueue) {
        interaction.inQueue = true;
    } else if (!isInQueue(interaction) && interaction.inQueue) {
        interaction.inQueue = false;
    }

    if (isAbandoned(interaction) && !interaction.isAbandoned) {
        interaction.isAbandoned = true;
    } else if (!isAbandoned(interaction) && interaction.isAbandoned) {
        interaction.isAbandoned = false;
    }

    if (isCompleted(interaction) && !interaction.isCompleted) {
        interaction.isCompleted = true;
    } else if (!isCompleted(interaction) && interaction.isCompleted) {
        interaction.isCompleted = false;
    }

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
 * Returns a boolean value of whether the *_date* can be a date or not.
 *
 * @param {Any} _date
 * @return {Boolean}
 */
function isParsableOrDate(_date) {
    return !_date ? false : moment(new Date(_date)).isValid();
}

/**
 * @param {Object} interaction The interaction object to get values from
 * @return {Boolean} Whether the *interaction* is assumed to be in queue or not.
 */
function isInQueue(interaction) {
    return !_.some([
        !_.isUndefined(interaction.queueTime),
        isParsableOrDate(interaction.endDate),
        interaction.callDirection !== 'inbound',
    ]);
}

/**
 * @param {Object} interaction The interaction object to get values from
 * @return {Boolean} Whether the *interaction* has queueTime or not.
 */
function canCalculateQueueTime(interaction) {
    return _.every([
        _.isUndefined(interaction.queueTime),
        !_.isUndefined(interaction.queueDate),
        _.some([interaction.connectedDate, interaction.endDate], isParsableOrDate),
    ]);
}

/**
 * @param {Object} interaction The interaction object to get values from
 * @return {Boolean} Whether the *interaction* is assumed to be completed or not.
 */
function isAbandoned(interaction) {
    return _.every([
        isParsableOrDate(interaction.endDate),
        !isParsableOrDate(interaction.connectedDate),
        interaction.state === 'Call ended remotely',
    ]);
}

/**
 * @param {Object} interaction The interaction object to get values from
 * @return {Boolean} Whether the *interaction* is assumed to be completed or not.
 */
function isCompleted(interaction) {
    return _.every([
        isParsableOrDate(interaction.endDate),
        isParsableOrDate(interaction.connectedDate),
        interaction.state !== 'On call',
    ]);
}

/**
 * @param {{ startDate: Date }} item
 * @return {Boolean}
 */
function isToday(item) {
    return !item
        ? false
        : moment(item.startDate).isBetween(
            moment().startOf('day'),
            moment().endOf('day')
        );
}

/**
 * @param {String} workgroupName
 * @return {{ queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number })
 */
function getQueueInfoData(workgroupName) {
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
        .thru(function (queueInfo) { return _.assign({}, queueInfo, getDailyQueueData(workgroupName)); })
        .value();
}

/**
 * Updates the longest queue time and ID.
 * @reuturn {{ csa: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, partnerService: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number } }}
 */
function updateQueueInfo() {
    __queueInfo = { csa: getQueueInfoData('CSA'), partnerService: getQueueInfoData('Partner Service'), timeDiff: __localTimeDiff };
    return __queueInfo;
}

/**
 *
 * @param {String} workgroupName
 * @return {{ abandonDate: Number, abandonedLength: Number, completedDate: Number }}
 */
function getDailyQueueData(workgroupName) {
    var _startdate = { $gte: moment().startOf('day').toDate(), $lte: moment().endOf('day').toDate(), };

    var _abandoned = Interactions.where(function (item) {
        return _.every([
            item.workgroup === workgroupName,
            item.isAbandoned,
            isToday(item),
        ]);
    });
    var _completed = Interactions.where(function (item) {
        return _.every([
            item.workgroup === workgroupName,
            item.isCompleted,
            isToday(item),
        ]);
    });

    return {
        abandonRate: ((_abandoned.length / (_completed.length || 1)) * 100).toFixed(2),
        abandonedLength: _abandoned.length,
        completedLength: _completed.length,
    }
}

/**
 *
 * @param {Object} interaction The interaction object to get values from
 * @param {Boolean} [useGlobalTimeDiff = false]
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
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initTimeDiffView(view) {
    return view
        .applyWhere(function (item) { return moment().subtract(7, 'days').isBefore(item.startDate); })
        .applyWhere(function (item) { return !item.inQueue; })
        .applyWhere(function (item) { return _.every([item.localQueueTime, item.queueTime], _.isNumber); })
        .applySort(function (a, b) {
            var _a = a.localQueueTime - a.queueTime;
            var _b = b.localQueueTime - b.queueTime;
            return _a === _b
                ? 0
                : (_a < _b ? 1 : -1);
        });
}

/**
 * Sets up the stored data.
 */
function setupStorage() {
    Interactions = icwsStorage.getCollection('interactions');
    WorkStations = icwsStorage.getCollection('workstations');
    TimeDiffView = icwsStorage.getView(Interactions, 'timeDiffView', initTimeDiffView);

    // Update all values
    Interactions.findAndUpdate(function () { return true; }, function (item) {
        return _.assign(item, {
            isCurrent: false,
            inQueue: isInQueue(item),
            isAbandoned: isAbandoned(item),
            isCompleted: isCompleted(item),
            // localQueueTime: null,
        });
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
            finishedInteractions: __finishedInteractions,
        }
    },
    getQueueInfo: function () {
        return __queueInfo;
    },
}
