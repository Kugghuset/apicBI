'use strict'

var _ = require('lodash');

/**
 * @class Eventer
 * @type {{ on: Function, off: Function, trigger: Function }}
 */
function Eventer() {
    this.$events = {};

    /**
     * @param {String} eventName Name of the event to listen for
     * @param {Function} listener The function to be called. Defaults to _.noop
     * @param {Object} _this Other identification to use for when the listener could be anonymous
     * @return {{ listener: Function, _this: Object }}
     */
    this.on = function (eventName, listener, _this) {
        if (!_.isFunction(listener)) {
            listener = _.noop;
        }

        var eventItem = { listener: listener, _this: _this };

        if (_.isArray(this.$events[eventName])) {
            this.$events[eventName].push(eventItem);
        } else {
            this.$events[eventName] = [eventItem];
        }

        return eventItem;
    }.bind(this);

    /**
     * @param {String} eventName Name of the event to stop listening for
     * @param {Function} _listener The function to be called.
     * @param {Object} __this Other identification to use for when the listener could be anonymous
     */
    this.off = function (eventName, _listener, __this) {
        // Filter out the eventItem where either the listener or this matches *_listener* or *__this*
        this.$events[eventName] = _.filter(this.$events[eventName], function (eventItem) {
            return !_.some([eventItem.listener === _listener, eventItem._this === __this])
        });
    }.bind(this);


    /**
     * @param {String} eventName Name of the event to trigger
     * @param {Any} params Splat array of all params other than *eventName*, will be used when calling listeners
     */
    this.trigger = function () {
        var args = Array.prototype.slice.call(arguments);
        var eventName = args[0];

        // Call all listeners on *eventName*
        _.forEach(this.$events[eventName], function (eventItem) { return eventItem.listener.apply(eventItem.this, args.slice(1)); })
    }.bind(this);
}

/**
 * Attached constructor for creating new instances.
 */
Eventer.prototype.Eventer = Eventer;

module.exports = new Eventer();
