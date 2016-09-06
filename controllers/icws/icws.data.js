'use strict'

var _ = require('lodash');
var Promise = require('bluebird');
var moment = require('moment');
var loki = require('lokijs');

var icwsSub = require('./icws.sub');
var icws = require('../../lib/icwsModule');
var icwsStorage = require('./icws.storage');
var icwsUtils = require('./icws.utils');
var icwsPush = require('./icws.push');
var icwsDb = require('./icws.db');

var logger = require('./../../middlehand/logger');

/** @type {LokiCollection<{}>} */
var Interactions = icwsStorage.getCollection('interactions');
/** @type {LokiCollection<T>} */
var Agents = icwsStorage.getCollection('agents');
/** @type {LokiCollection<T>} */
var PushedPowerBi = icwsStorage.getCollection('pushedPowerBi');


/** @type {LokiDynamicView<T>} */
var TimeDiffView = icwsStorage.getView(Interactions, 'timeDiffView', initTimeDiffView);

/** @type {LokiDynamicView<T>} */
var QueuedInteraction = icwsStorage.getView(Interactions, 'queuedInteractions', initQueuedInteractionView);

/** @type {LokiDynamicView<T>} */
var DailyInteractionView = icwsStorage.getView(Interactions, 'dailyInteractionView', initDailyInteractionView)

/** @type {LokiDynamicView<T>} */
var WeeklyInteractionView = icwsStorage.getView(Interactions, 'weeklyInteractionView', initWeeklyInteractionView)

/** @type {LokiDynamicView<T>} */
var CurrentInteractionView = icwsStorage.getView(Interactions, 'currentInteractionView', initCurrentInteractionView);

/** @type {LokiDynamicView<T>} */
var CurrentAgentView = icwsStorage.getView(Agents, 'currentAgentView', initCurrentAgentView);

/**
 * Array of accepted workgroups.
 *
 * @type {String[]}
 */
var __allowedWorkgroups = [
    'CSA',
    'Partner Service',
    // 'ZendeskTest', // possibly
];

/**
 * Array of not accepted workgroups.
 *
 * @type {String[]}
 */
var __disallowedWorkgroups = [];

/**
 * Statistics about the current (daily and weekly) queue.
 *
 * @type {{ daily: { csa: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, partnerService: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, weekly: csa: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, partnerService: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number } }}
 */
var __queueStats = {
    daily: {
        csa: { queueTime: 0, id: null, queueLength: 0, abandonedLength: 0, completedLength: 0, abandonRate: 0 },
        partnerService: { queueTime: 0, id: null, queueLength: 0, abandonedLength: 0, completedLength: 0, abandonRate: 0 },
    },
    weekly: {
        csa: { queueTime: 0, id: null, queueLength: 0, abandonedLength: 0, completedLength: 0, abandonRate: 0 },
        partnerService: { queueTime: 0, id: null, queueLength: 0, abandonedLength: 0, completedLength: 0, abandonRate: 0 },
    },
};

/**
 * Boolean value for whether the __queueStats object is updated.
 *
 * @type {Boolean}
 */
var __queueStatsIsUpdated = true;

/**
 * Data regarding agent availability.
 *
 * @type {{ csa: { agentCount: Number, availableAgentCount: Number }, partnerService: { agentCount: Number, availableAgentCount: Number }, total: { agentCount: Number, availableAgentCount: Number } }}
 */
var __agentStats = {
    csa: { agentCount: 0, availableAgentCount: 0 },
    partnerService: { agentCount: 0, availableAgentCount: 0 },
    total: { agentCount: 0, availableAgentCount: 0 },
};

/**
 * Boolean value for whether the __agentStats object is updated.
 *
 * @type {Boolean}
 */
var __agentStatsIsUpdated = true;

/**
 * The number of seconds of differance between the ICWS server and the local machine.
 *
 * @type {Number}
 */
var __timeDiff = 0;

/********************
 * Queue information
 ********************/

/**
 * Updates the queue statistics object.
 *
 * @reuturn {{ daily: csa: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, partnerService: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, weekly: csa: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number }, partnerService: { queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number } }}
 */
function updateQueueInfo() {
    __queueStats = {
        daily: {
            csa: generateQueueInfo('CSA', 'daily'),
            partnerService: generateQueueInfo('Partner Service', 'daily'),
        },
        weekly: {
            csa: generateQueueInfo('CSA', 'weekly'),
            partnerService: generateQueueInfo('Partner Service', 'weekly'),
        },
        timeDiff: __timeDiff,
    };

    __queueStatsIsUpdated = true;

    return __queueStats;
}

/**
 * @param {String} workgroupName
 * @param {String} span
 * @return {{ queueTime: Number, queueLength: Number, abandonedLength: Number, completedLength: Number, abandonRate: Number, id: Number })
 */
function generateQueueInfo(workgroupName, span) {
    return _.chain(Interactions.where(function (item) { return _.every([
        item.isCurrent,
        item.workgroup === workgroupName,
        item.inQueue,
    ])}))
        .map(function (interaction) { return _.assign({}, interaction, { correctedQueueTime: getInteractionQueueTime(interaction, true) }) })
        .orderBy('correctedQueueTime', 'desc')
        .thru(function (interactions) { return _.map(interactions, function (interaction) { return _.assign({}, interaction, { queueLength: interactions.length }); }); })
        .first()
        .thru(function (interaction) {
            return _.isUndefined(interaction)
            ? { id: null, queueTime: 0, queueLength: 0 }
            : { id: interaction.id, queueTime: interaction.correctedQueueTime, queueLength: interaction.queueLength }
        })
        .thru(function (queueInfo) { return _.assign({}, queueInfo, getQueueStats(workgroupName, span)); })
        .value();
}

/**
 * Generates queue statistics either for the current week or current day
 * and returns an object of it.
 *
 * @param {String} workgroupName
 * @param {String} span
 * @return {{ abandonRate: Number, abandonedLength: Number, completedLength: Number, totalLength: Number }}
 */
function getQueueStats(workgroupName, span) {
    // Get all either abandoned or completed items, either from today or this week.
    var _total = (
        span === 'daily'
            ? DailyInteractionView
            : WeeklyInteractionView
        )
        .data()
        .filter(function (interaction) { return interaction.workgroup === workgroupName; });

    // Get only the abandoned items
    var _abandoned = _total.filter(function (item) { return item.isAbandoned; });

    // Get the completed items
    var _completed = _total.filter(function (item) { return item.isCompleted; });

    return {
        abandonRate: ((_abandoned.length / (_total.length || 1)) * 100).toFixed(2),
        abandonedLength: _abandoned.length,
        completedLength: _completed.length,
        totalLength: _total.length,
    };
}

/**
 *
 * @param {{ queueDate: Date }} interaction The interaction object to get values from
 * @param {Boolean} [useGlobalTimeDiff=false] Defaults to false
 * @return {Number}
 */
function getInteractionQueueTime(interaction, useGlobalTimeDiff) {
    useGlobalTimeDiff = _.isUndefined(useGlobalTimeDiff)
        ? false
        : useGlobalTimeDiff;

    var _globalTimeDiff = useGlobalTimeDiff
        ? __timeDiff
        : 0;

    return moment(new Date()).diff(interaction.queueDate, 'seconds') - _globalTimeDiff;
}

/**
 * Updates __timeDiff and returns it.
 *
 * @return {Number}
 */
function updateTimeDiff() {
    var _diffs = TimeDiffView
        .data()
        .reduce(function (arr, item, i) { return arr.length < 10 ? arr.concat([item]) : arr; }, [])
        .sort(icwsUtils.compareQueueDiff)
        .map(function (item) { return item.localQueueTime - item.queueTime });

    __timeDiff = !_.some(_diffs) ? 0 : _.sum(_diffs) / _diffs.length;

    return __timeDiff;
}

/********************
 * User information
 ********************/

/**
 * Updates the current user info (availability).
 */
function updateAgentInfo() {
    __agentStats = {
        csa: getAgentInfo(['CSA']),
        partnerService: getAgentInfo(['Partner Service']),
        total: getAgentInfo(__allowedWorkgroups),
    };

    __agentStatsIsUpdated = true;

    return __agentStats;
}

/**
 *
 * @param {String[]|String} workgroups
 * @return {{ agentCount: Number, availableAgentCount: Number }}
 */
function getAgentInfo(workgroups) {
    var _agents = CurrentAgentView.data().filter(function (agent) { return hasWorkgroupsSpecial(agent, workgroups) });

    return {
        agentCount: _agents.length,
        availableAgentCount: _.filter(_agents, function (agent) { return isAvailable(agent, workgroups); }).length,
    };
}

/**
 * @param {{ loggedIn: Boolean, onPhone: Boolean, statusName: String, workgroups: { name: String }[] }} agent
 * @param {String[]|String} workgroups
 * @return {Boolean}
 */
function hasWorkgroupsSpecial(agent, workgroups) {
    var _workgroups = _.isArray(workgroups)
        ? workgroups
        : [ workgroups ];

    // When there's a single workgroup and it is 'CSA', agents in 'Partner Service' are not in 'CSA'.
    var _cases = [
        _workgroups.length === 1,
        _workgroups[0] === 'CSA',
        hasWorkgroups(agent, ['Partner Service']),
    ];

    // Sales finland isn't okey at all.
    if (hasWorkgroups(agent, __disallowedWorkgroups)) {
        return false;
    }

    // Special rules for non Parter Service calls
    if (_.every(_cases)) {
        return false;
    }

    return hasWorkgroups(agent, _workgroups);
}

/**
 * Returns true or false for whether the agent is considered available or not.
 *
 * @param {{ loggedIn: Boolean, onPhone: Boolean, statusName: String, workgroups: { name: String }[] }} agent
 * @param {String[]|String} workgroups
 * @return {Boolean}
 */
function isAvailable(agent, workgroups) {
    return _.every([
        // Must be logged in
        agent.loggedIn,
        // Must not be on the phone
        !agent.onPhone,
        // The status must be 'Available'
        agent.statusName === 'Available',
        // Filter out any incorrect workgroups
        hasWorkgroupsSpecial(agent, workgroups),
    ]);
}

/**
 * Returns true or false for whether *agent* contains any *workgroups*.
 *
 * @param {{ workgroups: { name: String }[] } | { name: String }[]} agent
 * @param {String[]|String} workgroups
 * @return {Boolean}
 */
function hasWorkgroups(agent, workgroups) {
    var _agentWorkgroups = _.isArray(agent)
        ? agent
        : agent.workgroups;

    var _workgroups = _.isArray(workgroups)
        ? workgroups
        : [ workgroups ];

    return _.some(_workgroups, function (wg) { return !!_.find(_agentWorkgroups, { name: wg }) });
}

/*********************************
 * Initializers for dynamic views
 *********************************/

/**
 * Initializes the TimeDiffView with items only from the last week,
 * items not in queue and where there is a localQueueTime and queueTime
 * and sorts them in reverse as to their natural order (by '$loki', Loki's ID).
 *
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initTimeDiffView(view) {
    return view
        .applyWhere(function (item) { return !item.inQueue; })
        .applyWhere(function (item) { return moment().subtract(7, 'days').isBefore(item.startDate); })
        .applyWhere(function (item) { return _.every([item.localQueueTime, item.queueTime], _.isNumber); })
        .applySimpleSort('$loki', true)
}

/**
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initQueuedInteractionView(view) {
    return view
        .applyWhere(function (item) { return item.isCurrent && item.inQueue })
}

/**
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initDailyInteractionView(view) {
    return view
        .applyWhere(function (item) {
            return _.every([
                icwsUtils.contains(['Partner Service', 'CSA'], item.workgroup),
                icwsUtils.isParsableOrDate(item.endDate),
                icwsUtils.isToday(item),
            ]);
        });
}

/**
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initWeeklyInteractionView(view) {
    return view
        .applyWhere(function (item) {
            return _.every([
                icwsUtils.contains(['Partner Service', 'CSA'], item.workgroup),
                icwsUtils.isParsableOrDate(item.endDate),
                icwsUtils.isThisWeek(item),
            ]);
        });
}

/**
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initCurrentInteractionView(view) {
    return view
        .applyWhere(function (item) {return item.isCurrent; });
}

/**
 * @param {LokiDynamicView<T>} view
 * @return {LokiDynamicView<T>}
 */
function initCurrentAgentView(view) {
    return view
        .applyWhere(function (item) { return item.isCurrent; })
        .applyWhere(function (item) { return hasWorkgroupsSpecial(item, __allowedWorkgroups); });
}

/************************
 * Setup for data module
 ************************/

/**
 * Sets up the modulea with proper references to collections and views.
 */
function setup() {
    Interactions = icwsStorage.getCollection('interactions');
    Interactions.setChangesApi(true);

    Agents = icwsStorage.getCollection('agents');
    Agents.setChangesApi(true);

    PushedPowerBi = icwsStorage.getCollection('pushedPowerBi');

    TimeDiffView = icwsStorage.getView(Interactions, 'timeDiffView', initTimeDiffView);
    QueuedInteraction = icwsStorage.getView(Interactions, 'queuedInteractions', initQueuedInteractionView);
    DailyInteractionView = icwsStorage.getView(Interactions, 'dailyInteractionView', initDailyInteractionView);
    WeeklyInteractionView = icwsStorage.getView(Interactions, 'weeklyInteractionView', initWeeklyInteractionView);
    CurrentInteractionView = icwsStorage.getView(Interactions, 'currentInteractionView', initCurrentInteractionView);
    CurrentAgentView = icwsStorage.getView(Agents, 'currentAgentView', initCurrentAgentView);

    // Set all interactions to not current
    Interactions.findAndUpdate(function () { return true; }, function (item) {
        return _.assign(item, icwsUtils.updateQueueState(item), { isCurrent: false });
    });

    Agents.findAndUpdate(function () { return true; }, function (agent) {
        return _.assign(item, { isCurrent: false, });
    });

    // Get all interactions which aren't pushed.
    var unPushed = Interactions.where(function (interaction) {
        // Get only not pushed interactions
        return _.every([
            icwsUtils.isFinished(interaction),
            !icwsPush.isPushed(interaction.id, true),
            icwsUtils.isThisWeek(interaction),
        ]);
    });

    // Insert all non-pushed items and push them.
    PushedPowerBi.insert(unPushed.map(function (interaction) { return { id: interaction.id, dateAdded: Date.now(), isPushed: false }; }));
    icwsPush.toPowerBi({ daily: unPushed.filter(icwsUtils.isToday), weekly: unPushed.filter(icwsUtils.isThisWeek) })
    .then(function (data) {
        logger.log('Pushed ICWS data to power BI', 'info', { dailyCount: unPushed.filter(icwsUtils.isToday).length, weeklyCount: unPushed.filter(icwsUtils.isThisWeek).length });
    })
    .catch(function (err) { logger.log('Failed to push ICWS data to PowerBI', 'error', { error: _.isError(err) ? err.toString() : err }); });

    // update the time diff
    updateTimeDiff()

    // Update the queue info
    updateQueueInfo();

    // Do something with users.
}

module.exports = {
    setup: setup,
    getQueueStats: function () { return __queueStats; },
    getIsQueueStatsUpdated: function () { return __queueStatsIsUpdated; },
    updateQueueInfo: updateQueueInfo,
    getInteractionQueueTime: getInteractionQueueTime,
    getTimeDiff: function () { return __timeDiff; },
    updateTimeDiff: updateTimeDiff,
    getInteractions: function () {
        return {
            activeInteractions: CurrentInteractionView.data(),
            csaInteractions: CurrentInteractionView.data().filter(function (item) { return item.workgroup === 'CSA'; }),
            partnerServiceInteractions: CurrentInteractionView.data().filter(function (item) { return item.workgroup === 'Partner Service'; }),
        };
    },
    getAgents: function () { return CurrentAgentView.data(); },
    getAgentStats: function () { return __agentStats; },
    getIsAgentStatsUpdated: function () { return __agentStatsIsUpdated; },
    updateAgentInfo: updateAgentInfo,
    agentIsAvailable: isAvailable,
    getAllowedWorkgroups: function () { return __allowedWorkgroups; },
}
