var sql = require('mssql');
var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

function SqlQuery(connection) {
    if(connection == 'tickety') {
        this.connection = this.connect({
            server: process.env.SQL_TICKETY_SERVER,
            database: process.env.SQL_TICKETY_DATABASE,
            domain: process.env.SQL_TICKETY_DOMAIN,
            username: process.env.SQL_TICKETY_USERNAME,
            password: process.env.SQL_TICKETY_PASSWORD,
        });
    }
    
    return;
    
    this.connection = this.connect({
        server: process.env.SQL_IC_SERVER,
        database: process.env.SQL_IC_DATABASE,
        username: process.env.SQL_IC_USERNAME,
        password: process.env.SQL_IC_PASSWORD
    });
}
    


SqlQuery.prototype = {
    /**
     * Establish connection to SQL server
     * @param {object} parameters List of parameters for connection to sql server
     * @return {object} A connection to an SQL server object
     */
    connect: function(parameters) {
        //parameters to ignore
        var ignore = ['server', 'database', 'username', 'password'];
        
        //Create base of connections sring, server, db, user and pwd
        var connectionString = 'mssql://' + parameters.username + ':' + parameters.password + '@' + parameters.server + '/' + parameters.database;
        var counter = 0;
        for(var key in parameters) {
            //Ignore any parameter used in base of connection string
            if(ignore.indexOf(key) >= 0) { continue; }
            //Add ? to indicate start of parameters in connection string. Will only add first itteration of loop
            if(counter == 0) { connectionString += '?'; }
            
            //Add parameter to connection string
            connectionString += key + '=' + parameters[key] + '&';
            
            //Keep track of itteration
            counter++;
        }
        
        //Remove last ampersand
        connectionString = connectionString.substring(0, connectionString.length - 1);
        
        //Create connection and return object
        return sql.connect(connectionString);
    },
    /**
     * Execute query to db and return recordset
     * @param {string} query The query to be executed
     * @return {object} Promise of executed query
     */
    query: function(query) {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.connection.then(function() {
                new sql.Request().query(query).then(function(recordset) {
                    resolve(recordset);
                }).catch(function(error) {
                    reject(error);
                });
            }).catch(function(error) {
                reject(error);
            });
        });
    },
    
    /**
     * Execute a query by its filename to db and return a promise of a recordset.
     * Filepath can be either relateive or absolute filepaths.
     * 
     * @param {string} filename The filename of the SQL query to be executed
     * @return {Promise} -> {any}
     */
    queryByFile: function (filename) {
        return new Promise(function (resolve, reject) {
            // Set the query to file at the provided filename.
            var query = fs.existsSync(path.resolve(filename))
                ? fs.readFileSync(filename, 'utf8')
                : new Error('File at  doesn\'t exists');
                
            // Reject early if the file doesn't exist.
            if (_.isError(query)) { return reject(query); }
            
            this.connection.then(function () {
                new sql.Request(query)
                .then(function (recordset) {
                    resolve(recordset);
                }).catch(function (error) {
                    reject(error);
                })
            })
        }.bind(this));
    }
}

module.exports = SqlQuery;