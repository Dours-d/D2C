const ExchangeRateService = require('../../../src/services/ExchangeRateService');

const run = async () => {
  return ExchangeRateService.refreshRates();
};

module.exports = {
  run
};
