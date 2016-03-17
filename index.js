
var env = require('node-env-file');
env('./.env');

var icwsCtrl = require('./controllers/icwsController');
var utils = require('./lib/utils');

var icws = require('./lib/icwsModule');


// icws.auth()
// .then(function () {

//     return icws.put('messaging/subscriptions/configuration/workgroups/1', {
//         "configurationIds": [
//             "*"
//         ],
//         "properties": [
//             "hasQueue",
//             "isActive",
//             "isWrapUpActive",
//             "isCallbackEnabled",
//             "isAcdEmailRoutingActive"
//         ],
//         "rightsFilter": "view"
//     })
// })
// .then(function (data) {
//     if (data) { console.log(data); }

//     return icws.get('status/status-messages-user-access/integration.kugghuset')
// })
// .then(function (data) {
//     console.log(data);

//     return icws.get('status/status-messages')
// })
// .then(function (data) {
//     console.log(data);
// })
// .catch(function (err) {
//     console.log(err);
// })

// icws.auth()
// .then(function (data) {
//     console.log(data);
// })
// .catch(function (err) {
//     console.log(err);
// })

icwsCtrl.run();

