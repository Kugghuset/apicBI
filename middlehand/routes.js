'use strict'

var express = require('express');
var path = require('path');

var root = path.resolve(__dirname);

var app = express();

/**
 * @param {Express} app
 */
module.exports = function (app) {
    // Front end stuff
    app.use(express.static(root + '/www'));

    // Back end app
    app.use('/api', require('./api/index'));
}
