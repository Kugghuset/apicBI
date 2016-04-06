'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var ICWS = require('../lib/icws');

var icws = require('../lib/icwsModule');
var _interval;

var icwsUser = require('./icws/icws.user');

// All users in the system
var _users = [];

// Users grouped by their state
var _usersByState = {};

/**
 * Polls the messaging route for new data
 * and handles new data for various endpoints.
 *
 * @return void
 */
function poll() {

    icws.get('messaging/messages')
    .then(function (res) {

        var dataArr = !!res.body
            ? res.body
            : res;

        // Watch for, and handles changes regarding users
        icwsUser.watch(dataArr);

        // var _data = _.find(dataArr, function (data) { return _.get(data, '__type') === 'urn:inin.com:queues:queueContentsMessage'; });
        // _data = dataArr;

        var _workStationData = _.find(dataArr, function (data) { return _.get(data, '__type') === 'urn:inin.com:configuration.people:workgroupsMessage'; });
        var _queueData = _.find(dataArr, function (data) { return _.get(data, '__type') === 'urn:inin.com:queues:queueContentsMessage'; });

        if (_workStationData) {
            console.log(JSON.stringify(_workStationData.added, null, 4));
            queueSub('subscribe', 'kugghuset-1', _.map(_workStationData.added, function (data) { return { id: _.get(data, 'configurationId.id') }; }));
        }

        if (_queueData) {
            console.log(JSON.stringify(_queueData, null, 4));
        }
    });
}

/**
 * Creates a subscription to *path* with *content*.
 *
 * @param {String} path
 * @param {Object} body
 * @return {Promise}
 */
function subscribe(path, body) {
    return icws.put(path, body);
}

/**
 * Deletes a subscriptoin to *path*
 *
 * @param {String} path
 * @return {Promise}
 */
function unsubscribe(path) {
    return icws.delete(path);
}

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
        ? unsubscribe(path)
        : subscribe(path, {
            configurationIds: [
                // {
                //     id: 'CSA',
                // },
                '*'
            ],
            properties: [
                'hasQueue',
                'isActive',
                'isWrapUpActive',
                'isCallbackEnabled',
                'isAcdEmailRoutingActive'
            ],
            rightsFilter: 'view'
        });
}


/**
 * Subscribes to all queus for *_users*
 *
 * NOT WORKING
 *
 * @param {String} action Should be either 'subscribe' or 'unsubscribe'
 * @param {String|Number} subId
 * @param {Array} _users The user ids (firstname.lastname) to listen for.
 * @return {Promise}
 */
function queueSub(action, subId, users) {

    subId = !_.isUndefined(subId)
        ? subId
        : 'kugghuset-1';

    /**
     * When queueType is set to 0, a single messages will be recieved, but with no added interactions.
     */

    // Get all queueIds to subscrube to
    // var queueIds = _.map(users, function (user) { return { queueType: 2, queueName: (user.id || user) }; })

    var subPath = 'messaging/subscriptions/queues/:id'
        .replace(':id', subId)

    console.log('Subscribing to {name} queue!'.replace('{name}', 'CSA'));

    return /unsub/i.test(action)
        ? unsubscribe(subPath)
        : subscribe(subPath, {

            queueIds: {
                queueType: 2,
                queueName: 'CSA'
            },
            attributeNames: [
                'Eic_State',
                'Eic_ConnectDurationTime',
                'Eic_CallId',
                'Eic_RemoteName',
                'Eic_RemoteTn',
                'Eic_WorkgroupName',
                'Eic_InitiationTime',
                'Eic_TerminationTime',
            ],
            rightsFilter: 'view',
        });
}

/***************
 *
 * Exported functions.
 *
 **************/

/**
 * Returns a promise of an initialized (authenticated) icws object.
 *
 * @return {Promise} -> {Object}
 */
function init() {
    return icws.auth();
}

/**
 * Sets up the subscriptions to all items of intereset.
 *
 * @return {Promise} -> {String} (Will be empty)
 */
function setupSubscriptions() {
    return new Promise(function (resolve, reject) {

        var promises = [ icwsUser.setup(), workStationSub('subscribe', 'kugghuset-1') ];

        Promise.all(_.map(promises, function (promise) { return promise.reflect(); }))
        .then(function (data) {

            resolve(_.map(data, function (val) { return val.isRejected() ? undefined : val.value(); }))
        });

    });
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
        console.log('Start polling ICWS server');
        _interval = setInterval(poll, ms)
    } else {
        console.log('Polling already active.');
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
        console.log('Stop polling the ICWS server');
        clearInterval(_interval);
    } else {
        console.log('Cannot stop polling, nothing to stop.');
    }

    _interval = undefined;
}

/**
 * Initializes the ICWS object, sets up subscriptions
 * and starts polling the ICWS server.
 *
 * Returns a Promise of the ICWS object.
 *
 * TODO:
 *      - Add more subscriptions
 *      - Add handlers for new data and their respsective datatypes
 *
 * @return {Promise}
 */
function run() {
    return new Promise(function (resolve, reject) {

        init()
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
        .then(setupSubscriptions)
        .then(function (data) {

            startPolling();

            resolve(icws);
        })
        .catch(function (err) {
            console.log(err);
            reject(err);
        })

    });
}

module.exports = {
    init: init,
    setupSubscriptions: setupSubscriptions,
    startPolling: startPolling,
    stopPolling: stopPolling,
    run: run
};
