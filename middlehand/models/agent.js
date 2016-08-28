'use strict'

var db = require('./../db');

var Agent = db.table('agent');

db.on('initialized', function () {
    db.initTable('agent', { primaryKey: '_id', })
    .then(function () {
        console.log('agent table initialized.');
    })
    .catch(function (err) {
        console.log('Failed to initialize agent table: ' + err.toString());
    });
});

/**
 * @type {{ id: String, name: String, statusName: String, lastLocalChange: Date, workgroups: { id: String, name: String }[], isAvailableCsa: Boolean, isAvailablePartnerService: Boolean, loggedIn: Boolean, onPhone: Boolean, stations: String[], isCurrent: Boolean }}
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
    stations: [
        String,
    ],
    isCurrent: Boolean,
};

module.exports = Agent;
