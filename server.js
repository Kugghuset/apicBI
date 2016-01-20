global.root = __dirname;

var env = require('node-env-file');
var later = require('later');
env(global.root + '/.env');

var DB2BI = require(global.root + '/controllers/db2bi.js');

later.setInterval(function() {
    DB2BI.read();
}, later.parse.recur().every(10).second());