'use strict'

if (!process.env.APP_NAME) {
    process.env.APP_NAME = 'utility';
}

var _ = require('lodash');
var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var loki = require('lokijs');

var logger = require('logger')

var _dbPath = path.resolve(__dirname, './assets/icws-storage.json');

var _isLoaded = false;

// If there is no database file, create it
if (!fs.existsSync(_dbPath)) {
    logger.log('Creating local storage for icws in memory database.');
    fs.writeFileSync(_dbPath, '');
}

var _storage = new loki(_dbPath, { autosave: true, autosaveInterval: 100, autoloadCallback: onLoaded, autoload: true });

function onLoaded(err) {
    if (err) {
        logger.log('Failed to load database from file', 'error', { error: err.toString()     });
    } else {
        logger.log('Database loaded');

        /** @type {LokiCollection<T>} */
        var PushedPowerBi = getCollection('pushedPowerBi');

        PushedPowerBi.removeWhere(function () { return true; });

        _storage.saveDatabase(function (err) {
            if (err) { logger.log('Failed to save database to file', 'error', { error: err.toString() }); }
            logger.log('PushedPowerBi cleaned, no data in db');

            process.exit();
        });
    }
}

/**
 * Gets the collection at *name*.
 *
 * If no collection matches *name*, a new is created
 * and returned.
 *
 * @param {String} name Name of the collection to get
 * @return {LokiCollection<T>}
 */
function getCollection(name) {
    return _.isNull(_storage.getCollection(name))
        ? _storage.addCollection(name)
        : _storage.getCollection(name);
}
