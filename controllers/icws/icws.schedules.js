'use strict'

var _ = require('lodash');
var moment = require('moment');
var later = require('later');

/**
 * @type {{ type: String, interval: { isDone: Function, clear: Function } }[]}
 */
var _intervals = [];

/**
 * Storage of all schedules to run
 *
 * @type {{ weekly: { id: String, callback: Function }[] }}
 */
var _schedules = {
    weekly: []
};

/**
 * Calls *fn* and returns whatever its return is.
 *
 * @param {Function} fn
 * @return {Any}
 */
function _callFn(fn) { return fn(); }

/**
 * @param {String} type
 */
function _call(type) {
    // Call all callable callbacks
    _.chain(_schedules[type])
        // Get only the callbacks
        .map('callback')
        // Filter out any non-functions
        .filter(_.isFunction)
        // Call all of them
        .forEach(_callFn)
        .value();
}

/**
 * Later.js schedule which will run every monday morning at 1 AM (local to the machine).
 */
var _weeklySchedule = later.parse.recur()
    .on(2).dayOfWeek()
    .first().hour();

/**
 * Starts a *type* schedule which will call all callbacks in _schedules[type]
 *
 * @param {String} type
 * @param {Object} schedule
 * @return {{ type: String, interval: { isDone: Function, clear: Function } }}
 */
function startInterval(type, schedule) {
    var _current = _.find(_intervals, { type: type });

    // If there is an interval of the same type, return it, as there's no need to run duplicates of it.
    if (_current) {
        return _current;
    }

    // Push the new interval to intervals
    var _length = _intervals.push({
        type: type,
        interval: later.setInterval(function () { return _call(type); }, schedule),
    });

    console.log('Starting the {type} interval schedule'.replace('{type}', type));

    // Return the added interval
    return _intervals[_length - 1];
}

/**
 * @param {String} type
 * @param {String} id
 * @return {{ id: String, callback: Function }}
 */
function getSchedule(type, id) {
    return _.find(_schedules[type], { id: id }) || null;
}

/**********************
 * Exports below here.
 **********************/

/**
 * Sets a weekly schedule with the id *id* which will call *callback* every time it happens.
 *
 * @param {String} id
 * @param {Function} callback
 * @return {{ id: String, callback: Function }}
 */
function setWeekly(id, callback) {
    // If there is an id matching *id*, remove it.
    removeWeekly(id);

    // Push the schedule item to weekly
    _schedules.weekly.push({
        id: id,
        callback: callback,
    });

    // return the added object
    return getSchedule('weekly', id);
}

/**
 * Removes
 *
 * @param {String} id
 * @return {{ id: String, callback: Function }}
 */
function removeWeekly(id) {
    var _existing = getSchedule('weekly', id);

    if (_.isNull(_existing)) {
        _schedules.weekly = _schedules.weekly.filter(function (schedule) { return schedule !== _existing; });
    }

    return _existing;
}

/**
 * Sets up the schedules.
 */
function setup() {
    // Start the weekly interval
    startInterval('weekly', _weeklySchedule);
}

module.exports = {
    setup: setup,
    setWeekly: setWeekly,
    removeWeekly: removeWeekly,
}
