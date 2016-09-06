'use strict'

var _ = require('lodash');
var r = require('rethinkdb');
var Eventer = require('tiny-eventer').Eventer;

var _eventer = new Eventer();

var db = require('./../db');
var models = require('./../models/models');
var utils = require('./../utils');
var logger = require('./../logger');

var Interaction = models.models.Interaction;

/**
 * Statistics about the current (daily and weekly) queue.
 *
 * @type {{ csa: { queueTime: Number, queueLength: Number }, partnerService: { queueTime: Number, queueLength: Number } }}
 */
var __queueStats = null;

var __queue = [];
var CurrentQueue = Interaction.filter(
    r.row('inQueue')
    .and(r.row('isCurrent'))
);

/**
 * Listens to the current queue and keeps the queue stats up to date.
 */
function listen() {
    // Set the initial state.
    utils.setupItems(__queue, CurrentQueue, db.conn())
    .then(function (coll) {
        _eventer.trigger('updated', __queue);
        updateQueueStats();
        return CurrentQueue.changes().run(db.conn())
    })
    .then(function (cursor) {
        cursor.each(function (err, update) {
            if (err) {
                logger.log('Failed to get update', 'error', { name: 'CurrentQueue', error: err.toString() });
                _eventer.trigger('error', err);
            } else {
                // Update the queue
                utils.setItem(__queue, update, 'current queue');
                _eventer.trigger('updated', __queue);
                updateQueueStats();
            }

        });
    })
    .catch(function (err) {
        _eventer.trigger('error', err);
        logger.log('Failed to listen for changes', 'error', { name: 'CurrentQueue', error: err.toString() })
    });
}

/**
 * Updates the current queue stats and trigers 'stats-updated' if there's a change.
 */
function updateQueueStats() {
    var _stats = {
        csa: getQueueStat('CSA'),
        partnerService: getQueueStat('Partner Service'),
    };

    if (!utils.objectEquals(__queueStats, _stats)) {
        __queueStats = _stats;
        _eventer.trigger('stats-updated', __queueStats);
    }
}

/**
 * @param {String} queueName Name of the queue, ('CSA' or 'Partner Service')
 * @return {{ queueTime: Number, queueLength: Number }}
 */
function getQueueStat(queueName) {
    return _.chain(__queue)
        .filter({ workgroup: queueName })
        .orderBy('correctedQueueTime', 'desc')
        .map('correctedQueueTime')
        .thru(function (queueTimes) { return { queueTime: !!_.first(queueTimes) ? _.first(queueTimes) : 0, queueLength: queueTimes.length }; })
        .value();
}

module.exports =  {
    listen: listen,
    getQueueStats: function () { return __queueStats; },
    on: _eventer.on,
    /** @param {Function} callback */
    onStatsUpdated: function (callback) { return _eventer.on('stats-updated', callback); },
    /** @param {Function} callback */
    onUpdated: function (callback) { return _eventer.on('updated', callback); },
    /** @param {Function} callback */
    onError: function (callback) { return _eventer.on('error', callback); },
}


