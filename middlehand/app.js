'use strict'

var Promise = require('bluebird');
var r = require('rethinkdb');

var db = require('./db');
var config = require('./config');

db.init({ db: 'icws' })
.then(function () {
    return db.initTable('agents');
})
.then(function () {
    return db.table('agents').run(db.conn());
})
.then(function (agents) {
    agents.each(function (err, agent) {
        if (err) {
            console.log(err)
        } else {
            console.log(agent)
        }
    })
})
// .then(function (agents) {
//     console.log(agents)
// })
