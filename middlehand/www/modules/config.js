'use strict'

parseEnvFile(require('raw!./../../../.env-middlehand'));

/**
 * Parses a raw .env file with the format of:
 * key_name=value_of_key.
 *
 * @param {String} _env
 */
function parseEnvFile(_env) {
  if (typeof _env === 'string' && _env.length) {
    _env.split(/\n/).forEach(function (line) {
      var values = line.split('=');
      var key = values.shift();

      process.env[key] = values.join('=');
    });
  }
}

module.exports = {
    pusher_id: process.env.PUSHER_ID || '',
}
