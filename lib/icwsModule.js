'use strict'

var _ = require('lodash');
var Promise = require('bluebird');
var utils = require('./utils');

var _serverAddress = 'http://' + process.env.ICWS_SERVER + ':' + process.env.ICWS_PORT + '/icws';
var _username = process.env.ICWS_USERNAME;
var _password = process.env.ICWS_PASSWORD;

// The host to use for requests
var _host = process.env.ICWS_SERVER;
// Initially set _baseUrl to _serverAddress, though this may change
var _baseUrl = _serverAddress;

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
function auth(attempts, err) {
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
            console.log(_baseUrl);
            return auth(attempts += 1);
        }

        // Could not log in, recuresively reject the error.
        return auth(attempts += 1, new Error('No response body'));
    })
    .catch(function (err) {
        // Recursively reject the error
        return auth(attempts += 1, err);
    });
}

module.exports = {
    auth: auth
}
