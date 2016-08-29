'use strict'

var Promise = require('bluebird');
var r = require('rethinkdb');

var db = require('./db');
var config = require('./config');

var models = require('./models/models');

db.init({ db: 'icws' })
.then(models.init)
.then(function () {
    console.log('Listening for changes in interaction')
    models.models.Interaction.listen(function (err, value) {
        if (err) { console.log(err); }
        if (value) { console.log(value); }
    });

    console.log('Listening for changes in agent')
    models.models.Agent.listen(function (err, value) {
        if (err) { console.log(err); }
        if (value) { console.log(value); }
    });
});