
var _ = require('lodash');
var Promise = require('bluebird');

var ICWS = require('../lib/icws');

var _icws;
var _interval;

/**
 * Polls the messaging route for new data
 * and handles new data for various endpoints.
 * 
 * @return void
 */
function poll() {
    
    _icws.get('messaging/messages')
    .then(function (res) {
        
        var dataArr = res.body || [];
        
        console.log(JSON.stringify(dataArr, null, 4));
        
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
    return _icws.put(path, body);
}

/**
 * Deletes a subscriptoin to *path*
 * 
 * @param {String} path
 * @return {Promise}
 */
function unsubscribe(path) {
    return _icws.delete(path);
}

/**
 * Either subscribes to or unsubscribes to the
 * 
 * @param {String} action
 * @return {Promise}
 */
function userSub(action, subId) {
    
    subId = !_.isUndefined(subId)
        ? subId
        : 1;
    
    var path = 'messaging/subscriptions/configuration/users/:id'
        .replace(':id', subId);
    
    return /unsub/i.test(action)
        ? unsubscribe(path)
        : subscribe(path, {
            configurationIds: [
                '*'
            ],
            properties: [
                'personalInformationProperties.emailAddress',
                'personalInformationProperties.givenName',
                'personalInformationProperties.surname'
            ],
            rightsFilter: 'view'
        });
    
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
        : 1;
    
    var path = 'messaging/subscriptions/configuration/workgroups/:id'
        .replace(':id', subId)
    
    return /unsub/i.test(action)
        ? unsubscribe(path)
        : subscribe(path, {
            configurationIds: [
                 {
                     id: 'CSA'
                 }
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
    
    var icws = _icws;
    
    if (!icws) {
        // Definde both as neither are defined.
        _icws = icws = new ICWS();
    }
    
    return icws.getAuthenticated();
}

/**
 * Sets up the subscriptions to all items of intereset.
 * 
 * @return {Promise} -> {String} (Will be empty)
 */
function setupSubscriptions() {
    return new Promise(function (resolve, reject) {
        
        var promises = [ userSub('subscribe', 1), workStationSub('subscribe', 1) ];
        
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
        console.log('Polling already actives.');
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
        .then(setupSubscriptions)
        .then(function (data) {
            
            startPolling();
            
            resolve(_icws);
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
