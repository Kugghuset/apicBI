var database = {
    tickety: {
        host: process.env.SQL_TICKETY_SERVER,
        database: process.env.SQL_TICKETY_DATABASE,
        domain: process.env.SQL_TICKETY_DOMAIN,
        user: process.env.SQL_TICKETY_USERNAME,
        password: process.env.SQL_TICKETY_PASSWORD,
    },
    ic: {
        host: process.env.SQL_IC_SERVER,
        database: process.env.SQL_IC_DATABASE,
        user: process.env.SQL_IC_USERNAME,
        password: process.env.SQL_IC_PASSWORD,
    }
}

module.exports = database;