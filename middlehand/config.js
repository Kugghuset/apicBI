'use strict'

var path = require('path');
var env = require('node-env-file');
env(path.resolve(__dirname, './../.env-middlehand'));

module.exports = {
    db: 'icws',
    db_port: process.env.DB_PORT || 28015,
    db_host: process.env.DB_HOST || '127.0.0.1',
    db_user: process.env.DB_USER || 'admin',
    db_password: process.env.DB_PASSWORD || undefined,
    port: process.env.PORT || 3000,
    pusher: {
        app_id: process.env.PUSHER_APP_ID || -1,
        app_key: process.env.PUSHER_ID || -1,
        id: process.env.PUSHER_ID || -1,
        secret: process.env.PUSHER_SECRET || '',
        cluster: process.env.PUSHER_CLUSTER || -1,
    },
    app_secret: process.env.APP_SECRET || 'sshhh',
}
