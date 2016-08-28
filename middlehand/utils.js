'use strict'

/**
 * @param {Array} coll
 * @param {any} item
 * @return {Boolean}
 */
function contains(coll, item) {
    return Array.isArray(coll) ? !!~coll.indexOf(item) : false;
}

module.exports = {
    contains: contains,
}
