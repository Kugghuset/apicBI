var fs = require('fs');
var chalk = require('chalk');
var path = require('path');

var ArgValues = require('./lib/argValues');

/**
 * Deletes the file at *filename* if it's in the assets folder whilst not being in assets/datasets
 * 
 * @param {string} filename
 */
function deleteFile(filename) {
    
    // Check if there's a filename
    if (!filename) {
        return console.log(chalk.yellow('No filename provided.'));
    }
    
    // Check if it's allowed. Only files in assets/ which are not in assets/datasets are allowed
    if (!/assets[\\\/](?!datasets[\\\/])/.test(filename)) {
        return console.log(chalk.red('Illegal file delete: ' + filename));
    }
    
    // Normalize the path
    var _path = path.resolve(filename);
    
    // Check file exists
    if (!fs.existsSync(_path)) {
        return console.log(chalk.green(filename + ' does not exist.') + '\n');
    }
    
    // Delete the file
    fs.unlinkSync(_path);
    
    console.log(chalk.green(filename + ' is now deleted.'));
    
}

new ArgValues(['filepath']).then(function (args) {
    
    deleteFile(args.filepath);
    
});