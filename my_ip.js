'use strict'

var request = require('request');

request({
    method: 'GET',
    uri: 'http://icanhazip.com',
}, function (err, res, body) {
    console.log(body)
});

