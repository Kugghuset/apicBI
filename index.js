'use strict'

var env = require('node-env-file');
env('./.env');

var express = require('express');
var path = require('path');

var icwsCtrl = require('./controllers/icwsController');
var utils = require('./lib/utils');
var icws = require('./lib/icwsModule');

var app = express();
var root = path.resolve();


app.use(express.static(root + '/www'));

var router = new express.Router();

router.get('/users', function (req, res) {
  var users = icwsCtrl.getUsers();

  res.status(200).json(users);
});

router.get('/interactions', function (req, res) {
  var interactions = icwsCtrl.getInteractions();

  res.status(200).json(interactions);
});

app.use(router);

var server = app.listen(5000, 'localhost', function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('App listening on %s on port %s', host, port);

    icwsCtrl.run();
});
