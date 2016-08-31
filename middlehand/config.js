'use strict'

var path = require('path');
var env = require('node-env-file');
env(path.resolve(__dirname, './../.env-middlehand'));

// console.log(process.env)

module.exports = {
    db: 'icws',
    db_port: 28015,
    host: '127.0.0.1',
    port: process.env.PORT || 3000,
    pusher: {
        app_id: process.env.PUSHER_APP_ID || -1,
        app_key: process.env.PUSHER_ID || -1,
        id: process.env.PUSHER_ID || -1,
        secret: process.env.PUSHER_SECRET || '',
        cluster: process.env.PUSHER_CLUSTER || -1,
    }
}
