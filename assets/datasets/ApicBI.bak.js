module.exports = {
    name: 'ApicBI.bak',
    tables: [
        {
            name: 'day_per_agent', columns: [
                { name: 'Agent', dataType: 'String' },
                { name: 'Call duration in seconds', dataType: 'Int64' },
                { name: 'Waiting time in seconds', dataType: 'Int64' },
                { name: 'Is under 60', dataType: 'Int64' }
            ]
        },
        {
            name: 'week_per_agent', columns: [
                { name: 'Agent', dataType: 'String' },
                { name: 'Call duration in seconds', dataType: 'Int64' },
                { name: 'Waiting time in seconds', dataType: 'Int64' },
                { name: 'Is under 60', dataType: 'Int64' }
            ]
        },
        {
            name: 'aggregated', columns: [
                { name: 'Agent', dataType: 'String' },
                { name: 'Agent24', dataType: 'String' },
                { name: 'Agent25', dataType: 'String' },
                { name: 'Is under 60', dataType: 'Int64' }
            ]
        },
        {
            name: 'week_aggregated', columns: [
                { name: 'Agent', dataType: 'String' },
                { name: 'Call duration in seconds', dataType: 'Int64' },
                { name: 'Waiting time in seconds', dataType: 'Int64' },
                { name: 'Is under 60', dataType: 'Int64' }
            ]
        }
    ]
}