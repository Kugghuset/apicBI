module.exports = {
    name: 'ApicBI',
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
                { name: 'Date disconnected', dataType: 'Datetime' }
            ]
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
                { name: 'Date disconnected', dataType: 'Datetime' }
            ]
        }
    ]
}