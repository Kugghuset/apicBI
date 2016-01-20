//Requirements
var Promise = require('bluebird');
var MyRequest = require(global.root + '/lib/myRequest.js')

/**
 * Constructor for PowerBi class
 * @param {string} token Required for making Power BI API request
 */
function PowerBi(token) {
    this.token = token;
}

PowerBi.prototype = {
    dataset: 'default_dataset',
    url: 'https://api.powerbi.com/v1.0/myorg/',
    /**
     * Making request to the power BI API
     * @param {string} method Type of method for the request (get, post, delete, ect.)
     * @param {string} dir Directoro to prefix the url with. Url is already defined as property of this
     * @param {object} data Data content to send with request (body)
     * @return {object} Promise of request with the result of the response or any error
     */
    request: function(method, dir, data) {
        var that = this;
        return new Promise(function(resolve, reject) {
            return MyRequest.request(method, that.url + dir, {
                'Authorization': 'Bearer ' + that.token,
                'Content-Type': 'application/json'
            }, JSON.stringify(data)).then(function(result) {
                //Parsing the obhect to json with try catch as JSON.parse might fail
                var parsed;
                try {
                    parsed = !!result.body ? JSON.parse(result.body) : {};
                }
                catch (error) {
                    return reject(error);
                }
                
                //If error exists in body, reject will be thrown with the error
                if(typeof parsed.error != 'undefined') {
                    reject(parsed.error);
                    return;
                }
                
                //Resolve with the result
                resolve(result);
            }).catch(function(error) { //If the request fails
                reject(error);
            });
        });
    },
    /**
     * Shortcut for making get request
     * @param {string} dir Directory name to append to url
     * @param {object} data Data content to send with request (body)
     * @return {object} Request object
     */
    get: function(dir, data) {
        return this.request('get', dir, data);
    },
    /**
     * Shortcut for making get request
     * @param {string} dir Directory name to append to url
     * @param {object} data Data content to send with request (body)
     * @return {object} Request object
     */
    post: function(dir, data) {
        return this.request('post', dir, data);
    },
    /**
     * List all datasets
     * @return {object} promise of dataset list or error
     */
    listDatasets: function() {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.get('datasets', {}).then(function(data) {
                var datasets; // declaration needs to be wrapped in a try/catch as JSON.parse might fail
                try {
                    datasets = JSON.parse(data.body).value;
                }
                catch (error) {
                    return reject(error);
                }
                
                resolve({ status: true, datasets: datasets });
            }).catch(function(error) {
                reject(error);
            });
        });
    },
    /**
     * Check if dataset exists or not using dataset name. This method is useful for finding dataset by name
     * @param {string} dataset Dataset name
     * @param {object} promise of dataset object or error if no dataset was found
     */
    datasetExists: function(dataset) {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.listDatasets().then(function(result) {
                var foundDataset = {};
                //Loop through datasets, looking for one with the same name as param dataset
                for(a = 0; a < result.datasets.length; a++) {
                    if(result.datasets[a].name == dataset) { //If found, set var foundDataset and break loop
                        foundDataset = result.datasets[a];
                        break;
                    }
                }
                
                //If the dataset was found resolve with status true and the dataset object
                if(typeof foundDataset.id != 'undefined') {
                    resolve({ status: true, dataset: foundDataset });
                    return;
                }
                //No dataset was found, resolve with status false
                resolve({ status: false });
            }).catch(function(error) { //Error in fetching datasets
                reject(error);
            });
        });
    },
    /**
     * List all tables in specified dataset
     * @param {string} dataset The dataset name or id
     * @param {boolean} datasetAsId If the dataset parameter is the id of the dataset (true) or if it's the name of the dataset (false)
     * @return {object} promise of table list or error
     */
    listTables: function(dataset, datasetAsId) {
        //Default value for dataset as ID
        if(typeof datasetAsId == 'undefined') {
           datasetAsId = true;
        }
        
        var that = this;
        
        /**
         * Method for listing tables in specified dataset ID
         * @param {string} datasetId Dataset id
         * @return {object} promise of table list
         */
        var listTablesMethod = function(datasetId) {
            return new Promise(function(resolve, reject) {
                that.get('datasets/' + datasetId + '/tables', {}).then(function(data) {
                    var tables; // declaration needs to be wrapped in a try/catch as JSON.parse might fail
                    try {
                        tables = JSON.parse(data.body).value;
                    }
                    catch (error) {
                        return reject(error);
                    }
                    
                    resolve({ status: true, dataset: { id: datasetId }, tables: tables });
                }).catch(function(error) {
                    reject(error);
                });
            });
        }
        
        //If parameter dataset is a dataset ID, the listTablesMethod will be used
        if(datasetAsId) {
            return listTablesMethod(dataset);
        }
        
        //If dataset name is used we need to get the dataset ID first
        return new Promise(function(resolve, reject) {
            that.datasetExists(dataset).then(function(result) {
                if(result.status) {
                    //Dataset was found, use the ID with listTablesMethod
                    listTablesMethod(result.dataset.id).then(function(result) {
                        resolve(result);
                    }).catch(function(error) {
                        reject(error);
                    });
                } else {
                    resolve({ status: false, message: 'Dataset doesn\'t exists' });
                }

            }).catch(function(error) {
                reject(error);
            });
        });
    },
    /**
     * Check if table exists in dataset and return dataset and table if so
     * @param {string} dataset The name of the dataset to search in
     * @param {string} table The name of the table to search for
     * @param {boolean} datasetAsId If the dataset parameter is the id of the dataset (true) or if it's the name of the dataset (false)
     * @return {object} Dataset and table as objects
     */
    tableExists: function(dataset, table, datasetAsId) {
        //Default value for dataset as ID
        if(typeof datasetAsId == 'undefined') {
           datasetAsId = true;
        }
        
        var that = this;
        return new Promise(function(resolve, reject) {
            that.listTables(dataset, datasetAsId).then(function(result) {
                if(result.status) {
                    //Variable to hold table info if found
                    var foundTable = {};
                    
                    //Loop through all tables in list
                    for(var a = 0; a < result.tables.length; a++) {
                        if(result.tables[a].name == table) { //If table name from method parameter exists in list
                            //Set foundTable and end loop with break
                            foundTable = result.tables[a];
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
                } else {
                    resolve({ status: false, message: result.message });
                }
            }).catch(function(error) {
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
                    resolve({ status: true, message: 'rows added' });
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
    /**
     * Clear the content of a table in a dataset
     * @param {string} dataset The name or id of the table's dataset
     * @param {string} table Table name to clear
     * @param {boolean} Is param dataset the name (false) or id (true) of the dataset
     * @param {object} Promise of success or fail
     */
    clearTable: function(dataset, table, datasetAsId) {
        if(typeof datasetAsId == 'undefined') {
            datasetAsId = true;
        }
        
        var that = this;
        
        /**
         * Clear table method
         * @param {string} datasetId The ID of the table's dataset
         * @param {string} table name
         * @return {object} Promise of success or fail
         */
        var clearTableMethod = function(datasetId, table) {
            return new Promise(function(resolve, reject) {
                //Make a new request for clearing deleting table rows
                that.request('delete', 'datasets/' + datasetId + '/tables/' + table + '/rows').then(function(data) {
                    resolve({ status: true, message: 'Table cleared' })
                }).catch(function(error) { //An error occurd, throw reject
                    reject(error);
                });
            });    
        }
        
        //IF dataset was set as id call the cleartable method
        if(datasetAsId) {
            return clearTableMethod(dataset, table);
        }
        
        //If dataset was set as name (not id) we will try to find the dataset ID and use it with clearTableMethod
        return new Promise(function(resolve, reject) {
            that.datasetExists(dataset).then(function(result) {
                //Dataset was found, use the ID with clearTableMethod
                clearTableMethod(result.dataset.id, table).then(function(result) {
                    resolve(result);
                }).catch(function(error) { //Reject any error
                    reject(error);
                });
            }).catch(function(error) { //Reject error
                reject(error);
            });
        });
    },
    /**
     * Initiate a dataset to Power BI from the assets/datasets folder. The file read must be structured according
     * the Power BI API dataset structure: http://docs.powerbi.apiary.io/#reference/datasets/datasets-collection/create-a-dataset
     * @param {dataset} the name of the dataset. Same as filename in assets/datasets folder minus the file extension
     * @return {object} Promise of success or fail
     */
    init: function(dataset) {
        var that = this;
        return new Promise(function(resolve, reject) {
            //First check if dataset exists
            that.datasetExists(dataset).then(function(result) {
                if(!result.status) { //Dataset doesn't exists. Lets create
                    that.post('datasets?defaultRetentionPolicy=None', require(global.root + '/assets/datasets/' + dataset + '.js')).then(function(data) {
                        resolve({ status: true, message: 'Dataset "' + dataset + '" has been uploaded to your Power BI!' });
                    }).catch(function(error) {
                        reject(error);
                    });
                } else { //Dataset exists already, resolve with false and message
                    resolve({ status: false, message: 'Dataset already exists. No action was taken' });
                }
            }).catch(function(error) { //Reject with error
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