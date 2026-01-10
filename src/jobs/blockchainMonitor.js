const models = require('../database/models');
const TronService = require('../services/TronService');
const { blockchainQueue } = require('../queue');

/**
 * Blockchain Transaction Monitor Job Worker
 */
blockchainQueue.process('monitor-transaction', async (job) => {
  const { transactionHash } = job.data;

  try {
    await TronService.updateTransactionStatus(transactionHash);
    return { success: true, transactionHash };
  } catch (error) {
    console.error('Blockchain monitor error:', error);
    throw error;
  }
});

// Monitor pending transactions periodically
setInterval(async () => {
  try {
    const { Op } = require('sequelize');
    const pendingTransactions = await models.BlockchainTransaction.findAll({
      where: {
        status: {
          [Op.in]: ['pending', 'processing']
        }
      },
      limit: 10
    });

    for (const tx of pendingTransactions) {
      await blockchainQueue.add('monitor-transaction', {
        transactionHash: tx.transactionHash
      });
    }
  } catch (error) {
    console.error('Periodic blockchain monitor error:', error);
  }
}, 60000); // Check every minute

module.exports = blockchainQueue;
