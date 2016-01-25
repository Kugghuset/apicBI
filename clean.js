var chalk = require('chalk');
var env = require('node-env-file');
env('./.env');

var _ = require('lodash');

var ArgValues = require('./lib/argValues');
var AzureAuth = require('./lib/azureAuth');
var PowerBi = require('./lib/powerBi');

/**
 * Prints the error in a red color.
 * param {Any} err
 */
function printError(message, err) {
  console.log(chalk.red(message));
  console.log(err);
  console.log('\n');
}

var azure = new AzureAuth();

new ArgValues(['dataset']).then(function(args) {
    azure.getToken().then(function(data) {
        var powerBi = new PowerBi(data.token);
        powerBi.listTables(args.dataset, false).then(function(result) {
            for(var a = 0; a < result.tables.length; a++) {
                powerBi.clearTable(result.dataset.id, result.tables[a].name).then(function(result) {
                    console.log(result);
                }).catch(function(error) { printError('Something went wrong', error); });
            }
        }).catch(function(error) { printError('Something went wrong', error); });
    }).catch(function(error) { printError('Something went wrong', error); });
}).catch(function(error) { printError('Something went wrong', error); });;