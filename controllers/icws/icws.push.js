'use strict'

var _ = require('lodash');
var Promise = require('bluebird');
var moment = require('moment');
var PowerBi = require('./../../lib/powerBi');

var stateHandler = require('./stateHandler');
var azure = require('./../../lib/azure');
var icwsUtils = require('./icws.utils');

/**
 * @param {{ daily: {}[], weekly: {}[] }} data
 * @param {Object} powerBi
 * @param {Number} [attempt=0]
 * @return {Promise}
 */
function toPowerBi(data, powerBi, attempt) {
    return new Promise(function (resolve, reject) {
        if (_.isUndefined(attempt)) {
            console.log('Pushing ICWS data.');
            attempt = 0;
        } else {
            console.log('Attempting to push ICWS data again. ' + attempt + ' attempt');
        }

        if (attempt >= 10) {
            console.log('Too many failed attempts to push ICWS data to Power BI');
            return reject(new Error('Too many failed attempts'));
        }

        // Check for values, if there are any
        if (!_.some([data.daily, data.weekly], _.some)) {
            // There is nothing to push to Power BI.
            return resolve({});
        }

        var _method = (attempt > 0)
            ? 'refresh'
            : 'local';

        azure.getToken(_method)
        .then(function (token) {
            powerBi = new PowerBi(token);

            // Get the datasetId
            return stateHandler.getDataset('ApicBI', powerBi, attempt > 0);
        })
        .then(function (datasetId) {
            var _promises = _.map({ daily: data.daily, weekly: data.weekly }, function (value, key) {
                if (!(value && value.length)) {
                    return Promise.resolve({})
                }
                return new Promise(function (_resolve, _reject) {
                    powerBi.addRows(datasetId, 'icws_agent_' + key, value)
                    .then(function (result) {
                        console.log('Sucessfully pushed ICWS data to Power BI. icws_agent_' + key);
                        resolve(result);
                    })
                    .catch(reject);
                });
            });

            return icwsUtils.settle(_promises);
        })
        .then(function (values) {
            var _errors = _.filter(values, _.isError);
            if (_.some(_errors)) {
                console.log('The following errors occured when pushing ICWS data: ' + _.map(_errors, _.toString).join(', '));
            }

            // If there are only errors, it failed completely
            if (_errors.length === values.length) {
                console.log('Failed to push any ICWS data to Power BI');
                return Promise.reject(new Error('Failed to push ICWS data to Power BI'));
            }

            return Promise.resolve(_.filter(values, function (value) { return !_.isError(value); }));
        })
        .catch(function (err) {
            console.log('Failed to push ICWS data to Power BI: ' + err.toString());

            return toPowerBi(data, powerBi, attempt += 1);
        });



    });
}

/**
 * @param {{}|{}[]} items
 * @return {Promise}
 */
function currentToPowerBi(items) {
    var _items = _.isArray(items)
        ? items
        : [ items ];

    // As both are current, push both of them.
    var _data = { daily: _items, weekly: _items };

    return toPowerBi(data);
}

module.exports = {
    toPowerBi: toPowerBi,
    currentToPowerBi: currentToPowerBi,
}
