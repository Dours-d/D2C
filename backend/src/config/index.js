const database = require('./database');
const blockchain = require('./blockchain');
const rates = require('./rates');

const legacyConfig = require('../../../src/config');

module.exports = {
  env: process.env.NODE_ENV || legacyConfig.env || 'development',
  port: process.env.PORT || legacyConfig.port || 3000,
  jwt: legacyConfig.jwt,
  redis: legacyConfig.redis,
  whatsapp: legacyConfig.whatsapp,
  stripe: legacyConfig.stripe,
  simplex: legacyConfig.simplex,
  database,
  blockchain,
  rates,
  validateConfig: legacyConfig.validateConfig
};
