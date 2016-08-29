'use strict'

var _ = require('lodash');
var utils = require('./../utils');

var Agent = require('./agent');
var Interaction = require('./interaction');

var __models = {
    Agent: Agent,
    Interaction: Interaction,
};

/**
 * Initializes all models.
 */
function init() {
    return utils.settle(_.map(__models, function (model) { return model.init(); }));
}

module.exports = {
    init: init,
    models: __models,
}
