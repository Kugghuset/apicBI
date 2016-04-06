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
    updateStatuses: 'urn:inin.com:status:userStatusMessage',
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
}

/**
 * Handles user updates.
 *
 * @param {Object} data The raw data received from ININ
 */
function updateUsers(data) {
    // Get all added users
    var _added = _.map(data.added, function (user) {
        return {
            id: _.get(user, 'configurationId.id'),
            name: _.get(user, 'configurationId.displayName'),
            statusName: _.get(user, 'statusText'),
        }
    });

    // Get all removed users
    var _removed = _.map(data.removed, function (user) { return _.get(user, 'configurationId.id'); })

    var _changed = _.map(data.changed, function (user) {
        return {
            id: _.get(user, 'configurationId.id'),
            name: _.get(user, 'configurationId.displayName'),
            statusName: _.get(user, 'statusText'),
        }
    });

    // Check if there are any changes in any of the arrays
    if (_.some([_added, _removed, _changed], _.some)) {
        // Update users if there's been a change
        _users = _.chain(_users)
            // Filter out any removed users
            .filter(function (user) { return !!~_removed.indexOf(user.id); })
            // Filter out any modified users, as to not have duplicate entries
            .filter(function (user) { return !_.find(_changed, { id: user.id }) })
            // Get the complete list of users
            .thru(function (users) { return users.concat(_added, _changed); })
            .value();

        console.log('There are now {num} users!'.replace('{num}', _users.length));

        // Get the ids to added users and, if any, subscribe to their statuses
        var _addedIds = _.map(_added, 'id');
        if (_.some(_addedIds)) {
            userStatusSub('subscribe', _addedIds);
        }

        // If any removed, unsubscribe to their statuses
        if (_.some(_removed)) {
            userStatusSub('unsubscribe', _removed);
        }
    }
}

/**
 * Attaches/updats the status data of
 *
 * @param {Object} data The raw data received from ININ
 */
function updateStatuses(data) {
    // Get the changes
    var _statUsers = _.map(data.userStatusList, function (user) {
      return {
          id: user.userId,
          statusName: user.statusId,
          loggedIn: user.loggedIn,
          onPhone: user.onPhone,
          stations: user.stations,
      }
    });

    // Update all users
    _.forEach(_statUsers, function (user) {
        // Find the user to update
        var _user = _.find(_users, { id: user.id });

        // Assign the changes to *_user* if it exists
        if (_user) {
            _user = _.assign(_user, user);
            console.log('{user} changed, {status}.'.replace('{user}', _user.id).replace('{status}', _user.statusName));
        }
    });
}

/*****************
 * Subscriptions
 *****************/

/**
 * Subscribes or unsubscribes to updates to the user list.
 *
 * @param {String} action The action to take, should be either subscribe or unsubscribe. Defaults to subscribe
 * @param {String} subId Subscription ID string, defaults to 'kugghuset-1'
 */
function userListSub(action, subId) {
    // Use default value of subId if undefined
    subId = !_.isUndefined(subId)
        ? subId
        : 'kugghuset-1';

    var path = 'messaging/subscriptions/configuration/users/:id'
        .replace(':id', subId);

    console.log('Subscribing to the list of user in configurations/users');

    return /unsub/i.test(action)
        ? icwsSub.unsubscribe(path)
        : icwsSub.subscribe(path, {
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
 * Subscribes to the statuses of all *_user*.
 *
 * @param {String} action Should be either 'subscribe' or 'unsubscribe'
 * @param {Array} users The users to take action on
 * @return {Promise}
 */
function userStatusSub(action, users) {

    var subPath = 'messaging/subscriptions/status/user-statuses';

    console.log('Subscribing to {num} users\' statuses.'.replace('{num}', users.length));

    return /unsub/i.test(action)
        ? icwsSub.unsubscribe(subPath)
        : icwsSub.subscribe(subPath, {
            userIds: users
        });
}

/**
 * Sets the user subscriptions up.
 *
 * @param {String} subId Subscription ID string, defaults to 'kugghuset-1'
 * @return {Promise}
 */
function setup(subId) {
    // Use default value of subId if undefined
    subId = !_.isUndefined(subId)
        ? subId
        : 'kugghuset-1';

    return userListSub('subscribe', subId);
}

module.exports = {
    watch: watch,
    setup: setup,
}
