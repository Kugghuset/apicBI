'use strict'

var common = require('../common');
var VueResource =  require('vue-resource');
var Vue = require('vue');

Vue.use(VueResource);

var template = require('./template.html');

var http = common.http;

common.addDiv('current-queue');

new Vue({
    el: '#current-queue',
    template: template,
    data: function () {
        return {
            stats: {
                csa: { queueTime: 0, queueLength: 0 },
                partnerService:  { queueTime: 0, queueLength: 0 },
            }
        };
    },
    methods: {
        fetchStats: function () {
            http.get('/api/queue-stats')
            .then(this.setStats)
            .catch(function (err) { console.log(err); })
        },
        setStats: function (stats) {
            this.stats = stats;
        },
    },
    ready: function () {
        this.fetchStats();

        common.listen('dev', 'queue-stats', this.setStats);
    },
});

