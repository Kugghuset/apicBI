'use strict'

var express = require('express');
var router = express.Router();

var data = require('./../data/index');

router.get('/agent-stats', function (req, res) {
    res.status(200).json(data.data.agents.getAgentStats());
});

router.get('/queue-stats', function (req, res) {
    res.status(200).json(data.data.queue.getQueueStats());
});

module.exports = router;
