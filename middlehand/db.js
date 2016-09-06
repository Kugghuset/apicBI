'use strict'

var r = require('rethinkdb');

var config = require('./config');
var utils = require('./utils');
var logger = require('./logger');

var Eventer = require('tiny-eventer').Eventer;
var _eventer = new Eventer();

/** @type {rethinkdb~Connection} */
var _conn = null;

/**
 * @param {String} name
 * @return {Promise}
 */
function initDb(name) {
    return r.dbList().run(_conn)
    .then(function (dbs) {
        // If the db name already exists, use it and resolve
        if (utils.contains(dbs, name)) {
            logger.log('Not creating DB, it exists already', 'info', { name: name });
            return Promise.resolve();
        }

        logger.log('Creating DB' + { name: name });
        return r.dbCreate(name).run(_conn);
    })
    .then(function (output) {
        if (output) {
            logger.log('DB created' + name);
            // Use the created db and resolve
        }

        return Promise.resolve();
    });
}

/**
 * @param {String} name
 * @param {Object} [options]
 * @return {Promise}
 */
function initTable(name, options) {
    return r.db(config.db).tableList().run(_conn)
    .then(function (tables) {
        if (utils.contains(tables, name)) {
            logger.log('Not creating table, it already exists', 'info', { name: name });
            return Promise.resolve();
        }

        options = typeof options !== 'undefined' ? options : {};

        logger.log('Creating table', 'info', { name: name });
        return r.db(config.db).tableCreate(name, options).run(_conn);
    })
    .then(function (output) {
        if (output) {
            logger.log('Table created', 'info', { name: name });
        }

        return Promise.resolve();
    });
}

/**
 * @param {{ db: String }} context
 * @return {Promise}
 */
function init(context) {
    return r.connect({ host: config.host, port: config.db_port })
    .then(function (connection) {
        _conn = connection;

        if (!context.db) { context.db = 'test'; }

        return initDb(context.db);
    })
    .then(function () {
        _eventer.trigger('initialized');
        return Promise.resolve();
    })
}

function toArray(cursor) {
    return cursor.toArray;
}

module.exports = {
    conn: function () { return _conn; },
    setConnection: function (value) { _conn = value;  },
    initDb: initDb,
    initTable: initTable,
    init: init,
    table: function (name) { return r.db(config.db).table(name); },
    on: _eventer.on,
    off: _eventer.off,
    trigger: _eventer.trigger,
    toArray: toArray,
}
