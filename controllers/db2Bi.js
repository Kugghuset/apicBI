var Promise = require('bluebird');
var Error = require(global.root + '/lib/error.js');
var AzureAuth = require(global.root + '/lib/azureAuth.js');
var PowerBi = require(global.root + '/lib/powerBi.js');
var sql = require("seriate");

var database = require(global.root + '/configs/database.js');

var datasetId = '6c11e7ca-b880-46c0-9694-ebd99db00054';

function DB2BI() {}

DB2BI.read = function() {
    sql.setDefaultConfig(database.ic);
    result = sql.execute({
        query: sql.fromFile(global.root + '/sql/per_agent.sql')
    });
    console.log(result);
};

DB2BI.copyTables = function() {
    var azure = new AzureAuth();
    azure.getToken().then(function(data) {
        
        var powerBi = new PowerBi(data.token);
        
        /*powerBi.clearTable(datasetId, 'vi_DimCustomers').then(function(data) {
            SqlQuery.query('SELECT * FROM [vi_DimCustomers]').then(function(recordset) {
                powerBi.addRows(datasetId, 'vi_DimCustomers', recordset);
            }).catch(function(error) {
                console.log(error);
            });
        }).catch(function(error) {
            console.log(error);
        });*/
        
        powerBi.clearTable(datasetId, 'vi_DimTicketCategories').then(function(data) {
            SqlQuery.query('SELECT * FROM [vi_DimTicketCategories]').then(function(recordset) {
                powerBi.addRows(datasetId, 'vi_DimTicketCategories', recordset).then(function(result) {
                    console.log(result);
                }).catch(function(error) {
                    console.log(error);
                });
            }).catch(function(error) {
                console.log(error);
            });
        }).catch(function(error) {
            console.log(error);
        });
        
        powerBi.clearTable(datasetId, 'vi_FactTickets').then(function(data) {
            SqlQuery.query('SELECT * FROM [vi_FactTickets]').then(function(recordset) {
                powerBi.addRows(datasetId, 'vi_FactTickets', recordset).then(function(result) {
                    console.log(result);
                }).catch(function(error) {
                    console.log(error);
                });
            }).catch(function(error) {
                console.log(error);
            });
        }).catch(function(error) {
            console.log(error);
        });
        
    }).catch(function(error) {
        Error.print('Something went wrong', error);
    });
};

module.exports = DB2BI;