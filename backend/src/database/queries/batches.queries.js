const models = require('../models');

const listBatches = (options = {}) => {
  return models.TransactionBatch.findAll(options);
};

const getBatchById = (batchId) => {
  return models.TransactionBatch.findByPk(batchId);
};

module.exports = {
  listBatches,
  getBatchById
};
