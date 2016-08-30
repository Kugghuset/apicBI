'use strict'

var _ = require('lodash');
var r = require('rethinkdb');
var db = require('./../db');
var utils = require('./../utils');

var dataQueue = require('./data.queue');
var dataAgents = require('./data.agents');

function init() {
    // Setup subscriptions

    dataQueue.listen();
    dataAgents.listen();
}

dataQueue.onStatsUpdated(function (queueStats) {
    console.log('Queue stats updated:');
    console.log(JSON.stringify(queueStats, null, 4));
})

dataAgents.onStatsUpdated(function (agentsStats) {
    console.log('Agents stats updated:');
    console.log(JSON.stringify(agentsStats, null, 4));
})


module.exports = {
    init: init,
}
