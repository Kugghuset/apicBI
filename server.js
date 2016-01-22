global.root = __dirname;

var env = require('node-env-file');
var later = require('later');
env(global.root + '/.env');

var DB2BI = require('./controllers/db2bi');
var PowerBI = require('./lib/powerBi');


// Schedule which will run every 10 seconds
var every10Seconds = later.parse.recur()
    .every(10).second();


// Schedule which will run at the change och day, every day.
var everyStartOfDay = later.parse.recur()
    .first().hour();


// Schedule which will run at the change of weeks.
var everyStartOfWeek = later.parse.recur()
    .on(2).dayOfWeek()
    .first().hour();

// Regular update
later.setInterval(DB2BI.read, every10Seconds);

// Daily clearing of the daily table
later.setInterval(function () {
    // Clear the day_per_agent table in ApicBI
    // INSERT HERE
}, everyStartOfDay);

// Weekly clearing of the weekly table
later.setInterval(function () {
    // Clear the week_per_agent table in ApicBI
    // INSERT HERE
}, everyStartOfWeek);
