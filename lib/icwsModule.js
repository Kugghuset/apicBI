'use strict'

var _ = require('lodash');
var Promise = require('bluebird');

var stateHandler = require('../controllers/stateHandler');
var utils = require('./utils');

var _serverAddress = 'http://' + process.env.ICWS_SERVER + ':' + process.env.ICWS_PORT + '/icws';
var _username = process.env.ICWS_USERNAME;
var _password = process.env.ICWS_PASSWORD;

// The host to use for requests
var _host = process.env.ICWS_SERVER;

// Initially set _baseUrl to _serverAddress, though this may change
var _baseUrl = _serverAddress;

/**
 * The container object for the token, sessionId and cookies
 */
var _auth = {
    token: undefined,
    sessionId: undefined,
    cookies: undefined
}

/**
 * Returns all available headers.
 *
 * @return {Object}
 */
function getHeaders() {
    return _.pickBy({
        'Accept-Language': 'en-us',
        'Content-Type': 'application/vnd.inin.icws+JSON',
        'ININ-ICWS-CSRF-Token': _auth.token,
        'Cookie': _auth.cookies
    }, _.isString)
}

/**
 * Sets the _host, and thus _baseUrl for making requests
 * and returns _baseUrl.
 *
 * @param {String} host Host to apply
 * @return {String} *_baseUrl*
 */
function setHost(host) {
    // Set *_host* to *host* if it's defined
    _host = !_.isUndefined(host) ? host : _host;

    console.log('Setting ICWS host: ' + _host);

    // Set _baseUrl
    _baseUrl = _.isUndefined(_host)
        ? _serverAddress
        : 'http://' + _host + ':' + process.env.ICWS_PORT + '/icws';

    return _baseUrl;
}

/**
 * Tries to authenticate the user.
 *
 * @param {Number} attempts Do not set, set recuresively
 * @param {Error} err Do not set, set recuresively
 * @return {Promise} -> {Object}
 */
function remoteAuth(attempts, err) {
    // Define attempts if undefined
    if (_.isUndefined(attempts)) { attempts = 1; }

    // Ensure no infinite loops are made
    if (attempts >= 10 && !err) {
        err = new Error('Too many login attempts, cannot authorize ICWS.')
    }

    // Handle errors from previous attempts
    if (err) {
        // Return and reject the error
        return new Promise(function (resolve, reject) { reject(err); })
    }

    // Set the data
    var _data = {
        '__type': 'urn:inin.com:connection:icAuthConnectionRequestSettings',
        'applicationName': 'Kugghuset ICWS Application',
        'userID': _username,
        'password': _password,
    };

    // Set the options, including headers
    var _options = {
        headers: getHeaders()
    };

    // Send the data
    return utils.post(_baseUrl + '/connection', _data, _options, true)
    .then(function (data) {
        // Try get the token
        var _token = _.get(data, 'body.csrfToken');

        // Authenticated if _token is defined
        if (_token) {
            return new Promise(function (resolve, reject) {
                _auth.cookies = data.response.headers['set-cookie'];
                _auth.token = _token;
                _auth.sessionId = data.body.sessionId;

                resolve(_auth);
            });
        }

        // Check for alternate hosts and try with a new host if there are any
        var _alternateHosts = _.get(data, 'body.alternateHostList');
        if (_alternateHosts) {
            setHost(_alternateHosts[0]);
            return remoteAuth(attempts += 1);
        }

        // Could not log in, recuresively reject the error.
        return remoteAuth(attempts += 1, new Error(_.get(data, 'body.message') || 'No response body'));
    })
    .catch(function (err) {
        // Recursively reject the error
        return remoteAuth(attempts += 1, err);
    });
}

/**
 * Returns a promise of whether a connection to the
 * ICWS server is properly set up.
 *
 * @return {Promise} -> {Boolean}
 */
function checkConnection() {
    return new Promise(function (resolve, reject) {
        _get('/connection', undefined, undefined, true)
        .then(function (res) {
            // If an error code was returned, assume we're not properly connected.
            if (res.response.statusCode >= 400) {
                return resolve(false);
            }

            // Try get the body
            var _body = res.body || {};
            if (!_.isUndefined(_body.errorCode)) {
                return resolve(false);
            }

            resolve(true);
        })
        .catch(function (err) {
            reject(false);
        });
    });
}

/**
 * Returns a promise when authentication is sucessful.
 *
 * @param {Boolean} getNew Flag for when authentication must be performed remotely
 * @return {Promise} -> {Object}
 */
function authenticate(getNew) {
    if (getNew) {
        return new Promise(function (resolve, reject) {
            remoteAuth()
            .then(function (auth) {
                // Store and resolve the auth object
                // stateHandler.storeICWSAuth(...) returns the stored object
                resolve(stateHandler.storeICWSAuth(auth.cookies, auth.token, auth.sessionId));
            })
            .catch(reject);
        });
    }

    // Read the file from disk and try use it
    var icwsObj = stateHandler.readICWSAuth();
    //
    if (!!_.get(icwsObj, 'token') && _.get(icwsObj, 'token') !== _auth.token) {
        _auth = _.pick(icwsObj, ['token', 'sessionId', 'cookies']);
    }

    // Check connection
    return checkConnection()
    .then(function (isConnected) {
        if (!isConnected) {
            // Recursively get authenticate remotely
            return authenticate(true);
        }

        // Return the promise!
        return new Promise(function (resolve, reject) { resolve(_auth); });
    })
    .catch(function (err) {
        // Something went wrong, so try authenticate remotely instead.
        return authenticate(true);
    });
}

/**
 * Returns the url used when making requests to the service outside of authentication.
 *
 * @param {String} dir The directory to append to _baseUrl
 * @param {Boolean} skipSessionId Optional flag to skip appending the sessionId
 * @return {String}
 */
function requestUrl(dir, skipSessionId) {
    // Allow *dir* to start with or without slashes
    var _dir = /^\//.test(dir) ? dir.slice(1) : dir;

    // Either if there is no sessionId or skipSessionId is truthy, return only _baseUrl/dir
    return (!!skipSessionId || !_auth.sessionId)
        ? [_baseUrl, _dir].join('/')
        : [_baseUrl, _auth.sessionId, _dir].join('/');
}

/**
 * Makes a GET request prepackaged with the headers and _baseUrl needed.
 *
 * @param {String} dir The directory to append to _baseUrl
 * @param {Boolean} skipSessionId Optional flag to skip appending the sessionId
 * @param {Boolean} returnAll Optional flag for whether the promise should resolve the response object too
 * @return {Promise} -> {Object}
 */
function _get(dir, data, skipSessionId, returnAll) {
    return utils.get(requestUrl(dir, skipSessionId), data, { headers: getHeaders() }, returnAll);
}

/**
 * Makes a POST request prepackaged with the headers and _baseUrl needed.
 *
 * @param {String} dir The directory to append to _baseUrl
 * @param {Boolean} skipSessionId Optional flag to skip appending the sessionId
 * @param {Boolean} returnAll Optional flag for whether the promise should resolve the response object too
 * @return {Promise} -> {Object}
 */
function _post(dir, data, skipSessionId, returnAll) {
    return utils.post(requestUrl(dir, skipSessionId), data, { headers: getHeaders() }, returnAll);
}

/**
 * Makes a PUT request prepackaged with the headers and _baseUrl needed.
 *
 * @param {String} dir The directory to append to _baseUrl
 * @param {Boolean} skipSessionId Optional flag to skip appending the sessionId
 * @param {Boolean} returnAll Optional flag for whether the promise should resolve the response object too
 * @return {Promise} -> {Object}
 */
function _put(dir, data, skipSessionId, returnAll) {
    return utils.put(requestUrl(dir, skipSessionId), data, { headers: getHeaders() }, returnAll);
}

/**
 * Makes a DELETE request prepackaged with the headers and _baseUrl needed.
 *
 * @param {String} dir The directory to append to _baseUrl
 * @param {Boolean} skipSessionId Optional flag to skip appending the sessionId
 * @param {Boolean} returnAll Optional flag for whether the promise should resolve the response object too
 * @return {Promise} -> {Object}
 */
function _delete(dir, data, skipSessionId, returnAll) {
    return utils.delete(requestUrl(dir, skipSessionId), data, { headers: getHeaders() }, returnAll);
}

module.exports = {
    auth: authenticate,
    get: _get,
    post: _post,
    put: _put,
    delete: _delete,
}
