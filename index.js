'use strict'

process.env.APP_NAME = 'Apic_ICWS';

var env = require('node-env-file');
env('./.env');

var express = require('express');
var path = require('path');

var config = require('./configs/database');
var icwsCtrl = require('./controllers/icwsController');
var utils = require('./lib/utils');
var icws = require('./lib/icwsModule');
var logger = require('./middlehand/logger');

var app = express();
var root = path.resolve();

app.use(express.static(root + '/www'));

var router = new express.Router();

router.get('/api/resources', function (req, res) {
  var users = icwsCtrl.getUsers();
  var userInfo = icwsCtrl.getUserStats();
  var interactions = icwsCtrl.getInteractions();
  var queueInfo = icwsCtrl.getQueueStats();

  res.status(200).json({ users: users, userInfo: userInfo, interactions: interactions, queueInfo: queueInfo });
});

router.get('/api/users', function (req, res) {
  var users = icwsCtrl.getUsers();

  res.status(200).json(users);
});

router.get('/api/interactions', function (req, res) {
  var interactions = icwsCtrl.getInteractions();

  res.status(200).json(interactions);
});

router.get('/api/queue-info', function (req, res) {
  var queueInfo = icwsCtrl.getQueueStats();

  res.status(200).json(queueInfo);
});

app.use(router);

if (config.icws_app_server) {
  var server = app.listen(config.icws_app_port, 'localhost', function () {
      var host = server.address().address;
      var port = server.address().port;

      logger.log('App listening on ' + host + ' on port ' + port);

      icwsCtrl.run();
  });

} else {
  logger.log('ICWS app starting.', 'info');
  icwsCtrl.run();
}
