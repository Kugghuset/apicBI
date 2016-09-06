'use strict'

if (!process.env.APP_NAME) {
    process.env.APP_NAME = 'utility';
}

var fs = require('fs');
var chalk = require('chalk');
var path = require('path');

var ArgValues = require('./lib/argValues');

var logger = require('./middlehand/logger');

/**
 * Deletes the file at *filename* if it's in the assets folder whilst not being in assets/datasets
 *
 * @param {string} filename
 */
function deleteFile(filename) {

    // Check if there's a filename
    if (!filename) {
        return logger.log('No filename provided.', 'info');
    }

    // Check if it's allowed. Only files in assets/ which are not in assets/datasets are allowed
    if (!/assets[\\\/](?!datasets[\\\/])/.test(filename)) {
        return logger.log('Illegal file delete', 'error', { filename: filename });
    }

    // Normalize the path
    var _path = path.resolve(filename);

    // Check file exists
    if (!fs.existsSync(_path)) {
        return logger.log('File does not exist.', 'info', { filename: filename });
    }

    // Delete the file
    fs.unlinkSync(_path);

    logger.log('File is now deleted.', 'info', { filename: filename });

}

new ArgValues(['filepath']).then(function (args) {

    deleteFile(args.filepath);

});