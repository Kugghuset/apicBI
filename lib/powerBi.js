var Promise = require('bluebird');
var MyRequest = require(global.root + '/lib/myRequest.js')

function PowerBi(token) {
    this.token = token;
}

PowerBi.prototype = {
    dataset: 'default_dataset',
    url: 'https://api.powerbi.com/v1.0/myorg/',
    request: function(method, dir, data) {
        var that = this;
        return new Promise(function(resolve, reject) {
            return MyRequest.request(method, that.url + dir, {
                'Authorization': 'Bearer ' + that.token,
                'Content-Type': 'application/json'
            }, JSON.stringify(data)).then(function(result) {
                if(result.body.length > 0 && typeof JSON.parse(result.body).error != 'undefined') {
                    reject(JSON.parse(result.body).error);
                }
                resolve(result);
            }).catch(function(error) {
                reject(error);
            });
        });
    },
    get: function(dir, data) {
        return this.request('get', dir, data);
    },
    post: function(dir, data) {
        return this.request('post', dir, data);
    },
    datasetExists: function(dataset) {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.get('datasets', {}).then(function(data) {
                var foundDataset = {};
                var values = JSON.parse(data.body).value;
                for(a = 0; a < values.length; a++) {
                    if(values[a].name == dataset) {
                        foundDataset = values[a];
                        break;
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
    /**
     * Check if table exists in dataset and return dataset and table if so
     * @param {string} dataset The name of the dataset to search in
     * @param {string} table The name of the table to search for
     * @return {object} Dataset and table as objects
     */
    tableExists: function(dataset, table) {
        var that = this;
        //The result will be returned as a promise
        return new Promise(function(resolve, reject) {
            //First check if dataset exists
            that.datasetExists(dataset).then(function(result) {
                if(result.status) { //If result is true (dataset was found)
                    //Get list of tables in dataset
                    that.get('datasets/' + result.dataset.id + '/tables', {}).then(function(data) {
                        //Variable to hold table info if found
                        var foundTable = {};
                        //Get result list of tables from request
                        var values = JSON.parse(data.body).value;
                        //Loop through all tables in list
                        for(a = 0; a < values.length; a++) {
                            if(values[a].name == table) { //If table name from method parameter exists in list
                                //Set foundTable and end loop with break
                                foundTable = values[a];
                                break;
                            }
                        }
                        //Check if foundTable was set in loop (table was found)
                        if(typeof foundTable.name != 'undefined') {
                            //Resolv with status = true, the dataset and the table
                            resolve({ status: true, dataset: result.dataset, table: foundTable });
                        }
                        
                        //No dataset found, resolve with false
                        resolve({ status: false });
                    }).catch(function(error) { //Catching any error from request
                        reject(error);
                    });
                } else {
                    //If dataset was not found, resolve with false and message
                    resolve({ status: false, message: 'Dataset doesn\'t exists' });
                }
            }).catch(function(error) { //Catching any error from request
                reject(error);
            });
        });
    },
    /**
     * Add one or more rows to a dataset's table
     * @param {string} dataset Name or id of dataset
     * @param {string} table Name of table
     * @param {object} array List of rows to add
     * @param {boolean} datasetAsId If the dataset parameter is the id of the dataset (true) or if it's the name of the dataset (false)
     * @return {object} Status of success or fail in form of a resolve/reject Promise
     */
    addRows: function(dataset, table, rows, datasetAsId) {
        if(typeof datasetAsId == 'undefined') {
            datasetAsId = true;
        }
        
        var that = this;
        /**
         * Method for adding rows to dataset table
         * @param {string} datasetId The ID of the dataset¨
         * @return {object} Status of success or faile in form of a resolve/reject Promise
         */
        var addRowsMethod = function(datasetId) {
            return new Promise(function(resolve, reject) {
                that.post('datasets/' + datasetId + '/tables/' + table + '/rows', {
                    rows: rows
                }).then(function(data) {
                    //Rows was added, set status and message
                    resolve({ status: true, message: 'rows added' })
                }).catch(function(error) { //An error occurd, throw reject
                    reject(error);
                });
            });    
        }
        
        //If dataset parameter is the ID of the dataset, simply call the addRowsMethod with the dataset parameter as dataset id
        if(datasetAsId) {
            return addRowsMethod(dataset);
        }
        
        //If the dataset parameter is the name of the dataset, we need to fetch the ID with the datasetExists method
        return new Promise(function(resolve, reject) {
            that.datasetExists(dataset).then(function(result) {
                //Dataset was found, use the ID with addRowsMethod
                addRowsMethod(result.dataset.id).then(function(result) {
                    resolve(result);
                }).catch(function(error) {
                    reject(error);
                });
            }).catch(function(error) {
                reject(error);
            });
        });
    },
    clearTable: function(dataset, table, datasetAsId) {
        if(typeof datasetAsId == 'undefined') {
            datasetAsId = true;
        }
        
        var that = this;
        
        var clearTableMethod = function(datasetId) {
            return new Promise(function(resolve, reject) {
                that.request('delete', 'datasets/' + datasetId + '/tables/' + table + '/rows', {}).then(function(data) {
                    resolve({ status: true, message: 'Table cleared' })
                }).catch(function(error) { //An error occurd, throw reject
                    reject(error);
                });
            });    
        }
        
        if(datasetAsId) {
            return clearTableMethod(dataset);
        }
        
        return new Promise(function(resolve, reject) {
            that.datasetExists(dataset).then(function(result) {
                //Dataset was found, use the ID with addRowsMethod
                clearTableMethod(result.dataset.id).then(function(result) {
                    resolve(result);
                }).catch(function(error) {
                    reject(error);
                });
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
                    resolve({ status: false, message: 'Dataset already exists. No action was taken' });
                }
            }).catch(function(error) {
                reject(error);
            });
        });
    },
    test: function(token) {
        request.post({
            url: this.url + '/datasets/e386a860-6ed0-4989-bde1-cd0111de47ad/tables/Product/rows',
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
};

module.exports = PowerBi;