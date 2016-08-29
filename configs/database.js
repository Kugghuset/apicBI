

var database = {
    dataset: process.env.DATASET || 'ApicBI',
    dataset_icws: process.env.DATASET_ICWS || 'ApicBI_ICWS',
    icws_sub_id: process.env.ICWS_SUB_ID || 'kugghuset-1',
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