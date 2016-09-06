'use strict'

var _ = require('lodash');

var db = require('./../db');
var logger = require('./../logger');

var Interaction = db.table('interaction');

/**
 * @type {{ id: String, type: String, callType: String, callDirection: String, remoteAddress: String, remoteId: String, remoteName: String, duration: String, state: String, stateVal: String, workgroup: String, userName: String, startDate: Date, endDate: Date, queueDate: Date, answerDate: Date, connectedDate: Date, isCurrent: Boolean }} Interaction
 */
var __interaction = null;

var schema = {
    id: String,
    type: String,
    callType: String,
    callDirection: String,
    remoteAddress: String,
    remoteId: String,
    remoteName: String,
    duration: String,
    state: String,
    stateVal: String,
    workgroup: String,
    userName: String,
    startDate: Date,
    endDate: Date,
    queueDate: Date,
    answerDate: Date,
    connectedDate: Date,
    isCurrent: Boolean,
};

/**
 * Initializes the interaction table in the DB.
 */
function init() {
    return db.initTable('interaction', { primaryKey: '_id', })
    .then(function () {
        logger.log('Table initialized.', 'info', { name: 'interaction' });
        return Promise.resolve();
    })
    .catch(function (err) {
        logger.log('Failed to initialize table', 'error', { name: 'interaction', error: err.toString() });
        return Promise.reject(err);
    });
}

module.exports = _.assign(Interaction, { init: init });
