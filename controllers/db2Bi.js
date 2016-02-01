var Promise = require('bluebird');
var AzureAuth = require('../lib/azureAuth');
var PowerBi = require('../lib/powerBi');
var sql = require("seriate");
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var _ = require('lodash');

var database = require('../configs/database');
var stateHandler = require('./stateHandler');

// Init only needed once
sql.setDefaultConfig(database.ic);

// Filapath to the storage file
var filepath = path.resolve('assets/lastUpdated.json');

var tokenPath = path.resolve('assets/token.json');

// Old filepath for migration if it exists
var old_filepath = path.resolve('assets/lastUpdated.txt');

/**
 * Will run on startup and should really only run once.
 */
stateHandler.migrateTxtToJson(old_filepath, filepath);

function DB2BI() {}

/**
 * Gets the timestamp to compare with.
 * 
 * @param {String} filepath
 * @return {Date}
 */
function getLastUpdated() {
    var lastUpdatedData = stateHandler.readJsonFile(filepath);

    // Set last updated to either the time found in assets/lastUpdate.txt
    // Or to the start of this week if there is none in the file.
    return !!lastUpdatedData.timestamp
        ? lastUpdatedData.timestamp
        : moment().startOf('week').valueOf();
}

/**
 * Gets new rows since *lastUpdated* from DB.
 * 
 * @param {Date} lastUpdated
 * @retunrn {Promise} -> {Array}
 */
function getQuery(lastUpdated) {
    return sql.execute({
        query: sql.fromFile('../sql/polling_agents.sql'),
        params: {
            LastUpdate: {
                type: sql.DATETIME2,
                val: new Date(lastUpdated)
            }
        }
    });
}

/**
 * Writes to *filepath* the timestamp of *latest* if it exists.
 * 
 * @param {Object} latest
 * @return {Boolean}
 */
function saveTimeStamp(filepath, latest) {
    
    if (!filepath) { return; }
    // Save the timestamp for future use, if there is one
    if (latest && latest.TerminatedDateTimeGMT) {
        var timestamp = latest.TerminatedDateTimeGMT.getTime() + 5;
        console.log('Writing new timestamp: ' + timestamp + ', which is: ' + moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS'));
        stateHandler.writeJsonFile(filepath, { timestamp: timestamp, timeString: moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS') });
        return true;
    }
    return false;
}

/**
 * @param {Array} data
 * @param {Object} powerBi
 */
function pushData(data, powerBi, lastUpdated) {
    return new Promise(function (resolve, reject) {
       
        // Get the datasetId from the response object
        var datasetId = _.attempt(function () { return data[0].value().dataset.id });
        if (_.isError(datasetId)) {
            // return early, do something about it?
            console.log('Could not get datasetId');
            return reject(new Error('Could not get datasetId.'));
        }
        
        // Get the recordset
        var recordset = _.attempt(function () { return data[1].value(); });
        if (_.isError(recordset)) {
            console.log('Could not get recordset from the database.');
            return reject(new Error('Could not get recordset from the database'));
        }

        // Filter out any incorrect items.
        recordset = _.filter(recordset, function (item) { return item && item.TerminatedDateTimeGMT; });

        // Get the latest value from the table, if any
        var latest = _.map(recordset).sort(function (a, b) {
            return moment(a.TerminatedDateTimeGMT).isAfter(b.TerminatedDateTimeGMT);
        }).pop();

        var todayOnly;

        // Check if the date is the very same as the start of this week
        // this should only work on first boot.
        if (lastUpdated === moment().startOf('week').valueOf()) {
            todayOnly = _.chain(recordset)
                .filter(function (item) { return moment().startOf('day').isBefore(item.TerminatedDateTimeGMT); })
                .map(function (row) { return _.omit(row, 'TerminatedDateTimeGMT'); })
                .value();
        } else {
            todayOnly = _.map(recordset, function (row) { return _.omit(row, 'TerminatedDateTimeGMT'); });
        }

        // Remove the property TerminatedDateTimeGMT from all items.
        recordset = _.map(recordset, function (row) { return _.omit(row, 'TerminatedDateTimeGMT'); });

        // recordset will allways be the same or greater than todayOnly, so it's valid to only check it's length;
        if (recordset && recordset.length) {
            console.log('New data found at: ' + moment().format('YYYY-MM-DD HH:mm') + '!');
        }

        // Save the timestamp for future use, if there is one
        saveTimeStamp(filepath, latest);

        var promises = _.map({ day: todayOnly, week: recordset }, function (value, key) {
            return new Promise(function (resolve, reject) {
                
                // Only make the request if there's been an update.
                if (value && value.length) {
                    
                    // Table names will be be prefixed with 'day_' or 'week_'
                    powerBi.addRows(datasetId, [key, 'per_agent'].join('_'), value).then(function (result) {
                        console.log([key, 'per_agent'].join('_') + ' sent ' + value.length + ' rows. ' + moment().format('YYYY-MM-DD HH:mm'));
                        resolve(result);
                    }).catch(reject);

                } else {
                    resolve({});
                }
            });
        });
        
        // Iterate over data for the current day and the current week
        Promise.all(_.map(promises, function (promise) { return promise.reflect(); }))
        .then(function (data) {
            resolve(_.map(data, function (val) { return val.value(); }));
        })
        .catch(reject);
    });
}

/**
 * Gets either the local token or a new token.
 * 
 * @param {boolean} getNew
 * @return {promise} -> {string}
 */
function getToken(getNew) {
    return new Promise(function (resolve, reject) {
        // for somereason get a new token
        var data
        if (fs.existsSync(tokenPath)) {
            data = stateHandler.readJsonFile(tokenPath);
        }
        
        
        
        if (getNew || !data || !data.token || moment().subtract(50, 'minutes').isAfter(moment(parseInt(data.timestamp)))) {
            
            console.log('Fetching new token.');
            
            var azure = new AzureAuth();

            azure.getToken()
                .then(function (data) {
                    console.log('Writing new token at: ' + moment().format('YYYY-MM-DD HH:mm'));
                    stateHandler.writeJsonFile(tokenPath, _.assign({}, data, {
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
 * Reads the DB and pushes the data to Power BI.
 * 
 * 
 * @param {number} attempt Set recursevly, DO NOT SET!
 */
DB2BI.read = function read(attempt) {
    
    if (_.isUndefined(attempt)) { attempt = 0; }
    
    if (attempt > 10) {
        return console.log('Failed too many times.');
    }
    
    getToken(attempt > 0)
    .then(function(token) {
        var powerBi = new PowerBi(token);
        
        var lastUpdated = getLastUpdated();
        
        Promise.settle([
            powerBi.datasetExists('ApicBI'),
            getQuery(lastUpdated)
        ])
        .then(function (data) {
            return pushData(data, powerBi, lastUpdated);
        })
        .catch(function (err) {
            if (/(not exists|get datasetid)/i.test(err)) {
                return read(attempt += 1);
            } else {
                console.log(err);
            }
        });

    });
};

module.exports = DB2BI;