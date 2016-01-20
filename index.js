var https = require('https');
var crypto = require('crypto');

var moment = require('moment');

// Event Hubs parameters
var namespace = 'tiegoeventhub';
var hubname ='tiegoeventhub';
var devicename = 'device-01';



setInterval(function () {
    
    // Payload to send
    var payload = JSON.stringify({
        "Temperature": Math.round(((Math.random() * 1000) % 30) + ((Math.random() * 1000) / 30), 2),
        "Humidity":"0.4",
        TimeStampYo: moment().format('YYYY-MM-DD HH:mm:ss')
    });

    // Shared access key (from Event Hub configuration)
    var my_key_name = 'all';
    var my_key = '1mlUgqAiA1QYvQFhRtnYZqQwwVLlYW88WMnrGpbpBEs=';

    // Full Event Hub publisher URI
    var my_uri = 'https://' + namespace + '.servicebus.windows.net' + '/' + hubname + '/publishers/' + devicename + '/messages';

    // Create a SAS token
    // See http://msdn.microsoft.com/library/azure/dn170477.aspx

    function create_sas_token(uri, key_name, key)
    {
        // Token expires in 24 hours
        var expiry = Math.floor((new Date()).getTime()/1000+3600*24);

        var string_to_sign = encodeURIComponent(uri) + '\n' + expiry;
        var hmac = crypto.createHmac('sha256', key);
        hmac.update(string_to_sign);
        var signature = hmac.digest('base64');
        var token = 'SharedAccessSignature sr=' + encodeURIComponent(uri) + '&sig=' + encodeURIComponent(signature) + '&se=' + expiry + '&skn=' + key_name;

        return token;
    }

    var my_sas = create_sas_token(my_uri, my_key_name, my_key)

    console.log(my_sas);

    // Send the request to the Event Hub

    var options = {
    hostname: namespace + '.servicebus.windows.net',
    port: 443,
    path: '/' + hubname + '/publishers/' + devicename + '/messages',
    method: 'POST',
    headers: {
        'Authorization': my_sas,
        'Content-Length': payload.length,
        'Content-Type': 'application/atom+xml;type=entry;charset=utf-8'
    }
    };

    var req = https.request(options, function(res) {
        
    console.log()
    // console.log("statusCode: ", res.statusCode);
    // console.log("headers: ", res.headers);
    
    res.on('data', function(d) {
        process.stdout.write(d);
    });
    });

    req.on('error', function(e) {
    console.error(e);
    });

    req.write(payload);
    req.end();

    
}, 5000);


