'use strict'

require('./../style/main.scss');

var $ = window.jQuery = window.$ = require('jquery');

var _ = require('lodash');
var Vue = require('vue');
var Pusher = require('pusher-js');
var moment = require('moment');

require('./../../../lib/flowtype');

function flowtype (el, opts) {
    return $(el).flowtype(opts);
}

window.Pusher = Pusher;

var config = require('./config');

/**
 * @type {{ t: String, wg: String, st: String, debug: Boolean }}
 */
var _query = _.chain(window.location.search.substr(1))
    .thru(function (query) { return query.split('&'); })
    .map(function (item) { return item.split('='); })
    .map(function (arr) { return { key: decodeURIComponent(arr[0]), value: decodeURIComponent(arr[1]) } })
    .thru(function (items) { return _.reduce(items, function (obj, item, i) { return _.assign({}, obj, _.set({}, item.key, item.value)); }, {}); })
    .value();

/** @type {String} */
var _token = _query.t;

Vue.filter('date', function (val, format) {
  return !!val
    ? moment(val).format(format)
    : val;
});

Vue.filter('timer', function (val, type) {
    var _divider = type === 'ms'
        ? 1000
        : 1;

    var isNegative = val < 0;

    if (isNegative) {
        val = Math.abs(val);
    }

    var seconds = Math.floor(val);
    var minutes = Math.floor(val / 60);
    var hours = Math.floor(val / 60 / 60);
    // var days = Math.floor(ms /  1000 / 60 / 60 / 24);

    return (isNegative ? '-' : '') + [
        ('0' + hours % 24).slice(-2),
        ':',
        ('0' + minutes % 60).slice(-2),
        ':',
        ('0' + seconds % 60).slice(-2),
    ].join('');

})

var __divTemplate = '<div id="{id}"></div>'

var pusher = new Pusher(config.pusher_id, {
    cluster: 'eu',
    encrypted: true
});

/**
 * @param {String} id
 * @return {Element}
 */
function addDiv(id) {
    $(document.body).append(__divTemplate.replace('{id}', id));
}


/**
 * @param {String} channelName Name of the channel to liste to
 * @param {String} eventName Name of the event to listen for
 * @param {Function} callback Function to be called on trigger of the event
 */
function listen(channelName, eventName, callback) {
    var channel = pusher.subscribe(channelName);
    channel.bind(eventName, callback);
}

/**
 * Tries to parse value and return it.
 *
 * If value can't be parsed or the parse is empty, value itself is returned.
 *
 * @param {Any} value Value to try to parse
 * @return {Any} Whatever was either parsed or *value* itself
 */
var jsonParseOrValue = function (value) {
  try {
    return JSON.parse(value) || value;
  } catch (error) {
    return value;
  }
}

var storage = {
  set: function (key, value) {
    if (typeof value === 'object') {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.setItem(key, value);
    }

    return value;
  },
  get: function (key) {
    var _data = localStorage.getItem(key);
    var _parsed = _.attempt(function () { return JSON.parse(_data); });

    return _.isError(_parsed)
      ? _data
      : _parsed;
  }
}

/**
 * Headers should be attached to options.headers
 *
 * @param {String} method The HTTP method to make. Case-insensitive. Defaults to 'GET'.
 * @param {String} url Absolute or relative
 * @param {Object} data Data to pass as the body. Not required.
 * @param {Object} options An options object containing whatever else axajx(...) may use.
 * @param {Boolean} dataOnly Shuold only the data object be returned?
 * @return {Promise} -> {Any}
 */
function _request(method, url, data, options, dataOnly) {
    return new Promise(function (resolve, reject) {
        method = _.isUndefined(method) ? 'GET' : method;
        options = _.isUndefined(options) ? {} : options;
        dataOnly = _.isUndefined(dataOnly) ? true : dataOnly;

        var token = storage.get('token') || undefined;
        var defaultHeaders = !!token
            ? { Authorization: 'Bearer ' + token }
            : {};

        var headers = _.assign({}, defaultHeaders, options.headers);

        Vue.http(_.assign({}, options, {
            method: method,
            data: data,
            url: url + (/\?/.test(url) ? '&' : '?') + 't=' + _token,
            headers: headers,
        }))
        .then(
            function (resp) { resolve(!!dataOnly ? resp.data : resp) },
            function (err) { reject(new Error(err.status + ': ' +err.statusText)) }
        );
    });
}
/**
 * Complete container object for http methods.
 */
var http = {
    /**
     * Makes a GET request to *url* and returns a promise of it.
     *
     * @param {String} url Url to make request to
     * @param {Object} options Options object, should probably contain headers
     * @param {Boolean} dataOnly Should only the data object be returned? Defaults to true.
     * @return {Promise} -> {Any}
     */
    get: function (url, data, options, dataOnly) {
        var _params;
        var _url = url;

        // Handle data
        if (_.isString(data)) {
            // data is a string and is assumed to be url encoded
            _params = data;
        } else if (_.isObject(data)) {
            // Data is an object which sould be converted into query params
            _params = _.map(data, function (value, key) { return encodeURI([key, value].join('='))}).join('&');
        }

        // Append *_params* if defined
        if (!_.isUndefined(_params)) {
            // Join either by ? or & depending on whether there already is a ? in the url
            _url += (/\?/.test(url) ? '&' : '?') + _params;
        }

        return _request('GET', _url, null, options, dataOnly);
    },
    /**
     * Makes a POST request to *url* with a body of *data*
     * and returns a promise of it.
     *
     * @param {String} url Url to make request to
     * @param {Object} data JSON serializable data
     * @param {Object} options Options object, should probably contain headers
     * @param {Boolean} dataOnly Should only the data object be returned? Defaults to true.
     * @return {Promise} -> {Any}
     */
    post: function (url, data, options, dataOnly) { return _request('POST', url, data, options, dataOnly); },
    /**
     * Makes a PUT request to *url* with a body of *data*
     * and returns a promise of it.
     *
     * @param {String} url Url to make request to
     * @param {Object} data JSON serializable data
     * @param {Object} options Options object, should probably contain headers
     * @param {Boolean} dataOnly Should only the data object be returned? Defaults to true.
     * @return {Promise} -> {Any}
     */
    put: function (url, data, options, dataOnly) { return _request('PUT', url, data, options, dataOnly); },
    /**
     * Makes a DELETE request to *url* and returns a promise of it.
     *
     * @param {String} url Url to make request to
     * @param {Object} options Options object, should probably contain headers
     * @param {Boolean} dataOnly Should only the data object be returned? Defaults to true.
     * @return {Promise} -> {Any}
     */
    delete: function (url, options, dataOnly) { return _request('DELETE', url, null, options, dataOnly); },
};

/**
 * @return {String}
 */
function getWorkgroup() {
    return window.workgroup;
}

/**
 * @return {String}
 */
function getStatType() {
    return window.statType;
}

/**
 * @return {String}
 */
function getDebug() {
    return window.debug;
}

/**
 * @param {Element} el
 */
function initFlowtype(el) {
    /** Disabled for now */
    // flowtype(el, {
    //     minWidth: '230px',
    //     maxWidth: '800px',
    //     min: 60,
    //     max: 70,
    // });
}

module.exports = {
    addDiv: addDiv,
    http: http,
    listen: listen,
    getWorkgroup: getWorkgroup,
    getStatType: getStatType,
    getDebug: getDebug,
    initFlowtype: initFlowtype,
}
