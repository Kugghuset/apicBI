var AuthenticationContext = require('adal-node').AuthenticationContext
var Promise = require('bluebird');
var moment = require('moment');

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
    tokenExpiresOn: undefined,
    refreshToken: 'default_refresh_token',
    /**
     * Get token for Azure API
     * @return {object} Promise of token or error
     */
    getToken: function() {
        //Check if an expiration date is set for the token and if its about to expire in 5 minutes
        var that = this;
        return new Promise(function(resolve, reject) {
            //If token expire is set and it is not about to expire (5 minute to expire)
            if(that.tokenExpiresOn && moment().add(5, 'minutes').isBefore(that.tokenExpiresOn)) {
                resolve({token: that.accessToken, refreshToken: that.refreshToken});
                return;
            //Else if token expire is set nad is about to expire (date is between expire date minus 5 minutes AND expire date)
            } else if(that.tokenExpiresOn && moment().isBetween(that.tokenExpiresOn.subtract(5, 'minutes'), that.tokenExpiresOn)) {
                that.getTokenRefresh().then(function(result) {
                    resolve(result);
                }).catch(function(error) {
                    reject(error);
                });
                return;
            }
            
            //Token is not set or has expired, try to fetch new token
            that.acquireToken(function(error, response) {
                if (error) { //If any error occure, reject and end
                    reject(error);
                    return;
                }
                
                //Set token, token expiration date and the refresh token
                that.token = response.accessToken;
                that.tokenExpiresOn = moment(new Date(response.expiresOn)).toDate();
                that.refreshToken = response.refreshToken;
                //Resolve with info
                resolve({token: response.accessToken, refreshToken: response.refreshToken});
            });
        });
    },
    /**
     * Use refresh token to fetch new token
     * @return {object} Promise of success or fail
     */
    getTokenRefresh: function() {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.acquireRefreshToken(function(error, response) {
                if (error) {
                    that.getToken().then(function(result) {
                        resolve(result);
                    }).catch(function(error) {
                        reject(error);
                    });
                    
                    return;
                }

                that.token = response.accessToken;
                that.refreshToken = response.refreshToken;

                resolve({ token: response.accessToken, refreshToken: response.refreshToken });
            });
        });
    },
    /**
     * adal-mode acquire token method
     * @param {function} callback to use
     * @return {object} acquire token return
     */
    acquireToken: function(callback) {
        this.context.acquireTokenWithUsernamePassword(this.resource, this.clientUsername, this.clientPassword, this.clientId, callback);
    },
    /**
     * adal-mode acquire refresh token method
     * @param {function} callback to use
     * @return {object} acquire refresh token return
     */
    acquireRefreshToken: function(callback) {
        this.context.acquireTokenWithRefreshToken(this.refreshToken, this.clientId, null, callback);
    }
}

module.exports = AzureAuth;