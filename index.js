
var env = require('node-env-file');
env('./.env');

var icwsCtrl = require('./controllers/icwsController');

icwsCtrl.run();

