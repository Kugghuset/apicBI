var request = require('request');
var Promise = require('bluebird');

function MyRequest() {}

MyRequest.request = function(method, url, headers, body) {
    return new Promise(function(resolve, reject) {
        request({
            method: method,
            url: url,
            headers: headers,
            body: body
        }, function(error, response, body) {
            if(error) {
                reject(error);
                return;
            }
            resolve({ response: response, body: body });
        });
    });
}
MyRequest.get = function(url, headers, body) {
    return this.request('get', url, headers, body);
}

MyRequest.post = function(url, headers, body) {
    return this.request('post', url, headers, body);
}

module.exports = MyRequest;
