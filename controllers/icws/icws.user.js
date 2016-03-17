'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var icwsSub = require('./icws.sub');

/**
 * The __types to watch changes for.
 *
 * The keys matches function used for processing the data,
 * and the values matches the __type properties from ININ.
 */
var _typeIds = {
    updateUsers: 'urn:inin.com:configuration.people:usersMessage',
    updateStatuses: 'urn:inin.com:status:userStatusMessage'
}

// The complete list of users
var _users = [];

/**
 * All watcher methods, exactly matching the keys of _typeIds
 * to allow watch(...) to call any only via the key found from _typeIds.
 */
var watchers = {
    updateUsers: updateUsers,
    updateStatuses: updateStatuses,
}

/**
 * @param {Array} dataArr The array retuerned from polling
 */
function watch(dataArr) {
    // Find all functions to call
    var toCall = _.chain(_typeIds)
        .map(function (__type, key) {
            var _data = _.find(dataArr, function (data) { return _.get(data, '__type') === __type });
            return !!_data
                ? [[key], [_data]]
                : undefined;
        })
        .filter()
        .thru(function (_data) { return _.zipObject(_data) })
        .value();


    console.log(toCall);

    // Call every watcher wich was matched
    // _.forEach(toCall, function (val, key) { watchers[key](val); })

}

/**
 * @param {Object} data The raw data received from ININ
 */
function updateUsers(data) {

}

/**
 * @param {Object} data The raw data received from ININ
 */
function updateStatuses(data) {

}

module.exports = {
    watch: watch
}
