module.exports = {
    name: 'ApicBI',
    tables: [
        {
            name: 'poll_per_agent_call_length_this_week', columns [
                { name: 'Agent', dataType: 'String' },
                { name: 'Call duration in seconds' dataType: 'Int64' },
                { name: 'Waiting time in seconds', dataType: 'Int64' },
                { name: 'Is under 60', dataType: 'Int64' }
            ]
        }
        {
            name: 'day_per_agent', columns: [
                { name: 'Agent', dataType: 'String' },
                { name: 'Total calls today', dataType: 'Int64' },
                { name: 'Total calls this week', dataType: 'Int64' },
                { name: 'Average calls by now', dataType: 'Int64' },
                { name: 'Average call duration today', dataType: 'Int64' },
                { name: 'Pretty average call duration today', dataType: 'String' },
                { name: 'Average call duration this week', dataType: 'Int64' },
                { name: 'Pretty average call duration this week', dataType: 'String' },
                { name: 'Average call duration by now', dataType: 'Int64' },
                { name: 'Pretty average call duration by now', dataType: 'String' }
            ]
        },
        {
            name: 'week_per_agent', columns: [
                { name: 'Agent', dataType: 'String' },
                { name: 'Total calls today', dataType: 'Int64' },
                { name: 'Total calls this week', dataType: 'Int64' },
                { name: 'Average calls by now', dataType: 'Int64' },
                { name: 'Average call duration today', dataType: 'Int64' },
                { name: 'Pretty average call duration today', dataType: 'String' },
                { name: 'Average call duration this week', dataType: 'Int64' },
                { name: 'Pretty average call duration this week', dataType: 'String' },
                { name: 'Average call duration by now', dataType: 'Int64' },
                { name: 'Pretty average call duration by now', dataType: 'String' }
            ]
        },
        {
            name: 'day_aggregated', columns:
            [
                { name: 'Max waiting time in seconds', dataType: 'Double' },
                { name: 'Average waiting time in seconds', dataType: 'Double' },
                { name: 'Number of calls', dataType: 'Int64' },
                { name: 'Average call duration in seconds', dataType: 'Int64' },
                { name: 'Percentage of calls shorter than a minute', dataType: 'Double' },
                { name: 'Number of calls this week', dataType: 'Int64' },
                { name: 'Average call duration in seconds this week', dataType: 'Double'}
            ]
        },
        {
            name: 'week_aggregated', columns:
            [
                { name: 'Max waiting time in seconds', dataType: 'Double' },
                { name: 'Average waiting time in seconds', dataType: 'Double' },
                { name: 'Number of calls', dataType: 'Int64' },
                { name: 'Average call duration in seconds', dataType: 'Int64' },
                { name: 'Percentage of calls shorter than a minute', dataType: 'Double' },
                { name: 'Number of calls this week', dataType: 'Int64' },
                { name: 'Average call duration in seconds this week', dataType: 'Double'}
            ]
        }
    ]
}