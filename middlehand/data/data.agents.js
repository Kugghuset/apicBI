'use strict'

var _ = require('lodash');
var r = require('rethinkdb');
var Eventer = require('tiny-eventer').Eventer;

var _eventer = new Eventer();

var logger = require('./../logger');
var db = require('./../db');
var models = require('./../models/models');
var utils = require('./../utils');

var Agent = models.models.Agent;

/**
 * Array of accepted workgroups.
 *
 * @type {String[]}
 */
var __allowedWorkgroups = [
    'CSA',
    'Partner Service',
    // 'ZendeskTest', // possibly
];

/**
 * Array of not accepted workgroups.
 *
 * @type {String[]}
 */
var __disallowedWorkgroups = [];

/**
 * Data regarding agent availability.
 *
 * @type {{ csa: { agentCount: Number, availableAgentCount: Number }, partnerService: { agentCount: Number, availableAgentCount: Number }, total: { agentCount: Number, availableAgentCount: Number } }}
 */
var __agentStats = null;

var __agents = [];
var AvailableAgents = Agent.filter(
    r.row('isAvailable')
    .and(r.row('isCurrent'))
);

/**
 * Listens to the currently available agents and keeps the agent stats up to date.
 */
function listen() {
    utils.setupItems(__agents, AvailableAgents, db.conn())
    .then(function (coll) {
        _eventer.trigger('updated', __agents);
        updateAgentStats();
        return AvailableAgents.changes().run(db.conn());
    })
    .then(function (cursor) {
        cursor.each(function (err, update) {
            if (err) {
                logger.log('Failed to get update', 'error', { name: 'AvailableAgents', error: err.toString() });
                _eventer.trigger('error', err);
            } else {
                utils.setItem(__agents, update, 'availeble agents');
                _eventer.trigger('updated', __agents);
                updateAgentStats();
            }
        })
    })
    .catch(function (err) {
        _eventer.trigger('error', err);
        logger.log('Failed to listen for changes', 'error', { name: 'AvailableAgents', error: err.toString() })
    });
}

/**
 * Updats the current agent stats and on updated triggers 'stats-updated'
 */
function updateAgentStats() {
    var _stats = {
        csa: getAgentStat('CSA'),
        partnerService:  getAgentStat('Partner Service'),
        total: getAgentStat(),
    };

    if (!utils.objectEquals(__agentStats, _stats)) {
        __agentStats = _stats;
        _eventer.trigger('stats-updated', __agentStats);
    }
}

/**
 * @param {String} queueName
 * @return {{ agentCount: Number, availableAgentCount: Number }}
 */
function getAgentStat(queueName) {
    var _agents = !queueName
        ? __agents
        : __agents.filter(function (agent) { return hasWorkgroupsSpecial(agent, queueName); });

    return {
        agentCount: _agents.length,
        availableAgentCount: _agents.filter(function (agent) { return isAvailable(agent, queueName); }).length,
    };
}

/**
 * @param {{ loggedIn: Boolean, onPhone: Boolean, statusName: String, workgroups: { name: String }[] }} agent
 * @param {String[]|String} workgroups
 * @return {Boolean}
 */
function hasWorkgroupsSpecial(agent, workgroups) {
    if (_.isUndefined(workgroups)) {
        return true;
    }

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


module.exports = {
    listen: listen,
    getAgentStats: function () { return __agentStats; },
    on: _eventer.on,
    /** @param {Function} callback */
    onStatsUpdated: function (callback) { return _eventer.on('stats-updated', callback); },
    /** @param {Function} callback */
    onUpdated: function (callback) { return _eventer.on('updated', callback); },
    /** @param {Function} callback */
    onError: function (callback) { return _eventer.on('error', callback); },
}
