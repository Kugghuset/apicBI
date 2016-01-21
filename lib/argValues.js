var Promise = require('bluebird');

/**
 * Retrive arguments passed from command line. 
 * @param {array} requiredArguments Array of arguments required. Function will throw error if an argument is missing
 * @return {object} Promise with resolve of arguments with values or reject if an required argument was left out
 */
var ArgValues = function(requiredArguments) {
    var that = this;
    return new Promise(function(resolve, reject) {
        /*Get arguments from command line. Args will be an array with first two elements representing node application path and script path
        Following elements will be argument name and argument values:
        node script.js arg1 val arg2 hello = [node, script.js, arg1,val, arg2, hello]*/
        var args = process.argv.slice(2);
        
        //If requiredArguments exists
        if(typeof requiredArguments != 'undefined') {
            //Loop through all required arguments
            for(a = 0; a < requiredArguments.length; a++) {
                var foundArg = false; //Will be set to true as soon found
                //Loop through all passed arguments
                for(b = 0; b < args.length; b+=2) {
                    //check if required argument is part of passed arguments (including dash and double dash)
                    if(('-' + requiredArguments[a]) == args[b] || ('--' + requiredArguments[a]) == args[b]) {
                        foundArg = true;
                        break;
                    }
                }
                
                //If the required arguments is not found the function will send reject and end with return
                if(!foundArg) {
                    reject({ status: false, message: 'Argument "' + requiredArguments[a] + '" is missing' });
                    return;
                }
            }
        }
        
        //Check if argument array is of even number length. every argument has a value. If not reject with error message
        if(args.length % 2 != 0) {
            reject({status: false, message: 'Arguement "' + args[args.length - 1] + '" is missing value'});
            return;
        }
        
        //List to hold arguments for return
        that.args = {};
        for(var a = 0; a < args.length; a+=2) { //Loop through all arguments passed with commandline
            var arg = ''; //Hold argument name
            if(args[a].substring(0, 1) == '-') { //If command is prefixed with dash, remove it
                arg = args[a].substring(1, args[0].length);
            } if(args[a].substring(0, 2) == '--') { //If command is prefixed with double dash, remove it
                arg = args[a].substring(2, args[0].length);
            } else {
                arg = args[a];
            }
            
            //Add argument name and value to argument list for return
            that.args[arg] = (typeof args[a+1] != 'undefined') ? args[a+1] : null;
        }
        
        //Resolve with argument list
        resolve(that.args);
    });
}

module.exports = ArgValues;