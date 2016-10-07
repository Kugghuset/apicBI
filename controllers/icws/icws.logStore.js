'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var db = require('./../../middlehand/db');
var models = require('./../../middlehand/models/models');
var logger = require('./../../middlehand/logger');
var utils = require('./icws.utils');

var Log = models.models.Log;

var _storesLogs = false;

var _logInterval = null;

/** @type {{}[]} */
var _logQueue = [];;

function pushLogs() {
    // Get all the logs
    var _logs = _logQueue;

    if (_logs.length === 0) {
        return;
    }

    //  Reset the _logQueue to an empty array
    _logQueue = [];

    Log.insert(_logs).run(db.conn())
    .then(function (data) { /** Do something? */ })
    .catch(function (err) { /** Handle error */ });
}

/**
 * Pushed the log item to the log queue
 *
 * @param {Object} log
 */
function insert(log) {
    _logQueue.push(log);
}

/**
 * Sets the logger to push log data to the log queue.
 */
function storeLogs() {
    // If it's listeneing already, don't do anything
    if (_storesLogs) {
        return;
    }

    // Set _storesLogs to true, as to not listen to the same event multiple times
    _storesLogs = true;

    logger.logger.stream({ start: -1 }).on('log', insert);
}

/**
 * Starts the logging interval, which runs every 60 seconds.
 */
function startLogging() {
    // Is the interval already running, then kill it and reset it!
    if (!_.isNull(_logInterval)) {
        clearInterval(_logInterval);
    }

    // Start the insert every minute here!
    _logInterval = setInterval(pushLogs, 60 * 1000);

    storeLogs();
}

/**
 * Initializes the persistent log store to db.
 *
 * @return {Promise}
 */
function init() {
    // Reset the queue
    _logQueue = [];

    // Start the logging
    startLogging();

    // return a resolved promise to allow this to be used in a Promise chain
    return Promise.resolve();
}

module.exports = {
    init: init,
    insert: insert,
}
