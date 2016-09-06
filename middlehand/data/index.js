'use strict'

var _ = require('lodash');
var r = require('rethinkdb');
var Pusher = require('pusher');

var config = require('./../config');
var db = require('./../db');
var utils = require('./../utils');

var dataQueue = require('./data.queue');
var dataAgents = require('./data.agents');

var Pusher = require('pusher');

var pusher = new Pusher({
  appId: config.pusher.app_id,
  key: config.pusher.app_key,
  secret: config.pusher.secret,
  cluster: config.pusher.cluster,
  encrypted: true
});


function init() {
    // Setup subscriptions

    dataQueue.listen();
    dataAgents.listen();

    dataAgents.onStatsUpdated(function (stats) {
        pusher.trigger('dev', 'agent-stats', stats);
    });

    dataQueue.onStatsUpdated(function (stats) {
        pusher.trigger('dev', 'queue-stats', stats);
    })
}



module.exports = {
    init: init,
    data: {
        queue: dataQueue,
        agents: dataAgents,
    }
}
