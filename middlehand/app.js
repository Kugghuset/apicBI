'use strict'

var Promise = require('bluebird');
var r = require('rethinkdb');

var db = require('./db');
var config = require('./config');

var models = require('./models/models');

db.init({ db: 'icws' })
.then(models.init);
