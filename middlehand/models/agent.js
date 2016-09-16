'use strict'

var _ = require('lodash');

var db = require('./../db');
var logger = require('./../logger');

var Agent = db.table('agent');

/**
 * @type {{ id: String, name: String, statusName: String, lastLocalChange: Date, workgroups: { id: String, name: String }[], isAvailableCsa: Boolean, isAvailablePartnerService: Boolean, loggedIn: Boolean, onPhone: Boolean, switches: { onPhone: Boolean, loggedIn: Boolean, isCurrent: Boolean }, stations: String[], isCurrent: Boolean }}
 */
var __agent = null;

var schema = {
    id: String,
    name: String,
    statusName: String,
    lastLocalChange: Date,
    workgroups: [
        {
            id: String,
            name: String,
        },
    ],
    isAvailableCsa: Boolean,
    isAvailablePartnerService: Boolean,
    loggedIn: Boolean,
    onPhone: Boolean,
    switches: {
        onPhone: Boolean,
        loggedIn: Boolean,
        isCurrent: Boolean,
    },
    stations: [
        String,
    ],
    isCurrent: Boolean,
};

/**
 * Initializes the agent table in the DB.
 *
 * @return {Promise}
 */
function init() {
    return db.initTable('agent', { primaryKey: '_id', })
    .then(function () {
        logger.log('Table initialized.', 'info', { name: 'agent' });
        return Promise.resolve();
    })
    .catch(function (err) {
        logger.log('Failed to initialize table', 'error', { name: 'agent', error: err.toString() });
        return Promise.reject(err);
    });
}

module.exports = _.assign(Agent, { init: init });
