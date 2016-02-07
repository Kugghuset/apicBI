
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var _ = require('lodash');

var AzureAuth = require('../lib/azureAuth');
var PowerBi = require('../lib/powerBi');

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
        
        var parsed = _.attempt(function () { return JSON.parse(fileContents); });
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
    var parsed = _.attempt(function () { return JSON.parse(content); })
    
    // Check if *content* is a JSON object
    if (_.isError(parsed)) {
        // Content is not a JSON object
        
        // Try stringify it
        data = _.attempt(function () {
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
        console.log('Migrating .txt timestamp file: ' + _txtPath);
        writeJsonFile(jsonPath, { timestamp: timestamp, timeString: moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS') });
        
        // Delete the old file as it's unnecessary
        fs.unlinkSync(_txtPath);
        console.log('.txt file deleted: ' + _txtPath);
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
        : moment().startOf('isoweek').valueOf();
}

/**
 * Returns a promise of the token to use
 * for making requests to Power BI.
 * 
 * Gets a new token from Azure if none can be found locally or *getNew* is true,
 * otherwise it will try to find get the local tocak at *filePath* or in the assets folder.
 * If failed, a new token will be gotten from Azure.
 * 
 * @param {string} filepath
 * @return {promise} -> {string}
 */
function getToken(getNew, tokenPath) {
    return new Promise(function (resolve, reject) {
        
        tokenPath = !_.isUndefined(tokenPath)
            ? tokenPath
            : path.resolve(__dirname, '../assets/token.json');
        
        // for some reason get a new token
        var data;
        if (fs.existsSync(tokenPath)) {
            data = readJsonFile(tokenPath);
        }
        
        if (getNew || !data || !data.token || moment().subtract(50, 'minutes').isAfter(moment(parseInt(data.timestamp)))) {
            
            console.log('Fetching new token.');
            
            var azure = new AzureAuth();

            azure.getToken()
            .then(function (data) {
                console.log('Writing new token at: ' + moment().format('YYYY-MM-DD HH:mm'));
                writeJsonFile(tokenPath, _.assign({}, data, {
                    timestamp: Date.now()
                }));
                resolve(data.token);
            })
            .catch(reject);
        } else {
            
            if (data.token) {
                resolve(data.token);
            } else {
                reject(new Error('No token found.'));
            }
        }

    });
}

/**
 * Returns a promise of the dataset with its name matching *dataset*.
 * If a new is fetched, it's stored in the assets folder.
 * 
 * @param {string} dataset Name of dataset
 * @param {object} _powerBi
 * @param {boolean} getNew
 * @param {string} datasetPath Path to dataset file
 * @return {promise} -> {object}
 */
function getDataset(dataset, _powerBi, getNew, datasetPath) {
    return (function () {
        return new Promise(function (resolve, reject) {
            /**
             * Define powerBi if it's undefined
             */
            
            // If it's defined, resolve it
            if (!_.isUndefined(_powerBi)) {
                resolve(_powerBi);
            }
            
            // Get a token and resolve a new instance of PowerBI
            getToken()
            .then(function (token) {
              resolve(new PowerBi(token));
            })
            .catch(reject);
        });
    })()
    .then(function (powerBi) {
        return new Promise(function (resolve, reject) {
            /**
             * Get the dataset either from file new
             */
            
            // Set the filepath if it's undefined
            datasetPath = !_.isUndefined(datasetPath)
                ? datasetPath
                : path.resolve(__dirname, '../assets/datasets_{dataset}.json'.replace('{dataset}', dataset));
            
            // If the file doesn't exist, return powerBi.datasetExists(dataset)
            if (getNew || !fs.existsSync(datasetPath)) {
                return powerBi.datasetExists(dataset)
                .then(function (_dataset) {
                    // Save file to datasetPath
                    writeJsonFile(datasetPath, _dataset);
                    
                    resolve(_dataset);
                })
                .catch(reject);
            }
            
            // Resolve the file contents
            resolve(readJsonFile(datasetPath));
        });
    });
}

module.exports = {
    readJsonFile: readJsonFile,
    writeJsonFile: writeJsonFile,
    migrateTxtToJson: migrateTxtToJson,
    getLastUpdated: getLastUpdated,
    getToken: getToken,
    getDataset: getDataset
}