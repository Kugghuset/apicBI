/**
 * @type {{ name: String, tables: { name: String, columns: { name: String, dataType: String }[] }[] }}
 */
module.exports = {
    name: 'Dev_ApicBI',
    tables: [
        {
            name: 'day_per_agent', columns: [
                { name: 'Agent', dataType: 'String' },
                { name: 'Call duration in seconds', dataType: 'Int64' },
                { name: 'Call duration in minutes', dataType: 'Double' },
                { name: 'Waiting time in seconds', dataType: 'Int64' },
                { name: 'Waiting time in minutes', dataType: 'Double' },
                { name: 'Is under 60', dataType: 'Int64' },
                { name: 'Nullable waiting time', dataType: 'Int64' },
                { name: 'Date connected', dataType: 'Datetime' },
                { name: 'Date disconnected', dataType: 'Datetime' },
                { name: 'Work group', dataType: 'String' }
            ],
        },
        {
            name: 'week_per_agent', columns: [
                { name: 'Agent', dataType: 'String' },
                { name: 'Call duration in seconds', dataType: 'Int64' },
                { name: 'Call duration in minutes', dataType: 'Double' },
                { name: 'Waiting time in seconds', dataType: 'Int64' },
                { name: 'Waiting time in minutes', dataType: 'Double' },
                { name: 'Is under 60', dataType: 'Int64' },
                { name: 'Nullable waiting time', dataType: 'Int64' },
                { name: 'Date connected', dataType: 'Datetime' },
                { name: 'Date disconnected', dataType: 'Datetime' },
                { name: 'Work group', dataType: 'String' }
            ],
        },
        {
            name: 'icws_agent_daily', columns: [
                { name: 'id', dataType: 'String' },
                { name: 'type', dataType: 'String' },
                { name: 'callType', dataType: 'String' },
                { name: 'callDirection', dataType: 'String' },
                { name: 'remoteAddress', dataType: 'String' },
                { name: 'remoteId', dataType: 'String' },
                { name: 'remoteName', dataType: 'String' },
                { name: 'duration', dataType: 'String' },
                { name: 'state', dataType: 'String' },
                { name: 'stateVal', dataType: 'String' },
                { name: 'workgroup', dataType: 'String' },
                { name: 'userName', dataType: 'String' },
                { name: 'startDate', dataType: 'DateTime' },
                { name: 'endDate', dataType: 'DateTime' },
                { name: 'queueDate', dataType: 'DateTime' },
                { name: 'answerDate', dataType: 'DateTime' },
                { name: 'connectedDate', dataType: 'DateTime' },
                { name: 'queueTime', dataType: 'Int64' },
                { name: 'inQueue', dataType: 'Int64' },
                { name: 'isAbandoned', dataType: 'Int64' },
                { name: 'isCompleted', dataType: 'Int64' },
            ],
        },
        {
            name: 'icws_agent_weekly', columns: [
                { name: 'id', dataType: 'String' },
                { name: 'type', dataType: 'String' },
                { name: 'callType', dataType: 'String' },
                { name: 'callDirection', dataType: 'String' },
                { name: 'remoteAddress', dataType: 'String' },
                { name: 'remoteId', dataType: 'String' },
                { name: 'remoteName', dataType: 'String' },
                { name: 'duration', dataType: 'String' },
                { name: 'state', dataType: 'String' },
                { name: 'stateVal', dataType: 'String' },
                { name: 'workgroup', dataType: 'String' },
                { name: 'userName', dataType: 'String' },
                { name: 'startDate', dataType: 'DateTime' },
                { name: 'endDate', dataType: 'DateTime' },
                { name: 'queueDate', dataType: 'DateTime' },
                { name: 'answerDate', dataType: 'DateTime' },
                { name: 'connectedDate', dataType: 'DateTime' },
                { name: 'queueTime', dataType: 'Int64' },
                { name: 'inQueue', dataType: 'Int64' },
                { name: 'isAbandoned', dataType: 'Int64' },
                { name: 'isCompleted', dataType: 'Int64' },
            ],
        },
    ]
}