'use strict'

var winston = require('winston');
var Promise = require('bluebird');
var path = require('path');
var fs = require('fs');

var relativeLogPath = '../.logs/';
var sLogFileName = 'logfile.log';
var logPath = path.resolve(__dirname, relativeLogPath, process.env.APP_NAME);

if (!fs.existsSync(path.dirname(logPath))) {
  fs.mkdirSync(path.dirname(logPath));
}

var logger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            json: false,
            colorize: true,
            timestamp: true,
        }),
        new winston.transports.File({
            level: 'debug',
            name: 'logfile',
            filename: logPath,
            maxsize: 5242880, // 5 MB
        }),
    ],
    exitOnError: true
});


/**
 * @param {String} message
 * @param {String} [level='info']
 * @param {Any} [meta]
 * @return {LoggerInstance}
 */
function log(message, level, meta) {
    level = typeof level === 'undefined' ? 'info': level;

    return typeof meta === 'undefined'
        ? logger.log(level, message)
        : logger.log(level, message, meta);
}

/**
 * @param {Any} data
 * @param {String} message
 * @param {String} [level='info']
 * @param {Any} [meta]
 * @return {Promise<Any>}
 */
function logResolve(data, message, level, meta) {
    log(message, level, meta);
    return Promise.resolve(data);
}

/**
 * @param {Any} data
 * @param {String} message
 * @param {String} [level='info']
 * @param {Any} [meta]
 * @return {Promise<Any>}
 */
function logReject(data, message, level, meta) {
    log(message, level, meta);
    return Promise.reject(data);
}

module.exports = {
    logger: logger,
    log: log,
    logResolve: logResolve,
    logReject: logReject,
}
