'use strict'

var Promise = require('bluebird');
var _ = require('lodash');

var logger = require('./logger');

/**
 * @param {Array} coll
 * @param {any} item
 * @return {Boolean}
 */
function contains(coll, item) {
    return Array.isArray(coll) ? !!~coll.indexOf(item) : false;
}

/**
 * @param {Promise[]|Promise} items
 * @return {Promise[]|Promise}
 */
function reflect(items) {
  return _.isArray(items)
    ? _.map(items, function (item) { return _.isFunction(item.reflect) ? item.reflect() : Promise.resolve(item).reflect() })
    : _.isFunction(items.reflect) ? items.reflect() : Promise.resolve(items).reflect();
}

/**
 * @param {Promise[]} promises
 * @return {Promise<[]>}
 */
function settle(promises) {
  return Promise.all(_.map(promises, reflect))
  .then(function (vals) {
    return Promise.resolve(_.map(vals, function (val) { return val.isRejected() ? val.reason() : val.value(); }))
  });
}

/**
 * @param {[]} coll
 * @param {Query} query
 * @return {Promise<{}[]>}
 */
function setupItems(coll, query, conn) {
    return query.run(conn)
    .then(function (cursor) { return cursor.toArray(); })
    .then(function (items) {
        // Push all current data.
        coll.push.apply(coll, items);
        return Promise.resolve(coll);
    });
}

/**
 * @param {{ id: String }[]} coll
 * @param {{ old_val: { id: String }, new_val: { id: String } }} update
 * @param {String} [collName]
 */
function setItem(coll, update, collName) {
    // Get the values
    var _new = update.new_val;
    var _old = update.old_val;

    if (_.isNull(_old)) {
        coll.push(_new);
        logger.log('Added item to collection', 'debug', { name: collName, id: _new.id, _id: _new._id });
    } else if (_.isNull(_new)) {
        var _index = _.findIndex(coll, { id: _old.id, _id: _old._id });

        if (_index < 0) {
            logger.log('Failed to find item', 'info', { id: _old.id, _id: _old._id });
            return;
        }

        coll.splice(_index, 1);
        logger.log('Removed item from collection', 'debug', { name: collName, id: _old.id, _id: _old._id });
    } else {
        var _index = _.findIndex(coll, { id: _new.id, _id: _new._id });

        if (_index < 0) {
            logger.log('Failed to find item', 'info', { id: _new.id, _id: _new._id });
            coll.push(_new);
            return;
        }

        coll.splice(_index, 1, _new);
        logger.log('Updated item in collection', 'debug', { name: collName, id: _new.id, _id: _new._id });
    }
}

/**
 * Props to http://stackoverflow.com/a/16788517
 *
 * @param {Any} x
 * @param {Any} y
 * @return {Boolean}
 */
function objectEquals(x, y) {
    if (x === null || x === undefined || y === null || y === undefined) { return x === y; }
    // after this just checking type of one would be enough
    if (x.constructor !== y.constructor) { return false; }
    // if they are functions, they should exactly refer to same one (because of closures)
    if (x instanceof Function) { return x === y; }
    // if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
    if (x instanceof RegExp) { return x === y; }
    if (x === y || x.valueOf() === y.valueOf()) { return true; }
    if (Array.isArray(x) && x.length !== y.length) { return false; }

    // if they are dates, they must had equal valueOf
    if (x instanceof Date) { return false; }

    // if they are strictly equal, they both need to be object at least
    if (!(x instanceof Object)) { return false; }
    if (!(y instanceof Object)) { return false; }

    // recursive object equality check
    var p = Object.keys(x);
    return Object.keys(y).every(function (i) { return p.indexOf(i) !== -1; }) &&
        p.every(function (i) { return objectEquals(x[i], y[i]); });
}

module.exports = {
    contains: contains,
    reflect: reflect,
    settle: settle,
    setupItems: setupItems,
    setItem: setItem,
    objectEquals: objectEquals,
}
