var _ = require('lodash');

var receivers = _.isString(process.env.OUTBOUND_RECEIVERS)
    ? process.env.OUTBOUND_RECEIVERS.split(';')
    : [];

var mail = {
    mandrill_token: process.env.MANDRILL_CLIENT_TOKEN || '',
    outbound_email: process.env.OUTBOUND_EMAIL || 'example@email.com',
    outbound_name: process.env.OUTBOUND_NAME || 'example@email.com',
    receivers: receivers
}

module.exports = mail;