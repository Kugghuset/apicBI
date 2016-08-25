'use strict'

var _ = require('lodash');
var moment = require('moment');

/*********************************
 * Interaction utility functions.
 *********************************/

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
 * @param {{ queueTime: Number, queueDate: Date, connectedDate: Date, endDate: Date }} interaction The interaction object to get values from
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
 * @param {{ queueTime: Number, endDate: Date, callDirection: String }} interaction The interaction object to get values from
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
 * @param {{ endDate: Date, connectedDate: Date, state: String }} interaction The interaction object to get values from
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
 * @param {{ endDate: Date, connectedDate: Date, state: String }} interaction The interaction object to get values from
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
 * Checks whether *item* was started today and returns true or false for it.
 *
 * @param {{ startDate: Date }} interaction
 * @return {Boolean}
 */
function isToday(interaction) {
    return !interaction
        ? false
        : moment(interaction.startDate).isBetween(
            moment().startOf('day'),
            moment().endOf('day')
        );
}

/**
 * Checks whether *item* was started today and returns true or false for it.
 *
 * @param {{ startDate: Date }} interaction
 * @return {Boolean}
 */
function isThisWeek(interaction) {
    return !interaction
        ? false
        : moment(interaction.startDate).isBetween(
            moment().startOf('isoweek'),
            moment().endOf('day')
        );
}

/**
 * @param {Date} date1
 * @param {Date} date2
 * @param {String} [granularity='seconds']
 * @param {Boolean} [skipAbs=false]
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
 * Calculates the queue time, until the call is connected (if answered) or ended (abandoned)
 * and returns it in seconds.
 *
 * @param {{ endDate: Date, connectedDate: Date, queueDate: Date, state: String }} interaction
 * @return {Number}
 */
function calculateQueueTime(interaction) {
    var _lastDate = isAbandoned(interaction)
        ? interaction.endDate
        : interaction.connectedDate;

    return getDateDiff(interaction.queueDate, _lastDate, 'seconds');
}

/**
 * Compares the queue diff and returns 0 if equal, 1 if a is greater and -1 if a is lesser.
 *
 * @param {{ localQueueTime: Number, queueTime: Number }} a
 * @param {{ localQueueTime: Number, queueTime: Number }} b
 * @return {Number}
 */
function compareQueueDiff(a, b) {
    var _a = a.localQueueTime - a.queueTime;
    var _b = b.localQueueTime - b.queueTime;
    return _a === _b
        ? 0
        : (_a < _b ? 1 : -1);
}

/**
 * @param {{ queueTime: Number, endDate: Date, connectedDate: Date, callDirection: String, state: String }} interaction
 * @return {{ queueTime: Number, endDate: Date, connectedDate: Date, callDirection: String, state: String, inQueue: Boolean, isAbandoned: Boolean, isCompleted: Boolean, ... }}
 */
function updateQueueState(interaction) {
    return _.assign({}, interaction, {
        inQueue: isInQueue(interaction),
        isAbandoned: isAbandoned(interaction),
        isCompleted: isCompleted(interaction),
    });
}

/**
 * @param {{ attributes: Object }} icwsInteraction The interaction object returned
 * @param {String} dateType The type of date to return
 * @return {Date}
 */
function getDate(icwsInteraction, dateType) {
    var _dateString = _.get(icwsInteraction, 'attributes.' + dateType);

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
 * Returns a string of the current state.
 *
 * @param {{ attributes: { Eic_State: String } }} icwsInteraction The interaction object returned from ININ
 * @return {String} The state as a readable string instead of a single character
 */
function getState(icwsInteraction) {
    var _state;

    if (_.get(icwsInteraction, 'attributes.Eic_State') === 'A') {
        _state = 'Alerting agent'
    } else if (_.get(icwsInteraction, 'attributes.Eic_State') === 'C') {
        _state = 'On call';
    } else if (_.get(icwsInteraction, 'attributes.Eic_State') === 'H') {
        _state = 'On hold'
    } else if (_.get(icwsInteraction, 'attributes.Eic_State') === 'M') {
        _state = 'Voicemail';
    } else if (_.get(icwsInteraction, 'attributes.Eic_State') === 'O') {
        _state = 'Offering';
    } else if (_.get(icwsInteraction, 'attributes.Eic_State') === 'R') {
        _state = 'Awaiting answer';
    } else if (_.get(icwsInteraction, 'attributes.Eic_State') === 'P') {
        _state = 'Parked';
    } else if (_.get(icwsInteraction, 'attributes.Eic_State') === 'E') {
        _state = 'Call ended remotely';
    } else if (_.get(icwsInteraction, 'attributes.Eic_State') === 'I') {
        _state = 'Call ended locally';
    } else if (_.get(icwsInteraction, 'attributes.Eic_State') === 'S') {
        _state = 'Dialing';
    } else {
        _state = undefined;
    }

    return _state;
}

/**
 * @param {{ attributes: { Eic_CallType: String } }} icwsInteraction The interaction object returned from ININ
 * @return {String} The call type as a readable string.
 */
function getCallType(icwsInteraction) {
    var callType = _.get(icwsInteraction, 'attributes.Eic_CallType');// === 'E' ? 'external' : 'intercom',

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
 * @param {Array} coll Collection to check *match* against
 * @param {Any} match Item or items to look for in *coll*
 * @return {Boolean}
 */
function contains(coll, match) {
  return !!~_.indexOf(coll, match);
}

module.exports = {
    isParsableOrDate: isParsableOrDate,
    canCalculateQueueTime: canCalculateQueueTime,
    isInQueue: isInQueue,
    isAbandoned: isAbandoned,
    isCompleted: isCompleted,
    isToday: isToday,
    isThisWeek: isThisWeek,
    getDateDiff: getDateDiff,
    calculateQueueTime: calculateQueueTime,
    compareQueueDiff: compareQueueDiff,
    updateQueueState: updateQueueState,
    icws: {
        getDate: getDate,
        getState: getState,
        getCallType: getCallType,
        getCallDirection: getCallDirection,
        getInteractionData: getInteractionData,
    },
    contains: contains,
}
