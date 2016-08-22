'use strict'

var _ = require('lodash');
var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var loki = require('lokijs');

var utils = require('./../../lib/utils');

var _dbPath = path.resolve(__dirname, '../../assets/icws-storage.json');
var _isLoaded = false;

// If there is no database file, create it
if (!fs.existsSync(_dbPath)) {
  console.log('Creating local storage for icws in memory database.');
  fs.writeFileSync(_dbPath, '');
}

var _storage = new loki(_dbPath, { autosave: true, autosaveInterval: 100, autoloadCallback: onLoaded, autoload: true });

function onLoaded(err) {
  if (err) {
    console.log(err);
  } else {
    console.log('Database loaded');
    _isLoaded = true;

    var Interactions = _storage.getCollection('interactions');
  }
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
      console.log('Database is already loaded')
      return resolve(_storage);
    }

    // If there is no database file, create it
    if (!fs.existsSync(_dbPath)) {
      console.log('Creating local storage for icws in memory database.');
      fs.writeFileSync(_dbPath, '');
    }


    // Load the db from disk.
    _storage.loadDatabase({}, function (err) {
      if (err) {
        console.log('Something went wrong when setting up the database: ' + err.toString());
        return reject(err);
      }

      _isLoaded = true;

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
    ? _storage.addCollection(name)
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
}

