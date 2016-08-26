'use strict'

var Promise = require('bluebird');
var r = require('rethinkdb');

var db = require('./db');
var config = require('./config');

var Agent = require('./models/agent');
var Interaction = require('./models/interaction');

db.init({ db: 'icws' })
.then(function () {
    setTimeout(function() {
        Agent.insert({  })
    }, 1000);
})
.catch(function (err) {
    console.log(err);
});
