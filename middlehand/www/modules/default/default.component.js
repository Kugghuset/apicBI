'use strict'

var common = require('../common');
var VueResource =  require('vue-resource');
var Vue = require('vue');

Vue.use(VueResource);

var template = require('./template.html');

common.addDiv('default');

new Vue({
    el: '#default',
    template: template,
    data: function () {
        return {};
    },
});

