'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var icwsSub = require('./icws.sub');
var icwsStorage = require('./icws.storage');
var icwsData = require('./icws.data');
var icwsUtils = require('./icws.utils');
var icwsDb = require('./icws.db');

var config = require('./../../configs/database');

/** @type {LokiCollection<T>} */
var Agents = icwsStorage.getCollection('agents');

/**
 * The __types to watch changes for.
 *
 * The keys matches function used for processing the data,
 * and the values matches the __type properties from ININ.
 */
var __typeIds = {
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
    var toCall = _.chain(__typeIds)
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

    pushChanges();
}

/**
 * Handles user updates.
 *
 * @param {Object} data The raw data received from ININ
 */
function updateUsers(data) {
    // Get all added users
    var _added = _.chain(data.added)
        .map(function (user) {
            return {
                id: _.get(user, 'configurationId.id'),
                name: _.get(user, 'configurationId.displayName'),
                statusName: _.get(user, 'statusText'),
                lastLocalChange: new Date(),
                workgroups: _.map(_.get(user, 'workgroups'), function (wg) { return { id: wg.id, name: wg.displayName } }),
            }
        })
        .map(getAvailability)
        .value();

    // Get all removed users
    var _removed = _.map(data.removed, function (user) { return _.get(user, 'configurationId.id'); })

    var _changed = _.chain(data.changed)
        .map(function (user) {
            return {
                id: _.get(user, 'configurationId.id'),
                name: _.get(user, 'configurationId.displayName'),
                statusName: _.get(user, 'statusText'),
                lastLocalChange: new Date(),
                workgroups: _.map(_.get(user, 'workgroups'), function (wg) { return { id: wg.id, name: wg.displayName } }),
            };
        })
        .map(getAvailability)
        .value();

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

        // Add or update users to the db.
        _.forEach(_added.concat(_changed), function (user) {
            var _agent = Agents.findOne({ id: _.toString(user.id) });

            if (_agent) {
                // There's an existing user, update it
                _agent = _.assign(_agent, user);
                Agents.update(_agent);
            } else {
                // Insert the new user!
                Agents.insert(user);
            }
        });

        // If any removed, unsubscribe to their statuses
        if (_.some(_removed)) {
            Agents.findAndUpdate(function (agent) {
                return !!_.find(_removed, { configuration: { id: agent.id } });
            }, function (agent) {
                return _.assign(agent, { isCurrent: true });
            });

            userStatusSub('unsubscribe', _removed);
        }

        icwsData.updateAgentInfo();
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

        // Find the persisted user
        var _agent = Agents.findOne({ id: _.toString(user.id) });

        // Get a joined user for checking availability
        var _isAvailableUser = _.assign({}, user, { workgroups: _user.workgroups });

        // Get the calculated updates
        var _updates = _.assign({}, {
            lastLocalChange: new Date(),
            isCurrent: true,
        }, getAvailability(_isAvailableUser));

        // Assign the changes to *_user* if it exists
        if (_user) {
            // Update the user
            _user = _.assign(_user, user, _updates);
        }

        var _updated = _.assign({}, user, _updated);

        var _isUpdated = !icwsUtils.objectEquals(_agent, _.assign({}, _agent, _updated));

        // If there is a user and a persisted user.
        if (_agent && _isUpdated) {
            // Apply updates
            _agent = _.assign(_agent, user, _updates);
            Agents.update(_agent);
        }
    });

    // If there are any updated statuses, update the user info.
    if (_.some(_statUsers)) {
        icwsData.updateAgentInfo();
    }
}

/**
 * Pushes any changes to the RethinkDB instance.
 */
function pushChanges() {
    _.chain(Agents.getChanges())
        .groupBy('obj.id')
        // Get only one of the objects
        .map(function (items) {
            // If there's only a single object, return it
            if (items.count === 1) {
                return items[0];
            }

            // Return either the deleted item or the first item.
            return _.some(items, { operation: 'R' })
                ? _.find(items, { operation: 'R' })
                : items[0];
        })
        .forEach(function (item) {
            // If the interaction was removed, disable it in the DB.
            // Otherwise find it and update or insert it
            var _agent = item.operation !== 'R'
                ? Agents.findOne({ id: item.obj.id })
                : _.assign({}, item.obj, { isDisabled: true });

            icwsDb.setAgent(_agent, true);
        })
        .value();
}

/**
 * Returns true or false for whether the agent is considered available or not.
 *
 * @param {{ loggedIn: Boolean, onPhone: Boolean, statusName: String, workgroups: { name: String }[] }} agent
 * @return {{ loggedIn: Boolean, onPhone: Boolean, statusName: String, workgroups: { name: String }[], isAvailable: Boolean, isAvailableCsa: Boolean, isAvailablePartnerService: Boolean }}
 */
function getAvailability(agent) {
    return _.assign({}, agent, {
        isAvailableCsa: icwsData.agentIsAvailable(agent, ['CSA']),
        isAvailablePartnerService: icwsData.agentIsAvailable(agent, ['Partner Service']),
        isAvailable: icwsData.agentIsAvailable(agent, icwsData.getAllowedWorkgroups()),
    });
}

/*********************
 * ICWS subscriptions
 *********************/

/**
 * Subscribes or unsubscribes to updates to the user list.
 *
 * @param {String} action The action to take, should be either subscribe or unsubscribe. Defaults to subscribe
 * @param {String} subId Subscription ID string, defaults to config.icws_sub_id
 */
function userListSub(action, subId) {
    // Use default value of subId if undefined
    subId = !_.isUndefined(subId)
        ? subId
        : config.icws_sub_id;

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
                'statusText',
                'workgroups',
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
 * @param {String} subId Subscription ID string, defaults to config.icws_sub_id
 * @return {Promise}
 */
function setup(subId) {
    // Use default value of subId if undefined
    subId = !_.isUndefined(subId)
        ? subId
        : config.icws_sub_id;

    Agents = icwsStorage.getCollection('agents');

    return userListSub('subscribe', subId);
}

module.exports = {
    watch: watch,
    setup: setup,
}
