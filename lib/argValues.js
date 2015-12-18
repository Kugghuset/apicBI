var Promise = require('bluebird');

var ArgValues = function(argumentNames) {
    var that = this;
    return new Promise(function(resolve, reject) {
        var args = process.argv.slice(2);
        that.args = {};
        for(a = 0; a < args.length; a+=2) {
            var arg = '';
            if(args[a].substring(0, 1) == '-') {
                arg = args[a].substring(1, args[0].length);
            } if(args[a].substring(0, 2) == '--') {
                arg = args[a].substring(2, args[0].length);
            }

            if(argumentNames.indexOf(arg) == -1) {
                reject({status: false, message: 'Arguement value "' + arg + '" doesn\'t exists'});
            }

            if((typeof args[a+1] == 'undefined')) {
                reject({status: false, message: 'Arguement "' + arg + '" is missing value'});
            }

            that.args[arg] = (typeof args[a+1] != 'undefined') ? args[a+1] : null;
        }

        resolve(that.args);
    });
}

module.exports = ArgValues;