var Promise = require('bluebird');
var MyRequest = require(global.root + '/lib/myRequest.js')

function ICWSAuth() {
    this.serverAddress = 'http://' + process.env.ICWS_SERVER + ':' + process.env.ICWS_PORT + '/icws';
    this.username = process.env.ICWS_USERNAME;
    this.password = process.env.ICWS_PASSWORD;
}

ICWSAuth.prototype = {
    token: 'default_token',
    sessionId: 'default_session_id',
    cookies: [],
    getToken: function() {
        var that = this;
        return new Promise(function(resolve, reject) {
            return MyRequest.request('POST', that.serverAddress + '/connection', {
                'Accept-Language': 'en-us'
            }, JSON.stringify({
                '__type': 'urn:inin.com:connection:icAuthConnectionRequestSettings',
                'applicationName': 'ICWS Example Application',
                'userID': that.username,
                'password': that.password
            })).then(function(result) {
                result.body = JSON.parse(result.body);
                
                that.cookies = result.response.headers['set-cookie'];
                that.token = result.body.csrfToken;
                that.sessionId = result.body.sessionId;
                
                resolve(result);
            }).catch(function(error) {
                reject(error);
            });
        });
    }
}

module.exports = ICWSAuth;