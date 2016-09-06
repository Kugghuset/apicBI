var _ = require('lodash');
var Promise = require('bluebird');
var env = require('node-env-file');
var moment = require('moment');

var config = require('../configs/mail');

var logger = require('./../middlehand/logger');

/**
 * Sends an email to the receivers in the .env file.
 *
 * OUTBOUND_RECEIVERS in then .env file should be separated by a ';'.
 *
 * @param {string} subject
 * @param {string} body
 * @param {object} options Mandrill options
 * @return {Promise} -> {object}
 */
function send(subject, body, options) {
    return new Promise(function (resolve, reject) {

        logger.log('Will not send any emails as it\'s forbidden.', 'info', { subject: subject, receivers: config.receivers, body: body });

        return resolve({ status: 'Message not sent.' });
    });
}

module.exports = {
    send: send
};
