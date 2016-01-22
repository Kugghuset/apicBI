module.exports = {
    name: 'ApicBI',
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
            name: 'day_aggregated', columns: [
                { name: 'Agent', dataType: 'String' },
                { name: 'Call duration in seconds', dataType: 'Int64' },
                { name: 'Waiting time in seconds', dataType: 'Int64' },
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