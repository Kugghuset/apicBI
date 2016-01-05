var AuthenticationContext = require('adal-node').AuthenticationContext
var Promise = require('bluebird');

var AzureAuth = function() {
    this.authorityHostUrl = 'https://login.windows.net';
    this.authorityUrl = this.authorityHostUrl + '/' + process.env.AZURE_DOMAIN;
    this.resource = 'https://analysis.windows.net/powerbi/api';

    this.clientId = process.env.AZURE_CLIENT_ID;
    this.clientUsername = process.env.AZURE_CLIENT_USERNAME;
    this.clientPassword = process.env.AZURE_CLIENT_PASSWORD;

    this.context = new AuthenticationContext(this.authorityUrl);
}

AzureAuth.prototype = {
    token: 'default_token',
    refreshToken: 'default_refresh_token',
    getToken: function() {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.context.acquireTokenWithUsernamePassword(that.resource, that.clientUsername, that.clientPassword, that.clientId, function(error, response) {
                if (error) {
                    reject(error);
                    console.log('Error fetching access token for AZURE authentication: ' + error.stack);
                }

                that.token = response.accessToken;
                that.refreshToken = response.refreshToken;

                resolve({token: response.accessToken, refreshToken: response.refreshToken});
            });
        });
    },
    getTokenRefresh: function() {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.context.acquireTokenWithRefreshToken(that.refreshToken, that.clientId, null, function(error, response) {
                if (error) {
                    reject(error);
                }

                that.token = response.accessToken;
                that.refreshToken = response.refreshToken;

                resolve({ token: response.accessToken, refreshToken: response.refreshToken });
            });
        });
    }
}

module.exports = AzureAuth;