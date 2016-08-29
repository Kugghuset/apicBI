var Promise = require('bluebird');
var AzureAuth = require('../lib/azureAuth');
var PowerBi = require('../lib/powerBi');
var env = require('node-env-file');
env('./.env');

var config = require('./../configs/database');

function ClearTable() {}

ClearTable.run = function(table) {
    if(table == 'daily') { table = 'day_per_agent'; }
    else if(table == 'weekly') { table = 'week_per_agent'; }
    else if (table == 'icws_daily') { table = 'icws_agent_daily'; }
    else if (table == 'icws_weekly') { table = 'icws_agent_weekly'; }

    var _dataset = /icws/i.test(table)
        ? config.dataset_icws
        : config.dataset;

    var azure = new AzureAuth();
    azure.getToken().then(function(data) {
        var powerBi = new PowerBi(data.token);
        powerBi.datasetExists(_dataset).then(function(result) {
            powerBi.clearTable(result.dataset.id, table).then(function(result) {
                console.log(result);
            }).catch(function(error) {
                console.log(error);
            });
        }).catch(function(error) { console.log(error); });
    }).catch(function(error) { console.log(error); });
}

module.exports = ClearTable;