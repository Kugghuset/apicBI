'use strict'

var _ = require('lodash');
var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var loki = require('lokijs');

var utils = require('./../../lib/utils');
var icwsUtils = require('./icws.utils');
var schedules = require('./icws.schedules');

var logger = require('./../../middlehand/logger');

var _dbPath = path.resolve(__dirname, '../../assets/icws-storage.json');
var _isLoaded = false;

// If there is no database file, create it
if (!fs.existsSync(_dbPath)) {
    logger.log('Creating local storage for icws in memory database.');
    fs.writeFileSync(_dbPath, '');
}

var _storage = new loki(_dbPath, { autosave: true, autosaveInterval: 100, autoloadCallback: onLoaded, autoload: true });

/**
 * @param {Error} [err]
 */
function onLoaded(err) {
    if (err) {
        logger.log('Failed to load in memory database.', 'error', { error: err.toString() });
    } else {
        logger.log('Database loaded automatically');
        _isLoaded = true;
        schedules.setup();
        setupWeekly();
        setupDaily();
    }
}

/**
 * Sets up all weekly events for collections.
 *
 * @return {void 0}
 */
function setupWeekly() {
    _storage.listCollections().forEach(function (item) {
        var name = item.name;

        // Set the scheduled removal.
        schedules.setWeekly(name, function () {
            var _coll = getCollection(name);

            // Remove documents which aren't current and older than a week.
            _coll.removeWhere(function (item) {
                return _.every([
                    !item.isCurrent,
                    moment().diff(new Date(item.meta.updated), 'days') > 7,
                ]);
            });

        });
    });

    schedules.setWeekly('weekly-icws-powerBi', function () {
        ClearTable.run('icws_weekly');
    });
}

/**
 * Sets up all daily events for collections
 *
 * @return {void 0}
 */
function setupDaily() {
    schedules.setDaily('daily-icws-powerBi', function () {
        ClearTable.run('icws_daily');
    });
}

/**
 * Returns the storage instance.
 *
 * Will instantiate if none exists.
 *
 * @return {Promise<Loki>}
 */
function init() {
    return new Promise(function (resolve, reject) {
        // Check if it's loaded already
        if (_isLoaded) {
            logger.log('Database is already loaded')
            return resolve(_storage);
        }

        // If there is no database file, create it
        if (!fs.existsSync(_dbPath)) {
            logger.log('Creating local storage for icws in memory database.', 'info', { path: _dbPath });
            fs.writeFileSync(_dbPath, '');
        }


        // Load the db from disk.
        _storage.loadDatabase({}, function (err) {
            if (err) {
                logger.log('Failed to set up in memory database', 'error', { error: err.toString() });
                return reject(err);
            }

            logger.log('Database loaded manually');

            _isLoaded = true;
            schedules.setup();
            setupWeekly();
            setupDaily();

            resolve(_storage);
        });
    });
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
        ? _storage.addCollection(name, { disableChangesApi: false })
        : _storage.getCollection(name);
}

/**
 * Gets the dynamic view at *name* from *coll*.
 *
 * If no dynamic view is foud at *name*, a new one
 * is created and returned.
 *
 * @param {LokiCollection<T>} coll
 * @param {String} name
 * @param {Function} [viewInit]
 * @return {LokiDynamicView<T>}
 */
function getView(coll, name, viewInit) {
    var _viewInit = _.isFunction(viewInit)
        ? viewInit
        : _.noop;

    // Get it's existance
    var _isNull = _.isNull(coll.getDynamicView(name));

    var _view = _isNull
        ? coll.addDynamicView(name)
        : coll.getDynamicView(name);

    if (!_isNull) {
        _view.removeFilters();
    }

    // Apply the initializations, if any
    _viewInit(_view);

    return _view;
}

module.exports = {
    init: init,
    getCollection: getCollection,
    getView: getView,
    storage: _storage,
    allCollections: function () {
        return {
            Interactions: icwsStorage.getCollection('interactions'),
            Agents: icwsStorage.getCollection('agents'),
            PushedPowerBi: icwsStorage.getCollection('pushedPowerBi'),
        };
    },
}
