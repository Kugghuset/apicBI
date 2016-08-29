'use strict'

var _ = require('lodash');

var db = require('./../db');

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
 * Initializes the agent table in the DB.
 */
function init() {
    db.initTable('interaction', { primaryKey: '_id', })
    .then(function () {
        console.log('interaction table initialized.');
    })
    .catch(function (err) {
        console.log('Failed to initialize interaction table: ' + err.toString());
    });
}

module.exports = _.assign(Interaction, { init: init });
