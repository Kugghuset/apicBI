'use strict'

var r = require('rethinkdb');

var config = require('./config');
var utils = require('./utils');

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
            console.log('Existing db: ' + name);
            return Promise.resolve();
        }

        console.log('Creating db: ' + name);
        return r.dbCreate(name).run(_conn);
    })
    .then(function (output) {
        if (output) {
            console.log('Created db: ' + name);
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
            console.log('Not creating table, already exists: ' + name);
            return Promise.resolve();
        }

        options = typeof options !== 'undefined' ? options : {};

        console.log('Creating table: ' + name);
        return r.db(config.db).tableCreate(name, options).run(_conn);
    })
    .then(function (output) {
        if (output) {
            console.log('Table created: ' + name);
        }

        return Promise.resolve();
    });
}

/**
 * @param {{ db: String }} context
 * @return {Promise}
 */
function init(context) {
    return r.connect({ host: config.host, port: config.port })
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
}
