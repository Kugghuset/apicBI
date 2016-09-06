'use strict'

var chalk = require('chalk');
var env = require('node-env-file');
env('./.env');

if (!process.env.APP_NAME) {
    process.env.APP_NAME = 'utility';
}

var _ = require('lodash');

var config = require('./configs/database');

var logger = require('./middlehand/logger');

var ArgValues = require('./lib/argValues');
var AzureAuth = require('./lib/azureAuth');
var PowerBi = require('./lib/powerBi');

/**
 * Prints the error in a red color.
 * param {Any} err
 */
function printError(err) {
    logger.log('Something went wrong', 'error', { error: _.isError(err) ? err.toString() : err });
}

var azure = new AzureAuth();

new ArgValues(['dataset']).then(function(args) {
    var _dataset = /icws/i.test(args.dataset)
        ? config.dataset_icws
        : config.dataset;

    azure.getToken().then(function(data) {
        var powerBi = new PowerBi(data.token);
        powerBi.listTables(_dataset, false).then(function(result) {
            for(var a = 0; a < result.tables.length; a++) {
                powerBi.clearTable(result.dataset.id, result.tables[a].name).then(function(result) {
                    logger.log('Table cleared', 'info', result);
                }).catch(printError);
            }
        }).catch(printError);
    }).catch(printError);
}).catch(printError);;