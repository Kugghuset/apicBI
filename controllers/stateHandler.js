
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var _ = require('lodash');


/**
 * Reads the filecontents and returns an object containing it.
 * 
 * @param {string} filepath Relative or absolute path to file
 * @return {object} If file exists, the file contents, otherwise an empty object
 */
function readJsonFile(_filepath) {
    
    // Normalize the filepath
    var _path = path.resolve(_filepath);
    
    // Check the file exists
    if (fs.existsSync(_path)) {
        var fileContents = fs.readFileSync(_path, 'utf8');
        
        var parsed = _.attempt(function () { return JSON.parse(fileContents); });
        return _.isError(parsed)
            ? { data: fileContents }
            : parsed;
    } else {
        return {};
    }
  
}

/**
 * Writes the object to a file.
 * 
 * @param {object} content Data
 * @return {Boolean}
 */
function writeJsonFile(_filepath, content) {
    
    // No content or filepath means trouble.
    if (!_filepath || !content) {
        return false;
    }
    
    // Normalize the filepath.
    var _path = path.resolve(_filepath);
    
    var data;
    var parsed = _.attempt(function () { return JSON.parse(content); })
    
    // Check if *content* is a JSON object
    if (_.isError(parsed)) {
        // Content is not a JSON object
        
        // Try stringify it
        data = _.attempt(function () {
            return JSON.stringify(content);
        });
        
        // If something went wrong, stringify an object with the property data set to *content*.
        if (_.isError(data)) {
            data = JSON.stringify({ data: content });
        }
    } else {
        // Content already is a JSON object
        data = content;
    }
    
    // Write the file
    fs.writeFileSync(_path, data);
    
    return true;
}

/**
 * Migrates the old timestamp .txt file to a new .json file.
 * This will delete the old file completely.
 * 
 * @param {string} txtPath Relative or absolute file path to the .txt timestamp file
 * @param {string} jsonPath Relative or absolute file path to the .json timestamp file
 */
function migrateTxtToJson(txtPath, jsonPath) {
    
    // Normalize the filepath
    var _txtPath = path.resolve(txtPath);
    
    var timestamp = fs.existsSync(_txtPath)
        ? parseInt(fs.readFileSync(_txtPath, 'utf8'))
        : undefined;
    
    if (timestamp) {
        
        // Write to the new file.
        console.log('Migrating .txt timestamp file: ' + _txtPath);
        writeJsonFile(jsonPath, { timestamp: timestamp, timeString: moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS') });
        
        // Delete the old file as it's unnecessary
        fs.unlinkSync(_txtPath);
        console.log('.txt file deleted: ' + _txtPath);
    }
    
}

module.exports = {
    readJsonFile: readJsonFile,
    writeJsonFile: writeJsonFile,
    migrateTxtToJson: migrateTxtToJson
}