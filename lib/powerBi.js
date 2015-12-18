var request = require('request');
var Promise = require('bluebird');

var url = 'https://api.powerbi.com/v1.0/myorg/';


function PowerBi(token) {
    this.token = token;
}

PowerBi.prototype = {
    dataset: 'default_dataset',
    url: 'https://api.powerbi.com/v1.0/myorg/',
    request: function(method, dir, type, data) {
        var that = this;
        return new Promise(function(resolve, reject) {
            request({
                method: method,
                url: that.url + dir,
                headers: {
                    'Authorization': 'Bearer ' + that.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }, function(error, response, body) {
                if(error) {
                    reject(error);
                    return;
                }

                //console.log(body);

                resolve({ response: response, body: body });
            });
        });
        return request({
            method: method,
            url: this.url + dir,
            headers: {
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
    },
    get: function(dir, data) {
        return this.request('get', dir, this.token, data);
    },
    post: function(dir, data) {
        return this.request('post', dir, this.token, data);
    },
    datasetExists: function(dataset) {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.get('datasets', {}).then(function(data) {
                var foundDataset = {};
                var values = JSON.parse(data.body).value
                for(a = 0; a < values.length; a++) {
                    if(values[a].name == dataset) {
                        foundDataset = values[a];
                    }
                }

                if(typeof foundDataset.id != 'undefined') {
                    resolve({ status: true, dataset: foundDataset });
                }

                resolve({ status: false });
            }).catch(function(error) {
                reject(error);
            });
        });
    },
    init: function(dataset) {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.datasetExists(dataset).then(function(result) {
                if(!result.status) {
                    that.post('datasets?defaultRetentionPolicy=None', require(global.root + '/assets/datasets/' + dataset + '.js')).then(function(data) {
                        resolve({ status: true, message: 'Dataset "' + dataset + '" has been uploaded to your Power BI!' });
                    }).catch(function(error) {
                        reject(error);
                    });
                } else {
                    resolve({status: false, message: 'Dataset already exists. No action was taken'});
                }
            }).catch(function(error) {
                reject(error);
            });
        });
    },
    test: function(token) {
        request.post({
            url: url + '/datasets/e386a860-6ed0-4989-bde1-cd0111de47ad/tables/Product/rows',
            headers: {
                'Authorization': 'Bearer ' + this.token,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({
                'rows':
                    [
                        {
                            'ProductID': 11,
                            'Name': 'Jag testar igen',
                            'Category': 'Components',
                            'IsCompete': true,
                            'ManufacturedOn': '07/30/2014'
                        }
                    ]
            })
        });
    }
}

module.exports = PowerBi;