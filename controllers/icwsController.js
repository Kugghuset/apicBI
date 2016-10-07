'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var icws = require('../lib/icwsModule');
var _interval;

var icwsUser = require('./icws/icws.user');
var icwsInteraction = require('./icws/icws.interaction');
var icwsStorage = require('./icws/icws.storage');
var icwsData = require('./icws/icws.data');
var icwsPush = require('./icws/icws.push');
var icwsDb = require('./icws/icws.db');
var icwsUtils = require('./icws/icws.utils');

var logger = require('./../middlehand/logger');

/**
 * Polls the messaging route for new data
 * and handles new data for various endpoints.
 *
 * @return void
 */
function poll() {
    icws.get('messaging/messages', null, false, true)
    .then(function (res) {

        if (res.response.statusCode >= 400) {
            logger.log('An erroneous statusCode gotten when polling.', 'info', { statusCode: res.response.statusCode, statusMessage: res.response.statusMessage });
            stopPolling();

            // Restart the app and return
            logger.log('Attempting to reconnect.', 'info');
            return run();
        }

        var dataArr = !!res.body
            ? res.body
            : res;

        // Watch for, and handles changes for interactions users
        icwsInteraction.watch(dataArr);
        icwsUser.watch(dataArr);
    })
    .catch(function (err) {
        logger.log('An error occured when polling', 'error', { error: err.toString(), stackTrace: err.stack });
    })
}

/***************
 *
 * Exported functions.
 *
 **************/

/**
 * Sets up the subscriptions to all items of intereset.
 *
 * @return {Promise} -> {String} (Will be empty)
 */
function setupSubscriptions() {
    var promises = [ icwsUser.setup(), icwsInteraction.setup(), icwsPush.setup(), ];

    return icwsUtils.settle(promises);
}

/**
 * Starts polling the server at *ms*.
 *
 * @param {Number} ms Defaults to 1000 ms
 * @return {Object} Interval ID
 */
function startPolling(ms) {

    ms = !_.isUndefined(ms)
        ? ms
        : 1000;

    if (!_interval) {
        logger.log('Start polling ICWS server');
        _interval = setInterval(poll, ms)
    } else {
        logger.log('Polling already active.');
    }

    return _interval;
}

/**
 * Stops polling the ICWS server and sets _interval to undefined.
 *
 * @return {void}
 */
function stopPolling() {

    if (_interval) {
        logger.log('Stop polling the ICWS server');
        clearInterval(_interval);
    } else {
        logger.log('Cannot stop polling, nothing to stop.');
    }

    _interval = undefined;
}

/**
 * Initializes the ICWS object, sets up subscriptions
 * and starts polling the ICWS server.
 *
 * Returns a Promise of the ICWS object.
 *
 * @return {Promise}
 */
function run() {
    return new Promise(function (resolve, reject) {

        icws.auth()
        .then(icwsStorage.init)
        .then(function () {

          return icws.put('messaging/subscriptions/statistics/statistic-values', {
              statisticKeys: [
                {
                    statisticIdentifier: 'inin.optimizerrtadata:OptimizerCurrentStatus',
                    parameterValueItems: [
                        {
                            parameterTypeId: 'ININ.OptimizerRTAData:OptimizerSchedulingUnit',
                            value: ''
                        },
                        {
                            parameterTypeId: 'ININ.OptimizerRTAData:OptimizerWorkgroup',
                            value: ''
                        },
                        {
                            parameterTypeId: 'ININ.OptimizerRTAData:OptimizerAdherenceStatus',
                            value: ''
                        },
                        {
                            parameterTypeId: 'ININ.OptimizerRTAData:OptimizerExceptionType',
                            value: ''
                        },
                        {
                            parameterTypeId: 'ININ.OptimizerRTAData:OptimizerAgent',
                            value: ''
                        },
                    ],
                    rightsFilter: 'view'
                }
              ]
          })
        })
        .then(icwsDb.init)
        .then(setupSubscriptions)
        .then(function () { return Promise.resolve(icwsData.setup()); })
        .then(function (data) {

            startPolling();

            resolve(icws);
        })
        .catch(function (err) {
            logger.log('Failed to properly run icws', 'error', { error: err.toString() });
            reject(err);
        });
    });
}

module.exports = {
    stopPolling: stopPolling,
    run: run,
    getUsers: icwsData.getAgents,
    getInteractions: icwsData.getInteractions,
    getUserStats: icwsData.getAgentStats,
    getQueueStats: icwsData.getQueueStats,
};
