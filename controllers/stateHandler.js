'use strict'

var fs = require('fs');
var path = require('path');
var moment = require('moment');
var _ = require('lodash');

var logger = require('./../middlehand/logger');

var azure = require('../lib/azure');
var PowerBi = require('../lib/powerBi');

var _tokenPath = path.resolve(__dirname, '../assets/token.json');

/**
 * Saves the token data to file.
 *
 * @param {String} token
 * @param {String} refreshToken
 * @param {String|Number} expiresOn
 * @return {Object}
 */
function saveTokenToFile(data) {

    // Use this to write the file.
    var _data = _.assign({}, data, {
        token: data.token,
        refreshToken: data.refreshToken,
        expiresOn: _.isDate(data.expiresOn)
            ? data.expiresOn.getTime()
            : data.expiresOn
    });

    logger.log('Writing token file', 'info', { _data });

    writeJsonFile(_tokenPath, _data);

    return _data;
}

/**
 * Sets _auth and _onTokenUpdated in the azure module.
 */
function setupTokenData() {
    // Read the file from disk
    var data = readJsonFile(_tokenPath);

    // Only set the token if there's an expiresOn value
    if (data.expiresOn && data.token) {
        azure.setTokenData(data.token, data.refreshToken, data.expiresOn);
    }

    // Set _onTokenUpdated in the azure module.
    azure.setOnTokenUpdated(saveTokenToFile);
}

// Call it emidiately for setup
setupTokenData();

/**
 * Reads the filecontents and returns an object containing it.
 *
 * @param {string} filepath Relative or absolute path to file
 * @return {object} If file exists, the file contents, otherwise an empty object
 */
function readJsonFile(_filepath) {

    // Normalize the filepath
    var _path = path.resolve(_filepath);

    // Check the file exists
    if (fs.existsSync(_path)) {
        var fileContents = fs.readFileSync(_path, 'utf8');

        var parsed = _.attempt(function() { return JSON.parse(fileContents); });
        return _.isError(parsed)
            ? { data: fileContents }
            : parsed;
    } else {
        return {};
    }

}

/**
 * Writes the object to a file.
 *
 * @param {object} content Data
 * @return {Boolean}
 */
function writeJsonFile(_filepath, content) {

    // No content or filepath means trouble.
    if (!_filepath || !content) {
        return false;
    }

    // Normalize the filepath.
    var _path = path.resolve(_filepath);

    var data;
    var parsed = _.attempt(function() { return JSON.parse(content); })

    // Check if *content* is a JSON object
    if (_.isError(parsed)) {
        // Content is not a JSON object

        // Try stringify it
        data = _.attempt(function() {
            return JSON.stringify(content);
        });

        // If something went wrong, stringify an object with the property data set to *content*.
        if (_.isError(data)) {
            data = JSON.stringify({ data: content });
        }
    } else {
        // Content already is a JSON object
        data = content;
    }

    // Write the file
    fs.writeFileSync(_path, data);

    return true;
}

/**
 * Migrates the old timestamp .txt file to a new .json file.
 * This will delete the old file completely.
 *
 * @param {string} txtPath Relative or absolute file path to the .txt timestamp file
 * @param {string} jsonPath Relative or absolute file path to the .json timestamp file
 */
function migrateTxtToJson(txtPath, jsonPath) {

    // Normalize the filepath
    var _txtPath = path.resolve(txtPath);

    var timestamp = fs.existsSync(_txtPath)
        ? parseInt(fs.readFileSync(_txtPath, 'utf8'))
        : undefined;

    if (timestamp) {

        // Write to the new file.
        logger.log('Migrating .txt timestamp file', 'info', { filename: _txtPath, timestamp: timestamp, timeString: moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS') });
        writeJsonFile(jsonPath, { timestamp: timestamp, timeString: moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS') });

        // Delete the old file as it's unnecessary
        fs.unlinkSync(_txtPath);
        logger.log('.txt file deleted', 'info', { filename: _txtPath });
    }

}

/**
 * Returns the timestamp from *filepath*
 * or the start of the current week.
 *
 * @param {string} filepath
 * @return {date}
 */
function getLastUpdated(filepath) {

    // Either use *filepath* as is, or set it to the lastUpdated.json file in assets
    filepath = !_.isUndefined(filepath)
        ? filepath
        : path.resolve(__dirname, '../assets/lastUpdated.json');

    var lastUpdated = readJsonFile(filepath);

    return !!(lastUpdated && lastUpdated.timestamp)
        ? lastUpdated.timestamp
        : moment().startOf('week').valueOf();
}


/**
 * Returns a promise of the dataset with its name matching *dataset*.
 * If a new is fetched, it's stored in the assets folder.
 *
 * @param {string} dataset Name of dataset
 * @param {object} _powerBi
 * @param {boolean} getNew
 * @param {string} datasetPath Path to dataset file
 * @return {promise} -> {string}
 */
function getDataset(datasetName, _powerBi, getNew, datasetPath) {
    return (function() {
        return new Promise(function(resolve, reject) {
            /**
             * Define powerBi if it's undefined
             */

            // If it's defined, resolve it
            if (!_.isUndefined(_powerBi) && !!_powerBi.token) {
                return resolve(_powerBi);
            }

            // Get a token and resolve a new instance of PowerBI
            azure.getToken('local')
            .then(function(token) {
                resolve(new PowerBi(token));
            })
            .catch(reject);
        });
    })()
    .then(function(powerBi) {
        return new Promise(function(resolve, reject) {
            /**
             * Get the dataset either from file new
             */

            // Set the filepath if it's undefined
            datasetPath = !_.isUndefined(datasetPath)
                ? datasetPath
                : path.resolve(__dirname, '../assets/datasets_{dataset}.json'.replace('{dataset}', datasetName));

            var datasetInfo = readJsonFile(datasetPath);

            // If the file doesn't exist, return powerBi.datasetExists(dataset)
            if (getNew || !datasetInfo.dataset) {
                return powerBi.datasetExists(datasetName)
                .then(function(_dataset) {
                    // Save file to datasetPath
                    writeJsonFile(datasetPath, _dataset);

                    resolve(_dataset.dataset.id);
                })
                .catch(reject);
            }

            // Resolve the file contents
            resolve(datasetInfo.dataset.id);
        });
    });
}

/**
 * Stores cookies, token and sessionId used as
 * authentication to the ICWS server.
 *
 * Returns the stored object.
 *
 * @param {Array} cookies
 * @param {String} token
 * @param {String} sessionId
 * @param {String} icwsPath Not required
 * @return {Object}
 */
function storeICWSAuth(cookies, token, sessionId, icwsPath) {

    var storable;
    var args = _.map(arguments);

    storable = args.length === 1
        ? {
            cookies: args.cookies,
            token: args.token,
            sessionId: args.sessionId
        }
        : {
            cookies: cookies,
            token: token,
            sessionId: sessionId
        };

    icwsPath = !_.isUndefined(icwsPath)
        ? icwsPath
        : path.resolve('./assets/icws_auth.json');

    writeJsonFile(icwsPath, storable);

    return storable;
}

/**
 * Returns the stored ICWS auth data stored in storeICWSAuth(...).
 *
 * @param {String} icwsPath Not required
 * @return {Object}
 */
function readICWSAuth(icwsPath) {

    icwsPath = !_.isUndefined(icwsPath)
        ? icwsPath
        : path.resolve('./assets/icws_auth.json');

    return readJsonFile(icwsPath);

}

module.exports = {
    readJsonFile: readJsonFile,
    writeJsonFile: writeJsonFile,
    migrateTxtToJson: migrateTxtToJson,
    getLastUpdated: getLastUpdated,
    getDataset: getDataset,
    storeICWSAuth: storeICWSAuth,
    readICWSAuth: readICWSAuth
}