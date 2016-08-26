'use strict'

var _ = require('lodash');
var Promise = require('bluebird');
var moment = require('moment');
var PowerBi = require('./../../lib/powerBi');

var stateHandler = require('./../stateHandler');
var azure = require('./../../lib/azure');
var icwsUtils = require('./icws.utils');
var icwsStorage = require('./icws.storage');

var PushedPowerBi = icwsStorage.getCollection('pushedPowerBi');
var config = require('./../../configs/database');

function pickData(item) {
    return _.pick(item, [
        'id',
        'type',
        'callType',
        'callDirection',
        'remoteAddress',
        'remoteId',
        'remoteName',
        'duration',
        'state',
        'stateVal',
        'workgroup',
        'userName',
        'startDate',
        'endDate',
        'queueDate',
        'answerDate',
        'connectedDate',
        'queueTime',
        'inQueue',
        'isAbandoned',
        'isCompleted',
    ]);
}

/**
 * @param {{ daily: {}[], weekly: {}[] }} data
 * @param {Object} [powerBi]
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

            PushedPowerBi.findAndUpdate(
                function (item) { return _.find(data.weekly, { id: item.id }); },
                function (item) { return _.assign(item, { isPushed: false, isFailed: true }); }
            );

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
            return stateHandler.getDataset(config.dataset, powerBi, attempt > 0);
        })
        .then(function (datasetId) {
            var _promises = _.map({ daily: data.daily, weekly: data.weekly }, function (value, key) {
                if (!(value && value.length)) {
                    return Promise.resolve({})
                }
                return new Promise(function (_resolve, _reject) {
                    powerBi.addRows(datasetId, 'icws_agent_' + key, pickData(value))
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

            PushedPowerBi.findAndUpdate(
                function (item) { return _.find(data.weekly, { id: item.id }); },
                function (item) { return _.assign(item, { isPushed: true }); }
            );

            return Promise.resolve(_.filter(values, function (value) { return !_.isError(value); }));
        })
        .catch(function (err) {
            console.log('Failed to push ICWS data to Power BI: ' + err.toString());

            return toPowerBi(data, powerBi, attempt += 1);
        });
    });
}

/**
 * @param {String} id The id of the interaction
 * @param {Boolean} hard Should isPushed also be true?
 * @return {Boolean}
 */
function isPushed(id, hard) {
    if (!id && id !== 0) { return false; }

    return !hard
        ? !_.isNull(PushedPowerBi.findOne({ id: _.toString(id) }))
        : !_.isNull(PushedPowerBi.findObject({ id: _.toString(id), isPushed: true }));
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

    return toPowerBi(_data);
}

function setup() {
    PushedPowerBi = icwsStorage.getCollection('pushedPowerBi');

    return Promise.resolve();
}

module.exports = {
    toPowerBi: toPowerBi,
    currentToPowerBi: currentToPowerBi,
    setup: setup,
    isPushed: isPushed,
}
