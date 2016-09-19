'use strict'

process.env.APP_NAME = 'ApicBI_Middlehand';

var _ = require('lodash');
var r = require('rethinkdb');
var Promise = require('bluebird');
var bodyParser = require('body-parser');
var path = require('path');
var exphbs = require('express-handlebars');
var express = require('express');

var logger = require('./logger');
var db = require('./db');
var config = require('./config');

var app = express();
var handlebars = exphbs.create({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, '/www/views'),
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true, folder: './middlehand' }));

app.set('views', path.join(__dirname, '/www/views'));
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

require('./routes')(app);

var models = require('./models/models');
var data = require('./data/index');

db.init({ db: 'icws' })
.then(models.init)
.then(function () {
    serve();
    data.init();
})
.catch(function (err) {
    logger.log('Failed to start app', 'error', { error: err.toString() });
})

function serve() {
    var server = app.listen(config.port, 'localhost', function () {
        var host = server.address().address;
        var port = server.address().port;

        logger.log('App listening on ' + host + ' on port ' + port);
    });

}
