const BatchService = require('../../../src/services/BatchService');

const run = async (batchId) => {
  return BatchService.processBatch(batchId);
};

module.exports = {
  run
};
