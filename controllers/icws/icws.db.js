'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var db = require('./../../middlehand/db');
var models = require('./../../middlehand/models/models');
var logger = require('./../../middlehand/logger');
var utils = require('./icws.utils');
var logStore = require('./icws.logStore');

var Interaction = models.models.Interaction;
var Agent = models.models.Agent;

/**
 * @param {{ id: String }} interaction
 * @param {Boolean} silentFail
 * @return {Promise}
 */
function setInteraction(interaction, silentFail) {
    // Get the interaction id
    var id = interaction.id;
    // Get the interaction without Loki.js attributes
    var _interaction = _.omit(interaction, [ '$loki', 'meta' ]);

    // Try to find the interaction
    return Interaction.filter({ id: id }).run(db.conn())
    .then(function (cursor) { return cursor.toArray() })
    .then(function (items) {
        logger.log('Setting interaction', 'verbose', { interactionId: id })
        return items && items.length
            ? Interaction.filter({ id: id }).update(_interaction).run(db.conn())
            : Interaction.insert(_interaction).run(db.conn());
    })
    .catch(function (err) {
        logger.log('Failed to set interaction', 'error', { error: err.toString(), interactionId: id });

        if (silentFail) {
            return;
        } else {
            return Promise.reject(err);
        }
    });
}

/**
 * @param {{ id: String }} agent
 * @param {Boolean} silentFail
 * @return {Promise}
 */
function setAgent(agent, silentFail) {
    // Get the agent ID
    var id = agent.id;

    // Get the agent without Loki.js attributes
    var _agent = _.omit(agent, [ '$loki', 'meta' ]);

    // Try find the agent
    return Agent.filter({ id: id }).run(db.conn())
    .then(function (cursor) { return cursor.toArray(); })
    .then(function (items) {
        logger.log('Setting agent', 'verbose', { agentId: id })
        return items && items.length
            ? Agent.filter({ id: id }).update(_agent).run(db.conn())
            : Agent.insert(_agent).run(db.conn());
    })
    .catch(function (err) {
        logger.log('Failed to set agent', 'error', { error: err.toString(), agentId: id });

        if (silentFail) {
            return;
        } else {
            return Promise.reject(err);
        }
    })
}

/**
 * Sets all rows where isCurrent === true to isCurrent = false.
 *
 * @param {Table} coll
 * @return {Promise}
 */
function resetIsCurrent(coll) {
    return coll.filter({ isCurrent: true }).update({ isCurrent: false }).run(db.conn());
}

/**
 * Initializes the DB and models.
 */
function init() {
    return db.init({ db: 'icws' })
    .then(models.init)
    .then(logStore.init)
    .then(function () {
        return utils.settle(_.map(_.omit(models.models, 'Log'), resetIsCurrent));
    });
}

module.exports = {
    init: init,
    setInteraction: setInteraction,
    setAgent: setAgent,
}