'use strict'

var Promise = require('bluebird');
var _ = require('lodash');

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

module.exports = {
    contains: contains,
    reflect: reflect,
    settle: settle,
}
