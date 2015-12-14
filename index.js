var env = require('node-env-file');
env(__dirname + '/.env');

var request = require('request');
var AuthenticationContext = require('adal-node').AuthenticationContext;

var adal = require('adal-node').AuthenticationContext;

var authorityHostUrl = 'https://login.windows.net';
var authorityUrl = authorityHostUrl + '/' + process.env.AZURE_DOMAIN;
var resource = 'https://analysis.windows.net/powerbi/api';


var context = new AuthenticationContext(authorityUrl);
context.acquireTokenWithUsernamePassword(resource, process.env.AZURE_CLIENT_USERNAME, process.env.AZURE_CLIENT_PASSWORD, process.env.AZURE_CLIENT_ID, function(err, response) {
    if (err) {
        console.log('well that didn\'t work: ' + err.stack);
    } else {
        //console.log(response.accessToken);

        request.post({
            url: 'https://api.powerbi.com/v1.0/myorg/datasets/e386a860-6ed0-4989-bde1-cd0111de47ad/tables/Product/rows',
            headers: {
                'Authorization': 'Bearer ' + response.accessToken,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({
                'rows':
                [
                    {
                        'ProductID': 4,
                        'Name': 'TEST',
                        'Category': 'Components',
                        'IsCompete': true,
                        'ManufacturedOn': '07/30/2014'
                    }
                ]
            })
        });
    }
});