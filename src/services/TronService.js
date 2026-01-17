const TronWeb = require('tronweb');
const models = require('../database/models');

/**
 * TRON Blockchain Service
 */
class TronService {
  constructor() {
    this.network = process.env.TRON_NETWORK || 'mainnet';
    this.privateKey = process.env.TRON_PRIVATE_KEY;
    this.usdtContract = process.env.TRON_USDT_CONTRACT || process.env.USDT_TRC20_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

    // Initialize TronWeb
    if (this.network === 'mainnet') {
      this.tronWeb = new TronWeb({
        fullHost: process.env.TRON_FULL_NODE || 'https://api.trongrid.io',
        solidityNode: process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io',
        eventServer: process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io',
        privateKey: this.privateKey
      });
    } else {
      // Testnet
      this.tronWeb = new TronWeb({
        fullHost: 'https://api.shasta.trongrid.io',
        solidityNode: 'https://api.shasta.trongrid.io',
        eventServer: 'https://api.shasta.trongrid.io',
        privateKey: this.privateKey
      });
    }
  }

  /**
   * Validate TRON address
   * @param {string} address - TRON address
   * @returns {boolean} True if valid
   */
  isValidAddress(address) {
    return TronWeb.isAddress(address);
  }

  /**
   * Send USDT to TRON address
   * @param {string} toAddress - Recipient address
   * @param {number} amount - Amount in USDT
   * @returns {Promise<Object>} Transaction result
   */
  async sendUSDT(toAddress, amount) {
    if (!this.privateKey) {
      throw new Error('TRON private key not configured');
    }

    if (!this.isValidAddress(toAddress)) {
      throw new Error('Invalid TRON address');
    }

    try {
      // Get USDT contract instance
      const contract = await this.tronWeb.contract().at(this.usdtContract);

      // Convert amount to sun (USDT has 6 decimals)
      const amountInSun = this.tronWeb.toSun(amount);

      // Send transaction
      const transaction = await contract.transfer(toAddress, amountInSun).send();

      return {
        transactionHash: transaction,
        toAddress,
        amount,
        status: 'pending'
      };
    } catch (error) {
      console.error('TRON send error:', error);
      throw new Error(`Failed to send USDT: ${error.message}`);
    }
  }

  /**
   * Send USDT for a batch
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Transaction result
   */
  async sendBatchToTron(batchId) {
    const batch = await models.TransactionBatch.findByPk(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'sending' && batch.status !== 'awaiting_simplex') {
      throw new Error(`Batch status must be 'sending' or 'awaiting_simplex', current: ${batch.status}`);
    }

    if (!batch.targetUsdtAmount) {
      throw new Error('Batch USDT amount not set');
    }

    try {
      // Send USDT
      const transactionResult = await this.sendUSDT(
        batch.targetWallet,
        parseFloat(batch.targetUsdtAmount)
      );

      // Create blockchain transaction record
      const blockchainTx = await models.BlockchainTransaction.create({
        batchId: batch.batchId,
        fromWallet: this.tronWeb.defaultAddress.base58,
        toWallet: batch.targetWallet,
        usdtAmount: batch.targetUsdtAmount,
        transactionHash: transactionResult.transactionHash,
        status: 'processing'
      });

      // Update batch
      await batch.update({
        status: 'sending',
        transactionHash: transactionResult.transactionHash,
        sentToBlockchainAt: new Date()
      });

      return {
        batch,
        transaction: blockchainTx,
        transactionHash: transactionResult.transactionHash
      };
    } catch (error) {
      // Update batch status on error
      const metadata = batch.metadata || {};
      metadata.error = error.message;
      
      await batch.update({
        status: 'failed',
        metadata
      });

      throw error;
    }
  }

  /**
   * Check transaction confirmation
   * @param {string} transactionHash - Transaction hash
   * @returns {Promise<Object>} Transaction status
   */
  async checkTransaction(transactionHash) {
    try {
      const transaction = await this.tronWeb.trx.getTransaction(transactionHash);

      if (!transaction) {
        return {
          found: false,
          status: 'not_found'
        };
      }

      const confirmed = transaction.ret && transaction.ret[0] && transaction.ret[0].contractRet === 'SUCCESS';

      return {
        found: true,
        confirmed,
        status: confirmed ? 'confirmed' : 'failed',
        blockNumber: transaction.blockNumber,
        transaction
      };
    } catch (error) {
      console.error('TRON transaction check error:', error);
      throw new Error(`Failed to check transaction: ${error.message}`);
    }
  }

  /**
   * Update blockchain transaction status
   * @param {string} transactionHash - Transaction hash
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransactionStatus(transactionHash) {
    const blockchainTx = await models.BlockchainTransaction.findOne({
      where: { transactionHash }
    });

    if (!blockchainTx) {
      throw new Error('Blockchain transaction not found');
    }

    const status = await this.checkTransaction(transactionHash);

    if (status.found && status.confirmed) {
      await blockchainTx.update({
        status: 'confirmed',
        blockNumber: status.blockNumber,
        confirmedAt: new Date(),
        confirmations: 1 // Could be enhanced to get actual confirmations
      });

      // Update batch if all transactions confirmed
      const batch = await models.TransactionBatch.findByPk(blockchainTx.batchId);
      if (batch) {
        await batch.update({
          status: 'completed',
          blockNumber: status.blockNumber,
          completedAt: new Date()
        });

        // Update donation statuses
        const { Op } = require('sequelize');
        const batchDonations = await models.BatchDonation.findAll({
          where: { batchId: batch.batchId }
        });

        await models.Donation.update(
          { status: 'sent' },
          {
            where: {
              donationId: {
                [Op.in]: batchDonations.map(bd => bd.donationId)
              }
            }
          }
        );
      }
    } else if (status.found && !status.confirmed) {
      await blockchainTx.update({
        status: 'failed'
      });
    }

    return blockchainTx;
  }

  /**
   * Get account balance
   * @param {string} address - TRON address
   * @returns {Promise<Object>} Account balance
   */
  async getBalance(address) {
    try {
      const trxBalance = await this.tronWeb.trx.getBalance(address);
      const usdtBalance = await this.getUSDTBalance(address);

      return {
        address,
        trx: this.tronWeb.fromSun(trxBalance),
        usdt: usdtBalance
      };
    } catch (error) {
      console.error('Get balance error:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Get USDT balance for address
   * @param {string} address - TRON address
   * @returns {Promise<number>} USDT balance
   */
  async getUSDTBalance(address) {
    try {
      const contract = await this.tronWeb.contract().at(this.usdtContract);
      const balance = await contract.balanceOf(address).call();
      return parseFloat(this.tronWeb.fromSun(balance));
    } catch (error) {
      console.error('Get USDT balance error:', error);
      return 0;
    }
  }
}

module.exports = new TronService();
