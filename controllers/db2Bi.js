var Promise = require('bluebird');
var Error = require(global.root + '/lib/error.js');
var AzureAuth = require(global.root + '/lib/azureAuth.js');
var PowerBi = require(global.root + '/lib/powerBi.js');
var sql = require("seriate");
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var _ = require('lodash');


var database = require(global.root + '/configs/database.js');

var datasetId = 'c85f937b-f614-4fa9-95bf-3b07e757c21b';

// Init only needed once
sql.setDefaultConfig(database.ic);

// Filapath to the storage file
var filePath = path.resolve(global.root, 'assets/lastUpdated.txt');

function DB2BI() {}

DB2BI.read = function() {
    var azure = new AzureAuth();
    
    azure.getToken().then(function(data) {        
        var powerBi = new PowerBi(data.token);
        
        // Set last updated to either the time found in assets/lastUpdate.txt
        // Or to the start of this week if there is none in the file.
        var lastUpdated = fs.existsSync(filePath)
            ? fs.readFileSync(path.resolve(global.root, 'assets/lastUpdated.txt'), 'utf8')
            : moment().startOf('week').valueOf();
        
        sql.execute({
            query: sql.fromFile('../sql/poll_per_agent_call_length_this_week.sql'),
            params: {
                LastUpdate: {
                    type: sql.DATETIME2,
                    val: new Date(parseInt(lastUpdated))
                }
            }
        })
        .then(function (recordset) {
            
            // Get the latest value from the table, if any
            var latest = _.map(recordset).sort(function (a, b) {
                return moment(a.I3TimeStampGMT).isAfter(b.I3TimeStampGMT);
            }).pop();
            
            
            var todayOnly;
            
            // Check if the date is the very same as the start of this week
            // this should only work on first boot.
            if (parseInt(lastUpdated) === moment().startOf('week').valueOf()) {
                todayOnly = _.filter(recordset, function (item) { return moment().startOf('day').isBefore(item.I3TimeStampGMT); });
            } else {
                todayOnly = recordset;
            }
            
            // Save the timestamp for future use, if there is one
            if (latest && latest.I3TimeStampGMT) {
                fs.writeFileSync(filePath, latest.I3TimeStampGMT.getTime());
            }
            
            // Iterate over data for the current day and the current week
            _.forEach({ day: todayOnly, week: recordset }, function (value, key) {
              
                // Only make the request if there's been an update.
                if (value && value.length) {
                    
                    // Table names will be be prefixed with 'day_' or 'week_'
                    powerBi.addRows(datasetId, [key,'per_agent'].join('_'), value).then(function(result) {
                        console.log([key,'per_agent'].join('_') + ' sent ' + value.length + ' rows.');
                    }).catch(function(error) {
                        console.log(error);
                    });
                    
                    // Table names will be be prefixed with 'day_' or 'week_'
                    powerBi.addRows(datasetId, [key,'aggregated'].join('_'), value).then(function(result) {
                        console.log([key,'aggregated'].join('_') + ' sent ' + value.length + ' rows.');
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