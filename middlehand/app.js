'use strict'

var Promise = require('bluebird');
var r = require('rethinkdb');

var db = require('./db');
var config = require('./config');

var models = require('./models/models');

var Interaction = models.models.Interaction;

db.init({ db: 'icws' })
.then(models.init)
.then(function () {
    // console.log('Listening for changes in interaction')

    Interaction.filter(
        r.row('inQueue')
    )
    .pluck(['inQueue', 'queueTime', 'correctedQueueTime'])
    .run(db.conn(), function (err, cursor) {
        if (err) { console.log(err) }
        else if (cursor) { cursor.each(function (err, item) { console.log(!!err ? err : item); }) }
    })

    Interaction.filter(
        r.row('inQueue')
    )
    .pluck(['inQueue', 'queueTime', 'correctedQueueTime'])
    .changes().run(db.conn(), function (err, cursor) {
        if (err) { console.log(err) }
        else if (cursor) { cursor.each(function (err, item) { console.log(!!err ? err : item); }) }
    })

    // models.models.Interaction.listen(function (err, value) {
    //     if (err) { console.log(err); }
    //     if (value) { console.log(value); }
    // });

    // console.log('Listening for changes in agent')
    // models.models.Agent.listen(function (err, value) {
    //     if (err) { console.log(err); }
    //     if (value) { console.log(value); }
    // });
});