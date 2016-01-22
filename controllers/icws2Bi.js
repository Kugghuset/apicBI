var Promise = require('bluebird');
var Error = require('../lib/error');
var ICWS = require('../lib/icws');
var PowerBi = require('../lib/powerBi');

var datasetId = '6c11e7ca-b880-46c0-9694-ebd99db00054';

function ICWS2BI() {
    
}

ICWS2BI.readData = function() {
    var icws = new ICWS();
    icws.auth().then(function(result) {
        console.log('YES');
        //console.log(result.body);
    }).catch(function(error) {
        console.log('NO');
        //console.log(error);
    });
}

module.exports = ICWS2BI;