var chalk = require('chalk');
var env = require('node-env-file');
env('./.env');

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
    console.log('\n');
    console.log(chalk.red('Something went wrong.'));
    console.log(err);
    console.log('\n');
}

new ArgValues(['dataset']).then(function(args) {
    azure.getToken().then(function(data) {
        var powerBi = new PowerBi(data.token);
        if(!_.isUndefined(args.reinit)) {
            powerBi.reInit(args.dataset, !_.isUndefined(args.table) ? args.table : undefined).then(function(result) {
                console.log(result);
            }).catch(printError);
        } else {
            powerBi.init(args.dataset).then(function(result) {
                console.log(result.message);
            }).catch(printError);
        }
    }).catch(printError);
}).catch(printError);