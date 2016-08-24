'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var icwsSub = require('./icws.sub');
var icwsStorage = require('./icws.storage');


/** @type {LokiCollection<T>} */
var Agents = icwsStorage.getCollection('agents');
/** @type {LokiDynamicView<T>} */
var AgentsInfoView = icwsStorage.getView(Agents, 'agentInfo', _.noop);

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

/**
 * Array of accepted workgroups.
 *
 * @type {String[]}
 */
var __acceptedWorkgroups = [
    'CSA',
    'Partner Service',
    // 'ZendeskTest', // possibly
];

/**
 * Array of not accepted workgroups.
 *
 * @type {String[]}
 */
var __disallowedWorkgroups = [
];

/**
 * Data regarding agent availability.
 */
var __userInfo = {
    csa: { agentCount: 0, availableAgentCount: 0 },
    partnerService: { agentCount: 0, availableAgentCount: 0 },
    total: { agentCount: 0, availableAgentCount: 0 },
};

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

        updateUserInfo();
    }
}

/**
 * Updates the current user info (availability).
 */
function updateUserInfo() {
    __userInfo = {
        csa: getAgentInfo(['CSA']),
        partnerService: getAgentInfo(['Partner Service']),
        total: getAgentInfo(__acceptedWorkgroups),
    };
}

/**
 *
 * @param {String[]|String} workgroups
 * @return {{ agentCount: Number, availableAgentCount: Number }}
 */
function getAgentInfo(workgroups) {
    var _agents = Agents.where(function (agent) {
        return _.every([
            agent.isCurrent,
            hasWorkgroupsSpecial(agent, workgroups),
        ]);
    });

    return {
        agentCount: _agents.length,
        availableAgentCount: _.filter(_agents, function (agent) { return isAvailable(agent, workgroups); }).length,
    };
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

        // If there is a user and a persisted user.
        if (_agent) {
            // Apply updates
            _agent = _.assign(_agent, user, _updates);
            Agents.update(_agent);
        }
    });

    // If there are any updated statuses, update the user info.
    if (_.some(_statUsers)) {
        updateUserInfo();
    }
}

/**
 * Returns true or false for whether the agent is considered available or not.
 *
 * @param {{ loggedIn: Boolean, onPhone: Boolean, statusName: String, workgroups: { name: String }[] }} agent
 * @return {Boolean}
 */
function getAvailability(agent) {
    return _.assign({}, agent, {
        isAvailableCsa: isAvailable(agent, ['CSA']),
        isAvailablePartnerService: isAvailable(agent, ['Partner Service']),
        isAvailable: isAvailable(agent, __acceptedWorkgroups),
    });
}

/**
 * Returns true or false for whether the agent is considered available or not.
 *
 * @param {{ loggedIn: Boolean, onPhone: Boolean, statusName: String, workgroups: { name: String }[] }} agent
 * @param {String[]|String} workgroups
 * @return {Boolean}
 */
function isAvailable(agent, workgroups) {
    return _.every([
        // Must be logged in
        agent.loggedIn,
        // Must not be on the phone
        !agent.onPhone,
        // The status must be 'Available'
        agent.statusName === 'Available',
        // Filter out any incorrect workgroups
        hasWorkgroupsSpecial(agent, workgroups),
    ]);
}

/**
 * Returns true or false for whether *agent* contains any *workgroups*.
 *
 * @param {{ workgroups: { name: String }[] } | { name: String }[]} agent
 * @param {String[]|String} workgroups
 * @return {Boolean}
 */
function hasWorkgroups(agent, workgroups) {
    var _agentWorkgroups = _.isArray(agent)
        ? agent
        : agent.workgroups;

    var _workgroups = _.isArray(workgroups)
        ? workgroups
        : [ workgroups ];

    return _.some(_workgroups, function (wg) { return !!_.find(_agentWorkgroups, { name: wg }) });
}

/**
 * @param {{ loggedIn: Boolean, onPhone: Boolean, statusName: String, workgroups: { name: String }[] }} agent
 * @param {String[]|String} workgroups
 * @return {Boolean}
 */
function hasWorkgroupsSpecial(agent, workgroups) {
    var _workgroups = _.isArray(workgroups)
        ? workgroups
        : [ workgroups ];

    // When there's a single workgroup and it is 'CSA', agents in 'Partner Service' are not in 'CSA'.
    var _cases = [
        _workgroups.length === 1,
        _workgroups[0] === 'CSA',
        hasWorkgroups(agent, ['Partner Service']),
    ];

    // Sales finland isn't okey at all.
    if (hasWorkgroups(agent, __disallowedWorkgroups)) {
        return false;
    }

    // Special rules for non Parter Service calls
    if (_.every(_cases)) {
        return false;
    }

    return hasWorkgroups(agent, _workgroups);
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
 * Sets up the stored agents.
 */
function setupStorage() {
    Agents = icwsStorage.getCollection('agents');
    AgentsInfoView = icwsStorage.getView(Agents, 'agentInfo', function (view) {
        /** @type {LokiDynamicView<T>} */
        var _view = view;

        _view.applyWhere(function (agent) {
            return _.every([
                agent.isCurrent,
                hasWorkgroups(agent, __acceptedWorkgroups),
            ]);
        }, 'filterTotal');

        return _view;
    });

    Agents.findAndUpdate(function () { return true; }, function (agent) {
        return _.assign(item, { isCurrent: false, });
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

    setupStorage();

    return userListSub('subscribe', subId);
}

module.exports = {
    watch: watch,
    setup: setup,
    getUsers: function () {
        return Agents.where(function (item) {
            return _.every([
                item.isCurrent,
                hasWorkgroupsSpecial(item, __acceptedWorkgroups),
            ]);
        }).map(function (item) { return _.omit(item, ['$loki', 'meta']); });
    },
    getUserInfo: function () {
        return __userInfo;
    },
}
