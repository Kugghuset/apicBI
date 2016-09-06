'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var db = require('./../../middlehand/db');
var models = require('./../../middlehand/models/models');

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
        return items && items.length
            ? Interaction.get(items[0]._id).update(_interaction).run(db.conn())
            : Interaction.insert(_interaction).run(db.conn());
    })
    .catch(function (err) {
        console.log(err)

        if (silentFail) {
            return;
        } else {
            return Promise.reject(err);
        }

    })
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
        return items && items.length
            ? Agent.get(items[0]._id).update(_agent).run(db.conn())
            : Agent.insert(_agent).run(db.conn());
    })
    .catch(function (err) {
        console.log(err);

        if (silentFail) {
            return;
        } else {
            return Promise.reject(err);
        }
    })
}

/**
 * Initializes the DB and models.
 */
function init() {
    return db.init({ db: 'icws' })
    .then(models.init);
}

module.exports = {
    init: init,
    setInteraction: setInteraction,
    setAgent: setAgent,
}