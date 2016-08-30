
/**
 * Converts somewhat boolean values and strings such as 'false'.
 *
 * @param {Any} input
 * @return {Boolean}
 */
const parseBool = (input) => {
  if (typeof input === 'undefined') { return undefined; }
  if (typeof input === 'boolean') { return input; }
  if (typeof input === 'string') { return input != 'false'; }

  return !!input;
}

var database = {
    port: process.env.PORT || 3000,
    icws_app_port: process.env.ICWS_APP_PORT || 5000,
    icws_app_server: typeof process.env.ICWS_APP_SERVER === undefined ? false : parseBool(process.env.ICWS_APP_SERVER),
    dataset: process.env.DATASET || 'ApicBI',
    dataset_icws: process.env.DATASET_ICWS || 'ApicBI_ICWS',
    icws_sub_id: process.env.ICWS_SUB_ID || 'kugghuset-1',
    allow_push: typeof process.env.ALLOW_PUSH === 'undefinend' ? false : parseBool(process.env.ALLOW_PUSH),
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