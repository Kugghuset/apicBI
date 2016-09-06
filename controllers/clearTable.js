'use strict'

if (!process.env.APP_NAME) {
    process.env.APP_NAME = 'utility';
}

var Promise = require('bluebird');
var AzureAuth = require('../lib/azureAuth');
var PowerBi = require('../lib/powerBi');
var env = require('node-env-file');
env('./.env');

var logger = require('./../middlehand/logger');

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
                logger.log('Table cleared', 'info', result);
            }).catch(function(error) {
                logger.log('Failed to clear table', 'error', { error: err.toStrring(), tableId: result.dataset.id });
            });
        }).catch(function(error) { logger.log('Failed to clear tables', 'error', { error: err.toStrring() }); });
    }).catch(function(error) { logger.log('Failed to clear tables', 'error', { error: err.toStrring() }); });
}

module.exports = ClearTable;