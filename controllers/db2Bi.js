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
var mail = require('../lib/mail');

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

/**
 * Gets new rows since *lastUpdated* from DB,
 * unless *isDefined* is true, then it returns an empty array.
 * 
 * @param {Date} lastUpdated
 * @param {Boolean} isDefined
 * @retunrn {Promise} -> {Array}
 */
function getQuery(lastUpdated, isDefined) {
    if (isDefined) {
        return new Promise(function (resolve, reject) { resolve([]); });
    }
    
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
 * Saves the latest timestamp and pushes the data to PowerBI.
 * 
 * @param {Object} data { recordset: {Array}, todayOnly: {Array}, latest: {Object} }
 * @param {String} datasetId
 * @param {Object} powerBi
 * @param {Number} attempt
 * @return {Promise} -> {Object}
 */
function pushData(data, datasetId, powerBi, attempt) {
    return new Promise(function (resolve, reject) {
        
        // Save the timestamp for future use, if there is one
        if (attempt === 0) {
            // Only save the timestamp if it's the first attempt.
            saveTimeStamp(filepath, data.latest);
        } else {
            console.log('Skipping writing timestamp, attempt to send data: ' + attempt);
        }
        
        var promises = _.map({ day: data.todayOnly, week: data.recordset }, function (value, key) {
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
            if (_.some(data, function (val) { return val.isRejected(); })) {
                reject(_.map(data, function (val) {
                    return val.isRejected() ? val.reason() : val.value();
                }));
            } else {
                resolve(_.map(data, function (val) { return val.value(); }));   
            }
        })
        .catch(reject);
    });
}

/**
 * Cleans the recordsets and returns an object
 * containing the the complete *recordset*, a (possible) subset at *todayOnly* and the *latest*.
 * If no data is found, an empty object is returned instead.
 * 
 * @param {Array} recordset
 * @param {Object} lastUpdated
 * @return {Object} { recordset: {Array}, todayOnly: {Array}, latest: {Object} }
 */
function cleanDataset(recordset, lastUpdated) {
    
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
        
        // Resolve the various recordsets
        return { recordset: recordset, todayOnly: todayOnly, latest: latest };
    } else {
        // Resolve an empty object instead
        return {};
    }
}

/**
 * @param {number} attempt
 * @return {promise}
 */
function notifyThreshold(attempt) {
    
    return mail.send('Too many attempts have been made.', [
        'Hello, we have made to many attempts at pushing data to Power BI.',
        'Number of attmepts: ' + attempt,
        '',
        'Best wishes,',
        'The real time dashboard crew'
    ].join('\n'));
  
}

/**
 * @param {error} err
 * @return {promise}
 */
function notifyError(err) {
  
    return mail.send('An error occured', [
        'Hello, the following error occured when trying to push data to Powe B:',
        err,
        '',
        'Best wishes,',
        'The real time dashboard crew'
    ].join('\n'));
  
}

/**
 * Reads the DB and pushes the data to Power BI.
 * 
 * @param {object} data Set recursevly, DO NOT SET!
 * @param {number} attempt Set recursevly, DO NOT SET!
 */
function read(data, attempt) {

    // Setup for possible recursion
    if (_.isUndefined(attempt)) { attempt = 0; }

    if (attempt > 10) {

        // Too many attempts!
        notifyThreshold(attempt);
        
        return console.log('Failed too many times.');
    }
    
    var lastUpdated = stateHandler.getLastUpdated();
    var powerBi;
    
    // Get get the data
    getQuery(lastUpdated, !!data)
    .then(function (recordset) {
        // Only assign data if it's undefined
        data = !!data
            ? data
            : cleanDataset(recordset, lastUpdated);
        
        // No data found, nothing to push. Return early
        if (!data.recordset) {
            return;
        }
        
        // Get the token for pushing
        return stateHandler.getToken(attempt > 0);
    })
    .then(function (token) {
        
        powerBi = new PowerBi(token);
        
        // Get the datasetId
        return stateHandler.getDataset('ApicBI', powerBi, attempt > 0);
        
    })
    .then(function (datasetId) {
        
        // Push the data
        return pushData(data, datasetId, powerBi, attempt);
    })
    .catch(function (err) { 
        if (/(not exists|get datasetid|get fulfillment)/i.test(err)) {
            return read(data, attempt += 1);
        } else {
            // notifyError(err);
            return read(data, attempt += 1);
            console.log(err);
        }
    });
};

module.exports = {
    read: read
};