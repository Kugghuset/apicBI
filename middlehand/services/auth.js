'use strict'

var _ = require('lodash');
var compose = require('composable-middleware');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var fs = require('fs');
var path = require('path');

var config = require('./../config');
var logger = require('../logger');

var _authPath = path.resolve(__dirname, '../../assets/auth-keys.json');

if (!fs.existsSync(_authPath)) {
    fs.writeFileSync(_authPath, '');
}

/**
 * Signs a token and returns it.
 *
 * @param {{ appKey: String }} data Data to sign into the token
 * @return {String} token
 */
function signToken(data) {
    return jwt.sign(data, config.app_secret, { expiresIn: 60 * 60 * 24 * 365 });
}

/**
 * Decodes a token and returns the result.
 *
 * @param {Object|String} req Express request object
 * @return {{ appKey: String }}
 */
function decodeToken(req) {
    if (!req) {
        return null;
    }

    var _token = _.isString(req)
        ? req
        : req.query.t;

    return jwt.decode(_token, config.app_secret);
}

/**
 * Middlewhare for ensuring authentication.
 *
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 * @param {Function} next Express next function
 */
function isAuthenticated(req, res, next) {
    var _token;

    return compose().use(function (req, res, next) {

        // get the token
        _token = req.query.t;

        var _decoded = decodeToken(_token);

        var _appKey = !!_decoded ? _decoded.appKey : null;

        // If there is no appKey, return 401
        if (_.isNull(_appKey)) {
            logger.log('Failed to authenticate request', 'info', { reason: 'Missing token' });
            res.status(401).send('Unauthorized');
        }

        return validateKey(_appKey)
        .then(function (isValid) {
            if (isValid) {
                logger.log('Sucessfully authenticated request', 'info', { appKey: _appKey });
                next();
            } else {
                logger.log('Failed to authenticate request', 'info', { reason: 'Invalid token' });
                res.status(401).send('Unauthorized');
            }
        });
    });
}

/**
 * @param {String} appKey
 * @return {Promise<Boolean>}
 */
function validateKey(appKey) {
    return new Promise(function (resolve, reject) {

        if (!appKey) {
            logger.log('Failed to validate app key - missing key', 'info')
            return Promise.resolve(false);
        }

        // Read the file
        fs.readFile(_authPath, 'utf8', function (err, data) {
            if (err) {
                // Failed to read file
                logger.log('Failed to read auth-keys.json file', 'error', { error: err.toString(), stackTrace: err.stack });
                return resolve(false);
            }

            if (!data) {
                logger.log('Failed to authenticate key, no keys stored', 'info', { appKey: appKey });
                return resolve(false);
            }

            /** @type {{ key: String, name: String }[]} */
            var _keys = _.attempt(function () { return JSON.parse(data); });

            if (_.isError(_keys)) {
                // Failed to parse file content
                logger.log('Failed to parse contents of auth-keys.json file', 'error', { error: _keys.toString(), stackTrace: _keys.stack });
                return resolve(false);
            }

            var _key = _keys[appKey];

            if (!_key) {
                logger.log('Failed to find key in auth keys', 'info', { appKey: appKey });
                return resolve(false);
            }

            logger.log('Successfully vaildated auth key', 'info', { appKey: appKey })

            return resolve(true);
        });
    });
}

/**
 * @param {String} appKey
 * @return {Promise<{ appKey: String }>}
 */
function insertKey(appKey) {
    return new Promise(function (resolve, reject) {
        if (!appKey) {
            var err = new Error('App key missing');
            logger.log('Failed to insert app key', 'error', { error: err.toString(), stackTrace: err.stack });
            return reject(err);
        }

        var _keyData = { appKey: appKey };
        fs.readFile(_authPath, 'utf8', function (err, data) {
           if (err) {
                // Failed to read file
                logger.log('Failed to read auth-keys.json file', 'error', { error: err.toString(), stackTrace: err.stack });
                return resolve(false);
            }

            /** @type {Object} */
            var _fileContent;

            if (!!data) {
                _fileContent = _.attempt(function () { return JSON.parse(data); });
            }

            if (!data || _.isError(_fileContent)) {
                _fileContent = {};
            }

            _fileContent[appKey] = _keyData;

            fs.writeFile(_authPath, JSON.stringify(_fileContent), function (err) {
                if (err) {
                    logger.log('Failed to insert key to auth-keys.json', 'error', { error: err.toString(), stackTrace: err.stack });
                    return reject(err);
                }

                logger.log('Added key to auth-keys.json', 'info', _keyData);
                resolve(_keyData);
            });
        });
    });
}

/**
 * Returns a GUID string.
 *
 * Example output: '1a729180f8-1f9c3-18d86-13b26-15ff6120931f241'
 *
 * @return {String} GUID string
 */
function guid () {
  return _.times(5, function (i) {
    // Assign n to 2 if i === 0, 3 if i === 4, otherwise 1
    let n = [2, 1, 1, 1, 3][i];

    return _.times(n, function () { return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(); }).join('');
  }).join('-');
}

module.exports = {
    signToken: signToken,
    decodeToken: decodeToken,
    isAuthenticated: isAuthenticated,
    validateKey: validateKey,
    guid: guid,
    insertKey: insertKey,
}
