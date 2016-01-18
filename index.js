global.root = __dirname;

var env = require('node-env-file');
env(global.root + '/.env');

/*var Error = require(global.root + '/lib/error.js');
var AzureAuth = require(global.root + '/lib/azureAuth.js');
var ICWSAuth = require(global.root + '/lib/icwsAuth.js');
var PowerBi = require(global.root + '/lib/powerBi.js');*/

var DB2BI = require(global.root + '/controllers/db2bi.js');
//var ICWS2BI = require(global.root + '/controllers/icws2Bi.js');

DB2BI.read();

//DB2BI.copyTables();

/*var SqlQuery = new SqlQuery('tickety');
SqlQuery.query('SELECT * FROM [vi_DimTicketCategories]').then(function(recordset) {
    console.log(recordset);
}).catch(function(error) {
    console.log(error);
});*/

/*var icwsAuth = new ICWSAuth();
icwsAuth.getToken().then(function(result) {
    console.log(result);
}).catch(function(error) {
    console.log(error);
});*/



/*var azure = new AzureAuth();
azure.getToken()
.then(function(data) {
    var powerBi = new PowerBi(data.token);
    powerBi.AddRows('ApicBI', 'vi_DimTicketCategories', [
    {
      'CategoryJoin': 'Lasse',
      'CategoryL1': '1',
      'CategoryL2': '2',
      'CategoryL3': '3'
    },
    {
      'CategoryJoin': 'Berg',
      'CategoryL1': '1',
      'CategoryL2': '2',
      'CategoryL3': '3'
    }
  ], false).then(function(data) {
        if(data.status) {
            console.log('YES');
        } else {
            console.log('NO');
        }
    }).catch(function(error) { Error.print('Something went wrong', error); });
})
.catch(function(error) { Error.print('Something went wrong', error); });*/