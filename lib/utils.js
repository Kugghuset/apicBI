'use strict'

var request = require('request');
var _ = require('lodash');
var Promise = require('bluebird');

/**
 * Makes a *method* request to *url* and returns a Promise of the response.
 *
 * @param {String} method The type of
 * @param {String} url The url to make the request to
 * @param {Object} data The body of the request, not required
 * @param {Object} options Options object, should contain headers
 * @param {Boolean} returnAll Optional flag for whether the response object should be returned
 * @param {Boolean} nofail Optoinal flag for whether the response object should be returned on error as well
 * @return {Promise} -> {Objec}
 */
function _request(method, url, data, options, returnAll, noFail) {
    return new Promise(function (resolve, reject) {
        // Ensure exist
        var _options = !_.isUndefined(options)
            ? options
            : {};

        // Ensure lowercase
        var _method = method.toLowerCase();

        // Ensure there is data
        var _data = !_.isUndefined(data)
            ? data
            : {};

        // Stringify _data if it isn't a string already
        if (!_.isString(_data)) {
            _data = JSON.stringify(_data);
        }

        // Make the request
        request(_.assign({}, _options, {
            method: _method,
            url: url,
            headers: _options.headers,
            body: _data
        }), function (err, response, body) {
            // resolve the response object
            if (err && noFail) {
                // Resolve the complete object.
                return resolve({ err: err, response: response, body: body });
            }

            // Reject if an error occured
            if (err) { return reject(err); }

            // JSON.parse may false, so wrap it in a sort of try/catch
            var _body = _.attempt(function () { return JSON.parse(body); })

            // If an error occured when parsing, return *body* as is,
            // otherwise return the parsed *_body*
            _body = _.isError(_body) ? body : _body;

            // Return either both response and body
            // or just the body.
            if (returnAll) {
                resolve({ response: response, body: _body })
            } else {
                resolve(_body);
            }
        })
    });
}

/**
 * Makes a GET request to *url* with *data* as query params
 * and returns a promise of the response.
 *
 * If only two arugments are passed in, *data* (second param) will be assumed to be the Options object.
 *
 * @param {String} url The url to make the request to
 * @param {Object|String} data Will be used as query params if defined. Will be assumed to be options if only two params are passed in
 * @param {Object} options Options object, should contain headers
 * @param {Boolean} returnAll Optional flag for whether the response object should be returned
 * @param {Boolean} nofail Optoinal flag for whether the response object should be returned on error as well
 * @return {Promise} -> {Object}
 */
function _get(url, data, options, returnAll, noFail) {
    var _params;
    var _url = url;

    // Allow only url and options to be passed in
    var _options = arguments.length >= 3
        ? options
        : data;

    // Handle data, sort of
     if (_.isString(data)) {
        // Data is a string and is assumed to be url encoded
        _params = data;
    } else if (!_.isUndefined(data)) {
        // Assume data is an object
        _params = _.map(data, function (value, key) {
            return encodeURI([key, value].join('='));
        }).join('&');
    }

    // Append *_params* if defined
    if (!_.isUndefined(_params)) {
        // Join either by ? or &, depending on whether there is a ? in the url already
        _url += (/\?/.test(url) ? '&' : '?') + _params;
    }

    return _request('get', _url, {}, options, returnAll, noFail);
}

/**
 * Makes a POST request to *url* with *data* as body
 * and returns a promise of the response.
 *
 * @param {String} url The url to make the request to
 * @param {Object} data The body of the request, not required
 * @param {Object} options Options object, should contain headers
 * @param {Boolean} returnAll Optional flag for whether the response object should be returned
 * @param {Boolean} nofail Optoinal flag for whether the response object should be returned on error as well
 * @return {Promise} -> {Object]}
 */
function _post(url, data, options, returnAll, noFail) {
    return _request('post', url, data, options, returnAll, noFail);
}

/**
 * Makes a PUT request to *url* with *data* as body
 * and returns a promise of the response.
 *
 * @param {String} url The url to make the request to
 * @param {Object} data The body of the request, not required
 * @param {Object} options Options object, should contain headers
 * @param {Boolean} returnAll Optional flag for whether the response object should be returned
 * @param {Boolean} nofail Optoinal flag for whether the response object should be returned on error as well
 * @return {Promise} -> {Object]}
 */
function _put(url, data, options, returnAll, noFail) {
    return _request('put', url, data, options, returnAll, noFail);
}

/**
 * Makes a DELETE request to *url* with *data* as body
 * and returns a promise of the response.
 *
 * @param {String} url The url to make the request to
 * @param {Object} data The body of the request, not required
 * @param {Object} options Options object, should contain headers
 * @param {Boolean} returnAll Optional flag for whether the response object should be returned
 * @param {Boolean} nofail Optoinal flag for whether the response object should be returned on error as well
 * @return {Promise} -> {Object]}
 */
function _delete(url, data, options, returnAll, noFail) {
    return _request('delete', url, data, options, returnAll, noFail);
}

/**
 * @param {Any} obj The object to check existance of
 * @return {Boolean}
 */
function isDefined(obj) {
    return !!obj || !_.isUndefined(obj);
}

/**
 * @param {Number} val
 * @return {String}
 */
function timer (val) {
    var isNegative = val < 0;

    if (isNegative) {
        val = Math.abs(val);
    }

    var seconds = Math.floor(val);
    var minutes = Math.floor(val / 60);
    var hours = Math.floor(val / 60 / 60);
    // var days = Math.floor(ms /  1000 / 60 / 60 / 24);

    return (isNegative ? '-' : '') + [
        ('0' + hours % 24).slice(-2),
        ':',
        ('0' + minutes % 60).slice(-2),
        ':',
        ('0' + seconds % 60).slice(-2),
    ].join('');

}

module.exports = {
    request: _request,
    get: _get,
    post: _post,
    put: _put,
    delete: _delete,
    isDefined: isDefined,
    timer: timer,
}

