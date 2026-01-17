const TronService = require('../../../src/services/TronService');

const run = async (transactionId) => {
  return TronService.getTransactionStatus(transactionId);
};

module.exports = {
  run
};
