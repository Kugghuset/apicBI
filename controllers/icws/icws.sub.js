'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var icws = require('../../lib/icwsModule');

/**
 * Creates a subscription to *path* with *content*.
 *
 * @param {String} path
 * @param {Object} body
 * @return {Promise}
 */
function subscribe(path, body) {
    return icws.put(path, body);
}

/**
 * Deletes a subscriptoin to *path*
 *
 * @param {String} path
 * @return {Promise}
 */
function unsubscribe(path) {
    return icws.delete(path);
}

module.exports = {
    subscribe: subscribe,
    unsubscribe: unsubscribe,
}
