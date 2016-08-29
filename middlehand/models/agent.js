'use strict'

var _ = require('lodash');

var db = require('./../db');

var Agent = db.table('agent');

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

function listen(callback) {
    Agent.changes().run(db.conn(), function (err, cursor) {
        if (err) { callback(err); }
        else { cursor.each(callback); }
    });
}

/**
 * Initializes the agent table in the DB.
 *
 * @return {Promise}
 */
function init() {
    return db.initTable('agent', { primaryKey: '_id', })
    .then(function () {
        console.log('agent table initialized.');
        return Promise.resolve();
    })
    .catch(function (err) {
        console.log('Failed to initialize agent table: ' + err.toString());
        return Promise.reject(err);
    });
}

module.exports = _.assign(Agent, { init: init, listen: listen });
