
var env = require('node-env-file');
env('./.env');

var icwsCtrl = require('./controllers/icwsController');
var utils = require('./lib/utils');

var icws = require('./lib/icwsModule');


// icws.auth()
// .then(function (data) {
//     console.log(data);
// })
// .catch(function (err) {
//     console.log(err);
// })

icwsCtrl.run();

