var chalk = require('chalk');
var env = require('node-env-file');
env('./.env');

var _ = require('lodash');

var config = require('./configs/database');

var ArgValues = require('./lib/argValues');
var AzureAuth = require('./lib/azureAuth');
var PowerBi = require('./lib/powerBi');

/**
 * Prints the error in a red color.
 * param {Any} err
 */
function printError(err) {
    console.log('\n');
    console.log(chalk.red('Something went wrong.'));
    console.log(err);
    console.log('\n');
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
                    console.log(result);
                }).catch(printError);
            }
        }).catch(printError);
    }).catch(printError);
}).catch(printError);;