'use strict'

var _ = require('lodash');
var Promise = require('bluebird');
var moment = require('moment');
var PowerBi = require('./../../lib/powerBi');

var stateHandler = require('./../stateHandler');
var azure = require('./../../lib/azure');
var icwsUtils = require('./icws.utils');
var icwsStorage = require('./icws.storage');

var logger = require('./../../middlehand/logger');

var PushedPowerBi = icwsStorage.getCollection('pushedPowerBi');
var config = require('./../../configs/database');

/**
 * Picks and cleans data into actual types and returns it.
 *
 * @param {{ id: String, type: String, callType: String, callDirection: String, remoteAddress: String, remoteId: String, remoteName: String, duration: Number, state: String, stateVal: String, workgroup: String, userName: String, startDate: Date, endDate: Date, queueDate: Date, answerDate: Date, connectedDate: Date, queueTime: Number, inQueue: Boolean, isAbandoned: Boolean, isCompleted: Boolean }} item
 * @return {{ id: String, type: String, callType: String, callDirection: String, remoteAddress: String, remoteId: String, remoteName: String, duration: Number, state: String, stateVal: String, workgroup: String, userName: String, startDate: Date, endDate: Date, queueDate: Date, answerDate: Date, connectedDate: Date, queueTime: Number, inQueue: Number, isAbandoned: Number, isCompleted: Number }}
 */
function pickData(item) {
    var _strings = _.chain(item)
        .pick([
            'id',
            'type',
            'callType',
            'callDirection',
            'remoteAddress',
            'remoteId',
            'remoteName',
            'state',
            'stateVal',
            'workgroup',
            'userName',
        ])
        .map(function (val, key) { return { name: key, value: _.toString(val) }; })
        .value();

    var _dates = _.chain(item)
        .pick([
            'startDate',
            'endDate',
            'queueDate',
            'answerDate',
            'connectedDate',
        ])
        .map(function (val, key) { return { name: key, value: moment(new Date(val)).isValid() ? new Date(val) : null }; })
        .value();

    var _numbers = _.chain(item)
        .pick([
            'duration',
            'queueTime',
        ])
        .map(function (val, key) { return { name: key, value: isNaN(parseInt(val)) ? -1 : parseInt(val) }; })
        .value();

    var _bools = _.chain(item)
        .pick([
            'inQueue',
            'isAbandoned',
            'isCompleted',
        ])
        .map(function (val, key) { return { name: key, value: !!val ? 100 : 0 }; })
        .value();

    return _.chain([])
        .thru(function (arr) { return arr.concat(_strings).concat(_dates).concat(_numbers).concat(_bools); })
        .thru(function (_items) { return _.reduce(_items, function (obj, val)  { return _.assign({}, obj, _.set({}, val.name, val.value)); }, {}); })
        .value();

}

/**
 * @param {{ daily: {}[], weekly: {}[] }} data
 * @param {Object} [powerBi]
 * @param {Number} [attempt=0]
 * @return {Promise}
 */
function toPowerBi(data, powerBi, attempt) {
    if (_.isUndefined(attempt)) {
        logger.log('Pushing ICWS data.', 'info');
        attempt = 0;
    } else {
        logger.log('Attempting to push ICWS data again', 'info', { attempts: attempt });
    }

    if (attempt >= 10) {
        logger.log('Too many failed attempts to push ICWS data to Power BI', 'info', { attempts: attempt });

        PushedPowerBi.findAndUpdate(
            function (item) { return _.find(data.weekly, { id: item.id }); },
            function (item) { return _.assign(item, { isPushed: false, isFailed: true }); }
        );

        return Promise.reject(new Error('Too many failed attempts'));
    }

    // Check for values, if there are any
    if (!_.some([data.daily, data.weekly], _.some)) {
        // There is nothing to push to Power BI.
        return Promise.resolve({});
    }

    var _method = (attempt > 0)
        ? 'refresh'
        : 'local';

    return azure.getToken(_method)
    .then(function (token) {
        powerBi = new PowerBi(token);

        // Get the datasetId
        return stateHandler.getDataset(config.dataset_icws, powerBi, attempt > 0);
    })
    .then(function (datasetId) {
        var _promises = _.map({ daily: data.daily, weekly: data.weekly }, function (value, key) {
            if (!(value && value.length)) {
                return Promise.resolve({})
            }

            if (!config.allow_push) {
                logger.log('Won\'t push. Would have pushed ICWS data to Power BI.', 'info', { tableName: 'icws_agent_' + key, rowCount: value.length });
                return Promise.resolve({});
            }

            logger.log('Pushing ICWS data to Power BI.', 'info', { tableName: 'icws_agent_' + key, rowCount: value.length });
            return powerBi.addRows(datasetId, 'icws_agent_' + key, _.map(value, pickData))
            .then(function (result) {
                logger.log('Sucessfully pushed ICWS data to Power BI.', { tableName: 'icws_agent_' + key, rowCount: value.length });
                return Promise.resolve(result);
            })
            .catch(function (err) {
                logger.log('Failed to Push ICWS data', 'error', { error: _.isError(err) ? err.toString() : JSON.stringify(err), tableName: 'icws_agent' + key });
                return Promise.reject(err);
            });
        });

        return icwsUtils.settle(_promises);
    })
    .then(function (values) {
        var _errors = _.filter(values, _.isError);
        if (_.some(_errors)) {
            logger.log('Some errors occured when pushing ICWS data to PowerBI', 'info', { errors: _.map(_errors, _.toString).join(', ') });
        }

        // If there are only errors, it failed completely
        if (_errors.length === values.length) {
            logger.log('Failed to push any ICWS data to Power BI', 'error');
            return Promise.reject(new Error('Failed to push ICWS data to Power BI'));
        }

        PushedPowerBi.findAndUpdate(
            function (item) { return _.find(data.weekly, { id: item.id }); },
            function (item) { return _.assign(item, { isPushed: true }); }
        );

        return Promise.resolve(_.filter(values, function (value) { return !_.isError(value); }));
    })
    .catch(function (err) {
        logger.log('Failed to push ICWS data to Power BI', 'error', { error: err.toString() });

        return toPowerBi(data, powerBi, attempt += 1);
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
        : !_.isNull(PushedPowerBi.findOne({ id: _.toString(id), isPushed: true }));
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
