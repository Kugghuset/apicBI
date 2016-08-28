
var _ = require('lodash');
var Promise = require('bluebird');
var MyRequest = require('./myRequest');
var stateHandler = require('../controllers/stateHandler');

/**
 * Constructor for ICWS. Sets the ICWS url, username and password properties
 * used by request method and the auth method
 * @return null
 */
function ICWS() {
    this.setHost();
    this.username = process.env.ICWS_USERNAME;
    this.password = process.env.ICWS_PASSWORD;
}

ICWS.prototype = {
    token: '',
    sessionId: '',
    cookies: [],
    /**
     * Make a request to the ICWS API
     * @param {string} method Request method
     * @param {string} dir Location (append to url)
     * @param {object} body Body content
     * @param {object} headers Any headers to pass
     * @return {object} Promise of request to ICWS
     */
    request: function(method, dir, body, headers, tryCounter) {
        //tryCounter is used for counting the request tries when using alternativ hosts
        if(typeof tryCounter == 'undefined') {
            tryCounter = 0;
        }

        //Add accept-language header if not already set
        if(typeof headers['Accept-Language'] == 'undefined') {
            headers['Accept-Language'] = 'en-us';
        }
        //Add content-type header if not already set
        if(typeof headers['Content-Type'] == 'undefined') {
            headers['Content-Type'] = 'application/vnd.inin.icws+JSON';
        }
        //If token is not empty add it as header
        if(typeof headers['ININ-ICWS-CSRF-Token'] == 'undefined' && this.token != '') {
            headers['ININ-ICWS-CSRF-Token'] = this.token;
        }
        //If cookie is not empty, add it as header
        if(typeof headers['Cookie'] == 'undefined' && this.cookies.length > 0) {
            headers['Cookie'] = this.cookies;
        }
        //If session ID is not empty add it to the url
        var url = this.url;
        if(this.sessionId != '') {
            url += this.sessionId + '/';
        }
        url += dir;
        var that = this;
        //Return promise of request to ICWS
        return new Promise(function(resolve, reject) {

            return MyRequest.request(method, url, headers, JSON.stringify(body)).then(function(result) {
                //Parse body as json for easier handling

                // JSON.parse might fail.
                if (result.body) {
                    try { result.body = JSON.parse(result.body); }
                    catch (err) { return reject(err); }
                }

                /*Check status code and if not 2xx try with an alternate host (chech if alternate host exists)
                Also a counter (tryCounter) is used to keep track of numbers of alternate host attempts and
                prevents an infinite loop*/
                if(Math.floor(result.response.statusCode / 100) != 2 && typeof (result.body.alternateHostList || {})[0] != 'undefined' && tryCounter <= 10) {
                    that.setHost(result.body.alternateHostList[0]);
                    that.request(method, dir, body, headers, tryCounter+1).then(function(result) {
                        resolve(result);
                    }).catch(function(error) {
                        reject(error);
                    });
                } else if(Math.floor(result.response.statusCode / 100) != 2) { //Still error response code and no alternative host and/or the try counter has exceded
                    reject({ status: false, code: result.response.statusCode, message: result.response.statusMessage, error: result.body.message });
                } else { //The response code was 2xx and the result will be resolved
                    resolve(result);
                }
            }).catch(function(error) { //Throw error if any
                reject(error);
            });
        });
    },
    /**
     * Short-hand method for making GET-requests to the ICWS API
     * @param {string} dir Directory to call
     * @param {object} body Body as object, no string as the request method stringify it
     * @param {object} headers Headers to pass to request method
     * @return {object} Object of this.request method
     */
    get: function(dir, body, headers) {
        if(typeof headers == 'undefined') { //Create empty object of headers if not set
            headers = {};
        }
        return this.request('get', dir, body, headers);
    },
    /**
     * Short-hand method for making POST-requests to the ICWS API
     * @param {string} dir Directory to call
     * @param {object} body Body as object, no string as the request method stringify it
     * @param {object} headers Headers to pass to request method
     * @return {object} Object of this.request method
     */
    post: function(dir, body, headers) {
        if(typeof headers == 'undefined') { //Create empty object of headers if not set
            headers = {};
        }
        return this.request('post', dir, body, headers);
    },
    /**
     * Short-hand method for making PUT-requests to the ICWS API.
     * @param {string} dir Directory to call
     * @param {object} body Body as object, no string as the request method stringify it
     * @param {object} headers Headers to pass to request method
     * @return {object} Object of this.request method
     */
    put: function(dir, body, headers) {
        if(typeof headers == 'undefined') { //Create empty object of headers if not set
            headers = {};
        }
        return this.request('put', dir, body, headers);
    },
    /**
     * Short-hand method for making DELETE-requests to the ICWS API.
     * @param {string} dir Directory to call
     * @param {object} body Body as object, no string as the request method stringify it
     * @param {object} headers Headers to pass to request method
     * @return {object} Object of this.request method
     */
    delete: function(dir, body, headers) {
        if(typeof headers == 'undefined') { //Create empty object of headers if not set
            headers = {};
        }
        return this.request('delete', dir, body, headers);
    },
    /**
     * Authenticate to the ICWS API and set cookie, token and session ID
     * @return {object} Promise of request to ICWS API authentication call
     */
    auth: function() {
        this.cookies = [];
        this.token = '';
        this.sessionId = '';

        var that = this;
        return new Promise(function(resolve, reject) {
            that.post('connection', { //Body for authentication
                '__type': 'urn:inin.com:connection:icAuthConnectionRequestSettings',
                'applicationName': 'ICWS Example Application',
                'userID': that.username,
                'password': that.password
            }).then(function(result) { //Successfull authentication. Set cookie, token and session ID
                that.cookies = result.response.headers['set-cookie'];
                that.token = result.body.csrfToken;
                that.sessionId = result.body.sessionId;

                resolve(result);
            }).catch(function(error) {
                reject(error);
            });
        });
    },

    /**
     * Returns a promise of whether the current ICWS object is properly
     * connceted to the ICWS server.
     *
     * @return {Promise}
     */
    checkConnection: function () {
        return new Promise(function (resolve, reject) {

            this.get('/connection')
            .then(function (res) {

                var _body = res.body || {};

                if (_body.code >= 400 || _body.connectionState === 2) {
                    return resolve(false);
                }

                resolve(true);

            }).catch(function (err) {

                // We're not properly connected.
                resolve(false);
            });

        }.bind(this));
    },

    /**
     * First tries to use *authObj*, then tries to read the and use the locally stored authentication,
     * and if it doesn't work, uses the regaular auth function.
     *
     * If a new authentication is made, it's stored.
     *
     * Returns a Promise which resolves when authenticated.
     *
     * @param {Object} authObj
     * @param {Boolean} getNew
     * @return {Promise} -> {Object}
     */
    getAuthenticated: function (authObj, getNew) {

        if (getNew) {

            // Authenticate using this.auth()
            return new Promise(function (resolve, reject) {

                this.auth()
                .then(function () {
                    resolve(
                        stateHandler.storeICWSAuth(this.cookies, this.token, this.sessionId)
                    );
                }.bind(this))
                .catch(reject);

            }.bind(this));

        } else {
            // Use any locally stored data instead.

            // If *authObj* is undefined or falsy, the system will use the stored credentials.
            var useLocal = !authObj;

            authObj = !_.isUndefined(authObj)
                ? authObj
                : stateHandler.readICWSAuth();

            if (!_.isUndefined(authObj)) {
                this.cookies = authObj.cookies;
                this.token = authObj.token;
                this.sessionId = authObj.sessionId;
            }

            // If none has a value, authenticate again.
            if (!_.every([ this.cookies, this.token, this.sessionId ])) {
                return this.getAuthenticated(authObj, true);
            }

            // Resolve for the check of credentials block.
            // Returns a promise of whether the current ICWS object is properly connected or not.
            return this.checkConnection()
            .then(function (isAuthenticated) {

                if (!isAuthenticated) {
                    return this.getAuthenticated(authObj, true);
                } else {

                    return new Promise(function (resolve, reject) {
                        // ICWS object is authenticated!

                        // If they already are stored locally, don't save them,
                        // otherwise save and resolve the data.
                        return resolve(
                            useLocal
                                ? { cookies: this.cookes, token: this.token, sessionId: this.sessionId }
                                : stateHandler.storeICWSAuth(this.cookes, this.token, this.sessionId)
                        )
                    });
                }

            }.bind(this))
            .catch(function () {
                // Something went wrong, so try proper auth.
                return this.getAuthenticated(authObj, true);
            });
        }
    },

    /**
     * Sets the connection url to use when making requests
     * @param {string} host Host (if any) to use for the ICWS API
     * @return {null}
     */
    setHost: function(host) {
        var useHost = process.env.ICWS_SERVER;
        if (typeof host != 'undefined') {
            useHost = host
        }
        console.log('Set host: ' + useHost);
        this.url = 'http://' + useHost + ':' + process.env.ICWS_PORT + '/icws/';
    }
}

module.exports = ICWS;