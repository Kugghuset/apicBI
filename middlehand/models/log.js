'use strict'

var _ = require('lodash');

var db = require('./../db');
var logger = require('./../logger');

var Log = db.table('log');

/**
 * Initializes the log table in the DB.
 */
function init() {
    return db.initTable('log', { primaryKey: 'log_id', })
    .then(function () {
        logger.log('Table initialized.', 'info', { name: 'log' });
        return Promise.resolve();
    })
    .catch(function (err) {
        logger.log('Failed to initialize table', 'error', { name: 'log', error: err.toString() });
        return Promise.reject(err);
    });
}

module.exports = _.assign(Log, { init: init });
