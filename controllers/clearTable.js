var Promise = require('bluebird');
var AzureAuth = require('../lib/azureAuth');
var PowerBi = require('../lib/powerBi');

function ClearTable() {}

ClearTable.run = function(table) {
    if(table == 'daily') { table = 'day_per_agent'; }
    else if(table == 'weekly') { table = 'week_per_agent'; }
    
    var azure = new AzureAuth();
    azure.getToken().then(function(data) {        
        var powerBi = new PowerBi(data.token);
        powerBi.datasetExists('ApicBI').then(function(result) {
            powerBi.clearTable(result.dataset.id, 'table').then(function(result) {
                console.log(result);
            }).catch(function(error) {
                console.log(error);
            });
        }).catch(function(error) { console.log(error); });
    }).catch(function(error) { console.log(error); });
}

module.exports = ClearTable;