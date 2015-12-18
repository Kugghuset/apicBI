global.root = __dirname;

var env = require('node-env-file');
env(global.root + '/.env');

var Error = require(global.root + '/lib/error.js');
var AzureAuth = require(global.root + '/lib/azureAuth.js');
var PowerBi = require(global.root + '/lib/powerBi.js');

var azure = new AzureAuth();

azure.getToken()
.then(function(data) {
    var powerBi = new PowerBi(data.token);
    powerBi.datasetExists('ApicBI').then(function(data) {
        if(data.status) {
            console.log('YES');
        } else {
            console.log('NO');
        }
    }).catch(function(error) { Error.print('Something went wrong', error); });
})
.catch(function(error) { Error.print('Something went wrong', error); });