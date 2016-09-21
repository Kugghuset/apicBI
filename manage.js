'use strict'

if (!process.env.APP_NAME) {
    process.env.APP_NAME = 'utility';
}

var fs = require('fs');
var path = require('path');

var config = require('./middlehand/config');
var auth = require('./middlehand/services/auth');
var logger = require('./middlehand/logger');

// Get the args
var args = process.argv.map(function (val, index, array) { return val }).slice(2);

var options = getOptions();

function getOptions() {
    var _options = {};
    var currentKey;

    // Iterate over all args to populate *_options*
    args.forEach(function (val) {
        // Set current key if *val* starts with -[-]
        if (/^\-+/.test(val)) {
            currentKey = val.replace(/^\-+/, '');
            // At least append the key
            return _options[currentKey] = undefined;
        }

        _options[currentKey] = (typeof _options[currentKey] === 'undefined')
            ? val
            : _options[currentKey] + ' ' + val;
    });

    return _options;
}

/**
 * Commands:
 *  --add-key
 *      Adds a key to the auth-key.json file and logs out a token available to use.
 *
 *  --get-token <appKey>
 *      Generates a token based on *appKey* being valid and logs the token
 *
 *  --secret [<secret>]
 *      Either uses or generates a secret and writes it to .env-middlehand
 */

if (Object.keys(options).length < 1 || options.hasOwnProperty('help')) {
    logger.log([
        '',
        'Commands:',
        '   --help',
        '       Displays this text.',
        '',
        '   --add-key',
        '       Adds a key to the auth-key.json file and logs out a token available to use.',
        '',
        '   --get-token <appKey>',
        '       Generates a token based on *appKey* being valid and logs the token',
        '',
        '   --secret [<secret>]',
        '       Either uses or generates a secret and writes it to .env-middlehand',
    ].join('\n'))
}

if (options.hasOwnProperty('add-key')) {
    logger.log('Adding key.');

    var _appKey = auth.guid();
    var _token;

    auth.insertKey(_appKey)
    .then(function (keyData) {
        logger.log('Key added. Generating token', 'info', keyData);

        _token = auth.signToken(keyData);
        logger.log('Token generated: ' + _token, 'info', keyData);
    })
} else if (options.hasOwnProperty('get-token')) {
    logger.log('Generating token based on key');

    var _key = options['get-token'];

    auth.validateKey(_key)
    .then(function (isValid) {
        if (!isValid) {
            logger.log('Invalid key provided, cannot get token', 'info', { appKey: _key });
            return;
        }

        var _token = auth.signToken({ appKey: _key });

        logger.log('Token generated: ' + _token, 'info', { appKey: _key });
    });
} else if (options.hasOwnProperty('secret')) {
    logger.log('Setting app secret', 'info');

    // Get the secret
    var _secret = typeof options['secret'] === 'undefined'
        ? auth.guid()
        : options['secret'];

    fs.readFile(path.resolve('./.env-middlehand'), 'utf8', function (err, data) {
        if (err) {
            logger.log('Failed to read .env-middlehand file. Cannot set secret', 'error', { error: err.toString(), stackTrace: err.stack });
            return;
        }

        fs.writeFile(path.resolve('./.env-middlehand'), data.replace(/(\nAPP_SECRET\=).+/, '$1' + _secret), function (err) {
            if (err) {
                logger.log('Failed to write .env-middlehand file', 'error', { error: err.toString(), stackTrace: err.stack });
                return;
            }

            logger.log('Successfully set app secret. If the Middlehand app is running, restart the process to use the new secret.', 'info');
        });
    });
}
