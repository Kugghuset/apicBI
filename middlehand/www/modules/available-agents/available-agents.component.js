'use strict'

var common = require('../common');
var VueResource =  require('vue-resource');
var Vue = require('vue');

Vue.use(VueResource);

var template = require('./template.html');

var http = common.http;

common.addDiv('available-agents');

new Vue({
    el: '#available-agents',
    template: template,
    data: function () {
        return {
            stats: {
                csa: { agentCount: 0, availableAgentCount: 0 },
                partnerService:  { agentCount: 0, availableAgentCount: 0 },
                total: { agentCount: 0, availableAgentCount: 0 },
            }
        };
    },
    methods: {
        fetchStats: function () {
            http.get('/api/agent-stats')
            .then(this.setStats)
            .catch(function (err) { console.log(err); })
        },
        setStats: function (stats) {
            this.stats = stats;
        },
    },
    ready: function () {
        this.fetchStats();

        common.listen('dev', 'agent-stats', this.setStats);
    },
});

