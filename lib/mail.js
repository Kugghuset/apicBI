var _ = require('lodash');
var Promise = require('bluebird');
var env = require('node-env-file');
var moment = require('moment');

var config = require('../configs/mail');

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

        console.log('Will not send any emails as it\'s forbidden.');

        console.log('Would have sent:\n\n' + [
            'Receiver(s): ' + config.receivers.join(', '),
            'Subject: ' + subject,
            '',
            'Body:',
            body
        ]);

        return resolve({ status: 'Message not sent.' });
    });
}

module.exports = {
    send: send
};
