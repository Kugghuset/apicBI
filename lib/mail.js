var _ = require('lodash');
var Promise = require('bluebird');
var mandrill = require('mandrill-api');
var env = require('node-env-file');

var config = require('../configs/mail');

var mailClient = new mandrill.Mandrill(config.mandrill_token);

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
        
        if (!config.outbound_email || !config.mandrill_token) {
            console.log('No email config set.');
            console.log('Would have sent:\n\n' + [
                'Receiver(s): ' + config.receivers.join(', '),
                'Subject: ' + subject,
                '',
                'Body:',
                body
            ]);
            return resolve({ status: 'Message not sent.' });
        }
        
        mailClient.messages.send({ message: _.assign({}, {
            subject: subject,
            text: body,
            from_email: config.outbound_email,
            from_name: config.outbound_name,
            to: _.map(config.receivers, function (rec) { return {
                email: rec,
                type: 'to'
            }; })
            }, options)},
            resolve,
            reject
        );
    });
}

module.exports = {
    send: send
};
