'use strict'

var db = require('./../db');

db.on('initialized', function () {
    db.initTable('interaction', { primaryKey: '_id', })
    .then(function () {
        console.log('interaction table initialized.');
    })
    .catch(function (err) {
        console.log('Failed to initialize interaction table: ' + err.toString());
    });
});

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

module.exports = Interaction;
