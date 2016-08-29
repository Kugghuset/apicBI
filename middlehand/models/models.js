'use strict'

var _ = require('lodash');

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
    _.forEach(__models, function (model, name) { model.init(); });
}

module.exports = {
    init: init,
    models: __models,
}
