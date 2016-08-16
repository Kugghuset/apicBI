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

var _storage = new loki(_dbPath, { autosave: true, autosaveInterval: 1000 });

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
      return resolve(_storage);
    }

    // If there is no database file, create it
    if (!fs.existsSync(_dbPath)) {
      console.log('Creating local storage for icws in moemory database.');
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
 * @return {LokiCollection}
 */
function getCollection(name) {
  return _.isNull(_storage.getCollection(name))
    ? _storage.addCollection(name)
    : _storage.getCollection(name);
}

module.exports = {
  init: init,
  getCollection: getCollection,
  storage: _storage,
}
