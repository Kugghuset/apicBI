'use strict'

var express = require('express');
var path = require('path');

var auth = require('./services/auth');

var root = path.resolve(__dirname);

var app = express();

/**
 * @param {Express} app
 */
module.exports = function (app) {
    app.get('/available-agents', auth.isAuthenticated(), function (req, res) {
        return res.render('main', { script: 'available-agents', workgroup: req.query.wg, statType: req.query.st, debug: /^true$/i.test(req.query.debug) });
    });

    app.get('/current-queue', auth.isAuthenticated(), function (req, res) {
        return res.render('main', { script: 'current-queue', workgroup: req.query.wg, statType: req.query.st, debug: /^true$/i.test(req.query.debug) });
    });

    app.get('/', auth.isAuthenticated(), function (req, res) {
        return res.render('main', { script: 'default', workgroup: req.query.wg, statType: req.query.st, debug: /^true$/i.test(req.query.debug) })
    });

    // Front end stuff
    app.use(express.static(root + '/www'));

    // Back end app
    app.use('/api', require('./api/index'));
}
