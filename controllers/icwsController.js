
var _ = require('lodash');
var Promise = require('bluebird');

var ICWS = require('../lib/icws');

var _icws;
var _interval;

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
    
    _icws.get('messaging/messages')
    .then(function (res) {
        
        var dataArr = res.body || [];
        
        var modifiedUsers = _.find(dataArr, function (data) { return _.get(data, '__type') === 'urn:inin.com:configuration.people:usersMessage' });
        
        if (modifiedUsers) {
            
            modifiedUsers.added = _.map(modifiedUsers.added, function (user) { return _.get(user, 'configurationId.id'); });
            modifiedUsers.changed = _.map(modifiedUsers.changed, function (user) { return _.get(user, 'configurationId.id'); });
            modifiedUsers.removed = _.map(modifiedUsers.removed, function (user) { return _.get(user, 'configurationId.id'); });
            
            // Filter out any removed users
            _users = _.filter(_users, function (user) { return ~modifiedUsers.removed.indexOf(user); })
            // Combine the added users with the existing users
            _users = _.uniq(_users.concat(modifiedUsers.added));
            
            console.log('There are now {num} users.'.replace('{num}', _users.length));
            
            // Update or create the queue subscription
            queueSub('subscribe', 'kugghuset-1', _users)
            .catch(function (res) { console.log(res) })
            // dataArr = _.filter(dataArr, function (data) { return _.get(data, '__type') != 'urn:inin.com:configuration.people:usersMessage' });
        }
        
        var statusUpdates = _.find(dataArr, function (data) { return _.get(data, '__type') === 'urn:inin.com:status:userStatusMessage'; });
        
        if (statusUpdates) {
            
            var updatedUsers = _.map(statusUpdates.userStatusList, function (userStatus) {
                return _.get(userStatus, 'userId');
            });
            
            updateUserStatuses(updatedUsers);
            
        }
        
        if (modifiedUsers && _users.length && _.isEqual({}, _usersByState)) {
            updateUserStatuses(_users);
        }
        
        console.log(JSON.stringify((dataArr || {}), null, 4));
        
    });
}

/**
 * Creates a subscription to *path* with *content*.
 * _L
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
        : 'kugghuset-1';
    
    var path = 'messaging/subscriptions/configuration/users/:id'
        .replace(':id', subId);
    
    console.log('Subscribing to configurations/users');
    
    return /unsub/i.test(action)
        ? unsubscribe(path)
        : subscribe(path, {
            configurationIds: [
                '*'
            ],
            properties: [
                'personalInformationProperties.emailAddress',
                'personalInformationProperties.givenName',
                'personalInformationProperties.surname',
                'clientConfigDateLastModified',
                'lastModifiedDate',
                'statusText'
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
        : 'kugghuset-1';
    
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

/**
 * 
 * 
 * @param {String} action Should be either 'subscribe' or 'unsubscribe'
 * @param {Array} _users
 * @return {Promise}
 */
function userStatusSub(action, _users) {
    
    var subPath = 'messaging/subscriptions/status/user-statuses';
    
    return /unsub/i.test(action)
        ? unsubscribe(subPath)
        : subscribe(subPath, {
            userIds: _.flatten(_users),
            rightsFilter: 'view',
            // userStatusProperties: [
            //     'personalInformationProperties.companyName',
            //     'personalInformationProperties.country',
            //     'personalInformationProperties.departmentName',
            //     'personalInformationProperties.emailAddress',
            //     'personalInformationProperties.givenName',
            //     'personalInformationProperties.surname',
            //     'statusText'
            // ]
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
function queueSub(action, subId, _users) {
    
    subId = !_.isUndefined(subId)
        ? subId
        : 'kugghuset-1';
    
    var queueIds = _.map(_users, function (user) { return { queueType: 1, queueName: user }; })
    
    var subPath = 'messaging/subscriptions/queues/:id'
        .replace(':id', subId)
    
    return /unsub/i.test(action)
        ? unsubscribe(subPath)
        : subscribe(subPath, {
            
            queueIds: queueIds,
            attributeNames: [
                'Eic_State',
                'Eic_ConnectDurationTime',
                'Eic_CallId',
                'Eic_RemoteName',
                'Eic_RemoteTn'
            ],
            
            rightsFilter: 'view'
            
        });
    
}

/**
 * Updates users in _usersByState which are in userIds
 * 
 * Docs here: https://developer.inin.com/documentation/Documents/ICWS/WebHelp/icws/(sessionId)/configuration/users/index.htm#get
 * 
 * @param {String} userIds
 * @return {Promise} -> {Array}
 */
function updateUserStatuses(userIds) {
    
    var userUrl = [
        'configuration/users/:id',
        [
            'rightsFilter=view',
            'select=statusText,lastModifiedDate,workgroups'
        ].join('&')
    ].join('?')
    
    var promises = _.map(userIds, function (userId) {
        return _icws.get(userUrl.replace(':id', userId));
    });
    
    Promise.all(_.map(promises, function (promise) { return promise.reflect(); }))
    .then(function (data) {
        
        var users = _.map(data, function (val) { return val.isRejected() ? val.reason() : (val.value() || {}).body; });
        
        _usersByState = _.chain(users)
            .map(function (user) {
                return {
                    id: _.get(user, 'configurationId.id'),
                    name: _.get(user, 'configurationId.displayName'),
                    status: _.get(user, 'statusText'),
                    lastModifiedDate: _.get(user, 'lastModifiedDate'),
                    workgroups: _.get(user, 'workgroups')
                };
            })
            .groupBy('status')
            .value();
        
    })
    
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
        
        var promises = [ userSub('subscribe', 'kugghuset-1'), workStationSub('subscribe', 'kugghuset-1') ];
        
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
        .then(function () {
          
          return _icws.put('messaging/subscriptions/statistics/statistic-values', {
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
        // .then(setupSubscriptions)
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
