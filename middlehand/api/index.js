'use strict'

var express = require('express');
var router = express.Router();

var auth = require('./../services/auth');

var data = require('./../data/index');

router.get('/agent-stats', auth.isAuthenticated(), function (req, res) {
    res.status(200).json(data.data.agents.getAgentStats());
});

router.get('/queue-stats', auth.isAuthenticated(), function (req, res) {
    res.status(200).json(data.data.queue.getQueueStats());
});

module.exports = router;
