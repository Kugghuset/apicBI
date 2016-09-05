'use strict'

var winston = require('winston');
var path = require('path');
var fs = require('fs');

var logger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            json: false,
            timestamp: true,
            colorize: true,
            colors: true,
        }),
        new winston.transports.File({
            level: 'debug',
            name: 'logfile',
            filename: './.logs.logfile.log',
            maxsize: 5242880, // 5 MB
        })
    ],
    exitOnError: true,
});

function log(message, level, meta) {
    level = typeof level === 'undefined' ? 'info': level;

    return typeof meta === 'undefined'
        ? logger.log(level, message)
        : logger.log(level, message, meta);
}

module.exports = {
    logger: logger,
}
