
var env = require('node-env-file');
env('./.env');

var icwsCtrl = require('./controllers/icwsController');

// icwsCtrl.run();

var azure = require('./lib/azure');
var PowerBi = require('./lib/powerBi');
var stateHandler = require('./controllers/stateHandler');

azure.getToken('local')
.then(function (token) {
    var powerBi = new PowerBi(token);
    
    return stateHandler.getDataset('ApicBI', powerBi, true);
})
.then(function (datasets) {
    console.log('datasets:');
    console.log(datasets);
})
.catch(function (err) {
    console.log(err);
})


