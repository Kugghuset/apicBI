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

// Old filepath for migration if it exists
var old_filepath = path.resolve('assets/lastUpdated.txt');

/**
 * Will run on startup and should really only run once.
 */
stateHandler.migrateTxtToJson(old_filepath, filepath);

function DB2BI() {}

DB2BI.read = function() {
    var azure = new AzureAuth();
    
    azure.getToken().then(function(data) {
        var powerBi = new PowerBi(data.token);
        
        var lastUpdatedData = stateHandler.readJsonFile(filepath);
        
        // Set last updated to either the time found in assets/lastUpdate.txt
        // Or to the start of this week if there is none in the file.
        var lastUpdated = !!lastUpdatedData.timestamp
            ? lastUpdatedData.timestamp
            : moment().startOf('week').valueOf();
        
        function getQuery() {
            return sql.execute({
                query: sql.fromFile('../sql/polling_agents.sql'),
                params: {
                    LastUpdate: {
                        type: sql.DATETIME2,
                        val: new Date(parseInt(lastUpdated))
                    }
                }
            });
        }
        
        Promise.settle([
            powerBi.datasetExists('ApicBI'),
            getQuery()
        ])
        .then(function (data) {
            
            // Get the datasetId from the response object
            var datasetId = _.attempt(function () { return data[0].value().dataset.id });
            if (_.isError(datasetId)) {
                // return early, do something about it?
                return console.log('Could not get datasetId');
            }
            
            // Get the recordset
            var recordset = _.attempt(function () { return data[1].value(); });
            if (_.isError(recordset)) {
                return console.log('Could not get recordset from the database.')
            }
            
            // Get the latest value from the table, if any
            var latest = _.map(recordset).sort(function (a, b) {
                return moment(a.I3TimeStampGMT).isAfter(b.I3TimeStampGMT);
            }).pop();
            
            var todayOnly;
            
            // Check if the date is the very same as the start of this week
            // this should only work on first boot.
            if (parseInt(lastUpdated) === moment().startOf('week').valueOf()) {
                todayOnly = _.chain(recordset)
                    .filter(function (item) { return moment().startOf('day').isBefore(item.I3TimeStampGMT); })
                    .map(function (row) { return _.omit(row, 'I3TimeStampGMT'); })
                    .value();
            } else {
                todayOnly = _.map(recordset, function (row) { return _.omit(row, 'I3TimeStampGMT'); });
            }
            
            // Remove the proprety I3TimeStamp from all items.
            recordset = _.map(recordset, function (row) { return _.omit(row, 'I3TimeStampGMT'); });
            
            // Save the timestamp for future use, if there is one
            if (latest && latest.I3TimeStampGMT) {
                var timestamp = latest.I3TimeStampGMT.getTime() + 5;
                console.log('Writing new timestamp: ' + timestamp + ', which is: ' + moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS'));
                stateHandler.writeJsonFile(filepath, { timestamp: timestamp, timeString: moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS') });
            }
            
            // recordset will allways be the same or greater than todayOnly, so it's valid to only check it's length;
            if (recordset && recordset.length) {
                console.log('New data found! Sending at: ' + moment().format('YYYY-MM-DD HH:mm'));
            }
            
            // Iterate over data for the current day and the current week
            _.forEach({ day: todayOnly, week: recordset }, function (value, key) {
              
                // Only make the request if there's been an update.
                if (value && value.length) {
                    
                    // Table names will be be prefixed with 'day_' or 'week_'
                    powerBi.addRows(datasetId, [key,'per_agent'].join('_'), value).then(function(result) {
                        console.log([key,'per_agent'].join('_') + ' sent ' + value.length + ' rows. ' + moment().format('YYYY-MM-DD HH:mm'));
                    }).catch(function(error) {
                        console.log(error);
                    });
                    
                }
            })

        })
        .catch(function (err) {
            console.log(err);
        })

    });
};

module.exports = DB2BI;