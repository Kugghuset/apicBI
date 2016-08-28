'use strict'

var _ = require('lodash');
var AuthenticationContext = require('adal-node').AuthenticationContext
var Promise = require('bluebird');
var moment = require('moment');

/**
 *
 * Note this is a "flattened" version of the azureAuth file
 * where instead of objects, a flat, functional structure is used.
 *
 */

// Set up shorthands for environment data
var _clientId = process.env.AZURE_CLIENT_ID;
var _username = process.env.AZURE_CLIENT_USERNAME;
var _password = process.env.AZURE_CLIENT_PASSWORD;

// Set context for Azyure and Power BI
var _authorityUrl = 'https://login.windows.net/' + process.env.AZURE_DOMAIN;
var _context = new AuthenticationContext(_authorityUrl);
var _resource = 'https://analysis.windows.net/powerbi/api';

// The funciton to call when the token has been updated.
var _onTokenUpdated;

/**
 * Container object for the various response data from azure.
 */
var _auth = {
    token: undefined,
    expiresOn: undefined,
    refreshToken: undefined
};

/**
 * Fetches the token and refreshToken from Azure.
 * Also contains the time of expiration for the token.
 *
 * @return {Promise} -> {Object}
 */
function fetchToken() {
    return new Promise(function(resolve, reject) {
        _context.acquireTokenWithUsernamePassword(
            _resource,
            _username,
            _password,
            _clientId,
            function(err, response) {
                // Something went wrong, reject the error
                if (err) { return reject(err); }

                // Set the values of the _auth object
                _auth.token = response.accessToken;
                _auth.expiresOn = moment(new Date(response.expiresOn)).subtract(5, 'minutes').toDate();
                _auth.refreshToken = response.refreshToken;

                // Call _onTokenUpdated(...) if it's a function
                if (_.isFunction(_onTokenUpdated)) { _onTokenUpdated(_auth); }

                console.log('New token gotten using the remote method at {time}'.replace('{time}', moment().format('YYYY-MM-DD HH:mm:ss')));

                resolve(_auth);
            }
        );
    });
}

/**
 * Fetches a new token via the refreshToken from Azure,
 * sets the values of _auth then returns a promise of the _auth object.
 *
 * If there is no refreshToken, the regular refreshToken(...) is returned instead.
 *
 * @return {Promise} -> {Object}
 */
function fetchTokenRefresh() {
    // Return th regular fetchToken(...) if there is no refreshToken.
    if (!_auth.refreshToken) { return fetchToken(); }

    return new Promise(function(resolve, reject) {
        _context.acquireTokenWithRefreshToken(
            _auth.refreshToken,
            _clientId,
            null,
            function(err, response) {
                // Something went wrong, reject the error
                if (err) { return reject(err); }

                // Set the values of the _auth object
                _auth.token = response.accessToken;
                _auth.expiresOn = moment(new Date(response.expiresOn)).subtract(5, 'minutes').toDate();
                _auth.refreshToken = response.refreshToken;

                // Call _onTokenUpdated(...) if it's a function
                if (_.isFunction(_onTokenUpdated)) { _onTokenUpdated(_auth); }

                console.log('New token gotten using the refresh method at {time}'.replace('{time}', moment().format('YYYY-MM-DD HH:mm:ss')));

                resolve(_auth);
            }
        );
    });
}

/**
 * A refactor of a switch statement, kind of.
 */
var _tokenSwitch = {
    /**
     * Returns a promise of the local token from the _auth object.
     *
     * @return {Promise} -> {String}
     */
    'local': function() {
        return new Promise(function(resolve, reject) {
            // Reject if there's no local token
            if (!_auth.token) { return reject(new Error('No token in _auth object')); }

            // Reject if the local token is too old
            if (moment().isAfter(_auth.expiresOn)) { return reject(new Error('Tokenis too old')); }

            // Resolve the token
            resolve(_auth.token);
        })
    },

    /**
     * Returns a promise of the token via fetchTokenRefresh(...)
     *
     * @return {Promise} -> {String}
     */
    'refresh': function () {
        return new Promise(function(resolve, reject) {
            // Reject if there is no refreshToken in the _auth object
            if (!_auth.refreshToken) { return reject(new Error('No refreshToken')); }

            // Fetch the token
            fetchTokenRefresh()
            .then(function(auth) { resolve(auth.token); })
            .catch(reject);
        })
    },

    /**
     * Returns a promise of the token fetchToken(...).
     *
     * @return {Promise} -> {String}
     */
    'remote': function() {
        return new Promise(function(resolve, reject) {
            fetchToken()
            .then(function(auth) { resolve(auth.token); })
            .catch(reject);
        })
    }
}

/**
 * Returns the token, either from the _auth object, via fetchTokenRefresh(...) or fetchToken(...)
 *
 * If 'local' fails, it will attempt to get the token via the refresh method.
 * If 'refresh' fails, it will attepmt to get the token via the rmeote mtehod
 * If 'remote' fails, it wlil reject the error.
 *
 * @param {String} __method Defaults to 'remote'
 * @return {Promise<String>}
 */
function getToken(__method) {
    var _method = !!~['local', 'refresh', 'remote'].indexOf(__method)
        ? __method
        : 'remote';

    return _tokenSwitch[_method]()
    .then(function (token) {
        // Resolve the token

        return new Promise(function (resolve, reject) { resolve(token); });
    })
    .catch(function (err) {
        // Try use the refresh method instead
        if (_method === 'local') { return getToken('refresh'); }

        // Try use the remote method instead
        if (_method === 'refresh') { return getToken('remote'); }

        // Reject the error, there is no fallback
        return new Promise(function (resolve, reject) { reject(err); });
    })

}

/**
 * Returns a promise of the _auth object by piggy backing on the getToken(...) method.
 *
 * @param {String} _method
 * @return {Promise} -> {Object}
 */
function getTokenData(_method) {
    return new Promise(function (resolve, reject) {
        // Piggy backs on the getToken method
        getToken(_method)
        .then(function () { resolve(_auth); })
        .catch(reject);
    });
}

/**
 * Sets the values of the _auth object and returns it.
 *
 * @param {String} token
 * @parma {String} refreshToken
 * @param {String|Number} expiresOn
 * @return {Object}
 */
function setTokenData(token, refreshToken, expiresOn) {
    _auth.token = token;
    _auth.refreshToken = refreshToken;
    _auth.expiresOn = new Date(expiresOn);

    console.log('Local token data set at {time}'.replace('{time}', moment().format('YYYY-MM-DD HH:mm:ss')));

    return _auth;
}

/**
 * Sets the _callback variable to the value of *callback*.
 *
 * @param {Fuunction} callback Function to call when the token has been updated.
 */
function setOnTokenUpdated(callback) {
    _onTokenUpdated = callback;
}

module.exports = {
    getToken: getToken,
    getTokenData: getTokenData,
    setTokenData: setTokenData,
    setOnTokenUpdated: setOnTokenUpdated
}
