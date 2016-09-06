'use strict'

if (!process.env.APP_NAME) {
    process.env.APP_NAME = 'utility';
}

var chalk = require('chalk');
var env = require('node-env-file');
env('./.env');

var logger = require('./middlehand/logger');

var _ = require('lodash');

var ArgValues = require('./lib/argValues');
var AzureAuth = require('./lib/azureAuth');
var PowerBi = require('./lib/powerBi');

var azure = new AzureAuth();

/**
 * Prints the error in a red color.
 * param {Any} err
 */
function printError(err) {
    logger.log('Something went wrong', 'error', { error: _.isError(err) ? err.toString() : err });
}

new ArgValues(['dataset']).then(function(args) {
    azure.getToken().then(function(data) {
        var powerBi = new PowerBi(data.token);
        if(!_.isUndefined(args.reinit)) {
            powerBi.reInit(args.dataset, !_.isUndefined(args.table) ? args.table : undefined).then(function(result) {
                logger.log('Reinitialized table', 'info', result);
            }).catch(printError);
        } else {
            powerBi.init(args.dataset).then(function(result) {
                logger.log('Initialized table', 'info', result);
            }).catch(printError);
        }
    }).catch(printError);
}).catch(printError);