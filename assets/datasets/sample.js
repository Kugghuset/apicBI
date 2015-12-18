module.exports = {
    name: 'ApicBI',
    tables: [
        {
            name: 'Calls', columns: [
                { name: 'ID', dataType: 'Int64' },
                { name: 'Number', dataType: 'string' },
                { name: 'Started', dataType: 'DateTime' },
                { name: 'Ended', dataType: 'DateTime' }
            ]
        }
    ]
}