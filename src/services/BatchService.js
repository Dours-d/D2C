const models = require('../database/models');
const FeeCalculator = require('./FeeCalculator');
const ExchangeRateService = require('./ExchangeRateService');

/**
 * Batch Processing Service
 */
class BatchService {
  /**
   * Create a new batch from donation IDs
   * @param {Array} donationIds - Array of donation IDs
   * @param {string} targetWallet - Target wallet address
   * @param {string} campaignId - Optional campaign ID
   * @param {string} userId - User ID creating the batch
   * @returns {Promise<Object>} Created batch
   */
  async createBatch(donationIds, targetWallet, campaignId = null, userId) {
    if (!donationIds || donationIds.length === 0) {
      throw new Error('At least one donation is required');
    }

    if (!targetWallet) {
      throw new Error('Target wallet address is required');
    }

    // Get donations
    const { Op } = require('sequelize');
    const donations = await models.Donation.findAll({
      where: {
        donationId: {
          [Op.in]: donationIds
        },
        status: 'pending'
      }
    });

    if (donations.length === 0) {
      throw new Error('No pending donations found');
    }

    // Use campaign from first donation if not provided
    const finalCampaignId = campaignId || donations[0].campaignId;

    // Calculate batch totals
    const totals = FeeCalculator.calculateBatchFees(donations);

    // Create batch
    const batch = await models.TransactionBatch.create({
      campaignId: finalCampaignId,
      totalGrossEur: totals.totalGrossEur,
      totalDebtFeeEur: totals.totalDebtFeeEur,
      totalOperationalFeeEur: totals.totalOperationalFeeEur,
      totalTransactionFeeEur: totals.totalTransactionFeeEur,
      totalNetEur: totals.totalNetEur,
      targetWallet,
      network: 'TRON',
      status: 'draft',
      initiatedBy: userId
    });

    // Link donations to batch
    await models.BatchDonation.bulkCreate(
      donations.map(donation => ({
        batchId: batch.batchId,
        donationId: donation.donationId
      }))
    );

    // Update donation statuses
    const { Op } = require('sequelize');
    await models.Donation.update(
      { status: 'batched' },
      { where: { donationId: { [Op.in]: donationIds } } }
    );

    return batch;
  }

  /**
   * Process batch (convert to EUR, get exchange rates)
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Updated batch
   */
  async processBatch(batchId) {
    const batch = await models.TransactionBatch.findByPk(batchId, {
      include: [
        {
          model: models.BatchDonation,
          as: 'batchDonations',
          include: [
            {
              model: models.Donation,
              as: 'donation'
            }
          ]
        }
      ]
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'draft' && batch.status !== 'pending') {
      throw new Error(`Batch cannot be processed from status: ${batch.status}`);
    }

    // Get EUR to USDT rate
    const rateInfo = await ExchangeRateService.getExchangeRate('EUR', 'USDT');

    // Calculate USDT amount
    const usdtAmount = batch.totalNetEur * rateInfo.rate;

    // Update batch
    await batch.update({
      status: 'processing',
      targetUsdtAmount: usdtAmount,
      eurToUsdtRate: rateInfo.rate,
      initiatedAt: new Date()
    });

    return batch;
  }

  /**
   * Get batch details with all related data
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Batch with donations
   */
  async getBatchDetails(batchId) {
    const batch = await models.TransactionBatch.findByPk(batchId, {
      include: [
        {
          model: models.Campaign,
          as: 'campaign'
        },
        {
          model: models.User,
          as: 'initiator',
          attributes: ['userId', 'username', 'email']
        },
        {
          model: models.BatchDonation,
          as: 'batchDonations',
          include: [
            {
              model: models.Donation,
              as: 'donation'
            }
          ]
        },
        {
          model: models.BlockchainTransaction,
          as: 'blockchainTransactions'
        },
        {
          model: models.FeeAllocation,
          as: 'feeAllocations'
        }
      ]
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    return batch;
  }

  /**
   * Update batch status
   * @param {string} batchId - Batch ID
   * @param {string} status - New status
   * @param {Object} updateData - Additional data to update
   * @returns {Promise<Object>} Updated batch
   */
  async updateBatchStatus(batchId, status, updateData = {}) {
    const batch = await models.TransactionBatch.findByPk(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    const update = {
      status,
      ...updateData
    };

    if (status === 'completed') {
      update.completedAt = new Date();
    }

    await batch.update(update);

    return batch;
  }

  /**
   * Allocate fees for a batch
   * @param {string} batchId - Batch ID
   * @returns {Promise<Array>} Created fee allocations
   */
  async allocateFees(batchId) {
    const batch = await models.TransactionBatch.findByPk(batchId, {
      include: [
        {
          model: models.BatchDonation,
          as: 'batchDonations',
          include: [
            {
              model: models.Donation,
              as: 'donation'
            }
          ]
        }
      ]
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const allocations = [];

    // Allocate fees for each donation in batch
    for (const batchDonation of batch.batchDonations) {
      const donation = batchDonation.donation;

      // Debt fee allocation
      allocations.push(
        await models.FeeAllocation.create({
          batchId,
          donationId: donation.donationId,
          feeType: 'debt',
          feePercent: donation.debtFeePercent,
          feeAmountEur: donation.debtFeeAmount
        })
      );

      // Operational fee allocation
      allocations.push(
        await models.FeeAllocation.create({
          batchId,
          donationId: donation.donationId,
          feeType: 'operational',
          feePercent: donation.operationalFeePercent,
          feeAmountEur: donation.operationalFeeAmount
        })
      );

      // Transaction fee allocation
      allocations.push(
        await models.FeeAllocation.create({
          batchId,
          donationId: donation.donationId,
          feeType: 'transaction',
          feePercent: donation.transactionFeePercent,
          feeAmountEur: donation.transactionFeeAmount
        })
      );
    }

    return allocations;
  }

  /**
   * List all batches
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Batches
   */
  async listBatches(filters = {}) {
    const { status, campaignId, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (campaignId) where.campaignId = campaignId;

    const { count, rows } = await models.TransactionBatch.findAndCountAll({
      where,
      include: [
        {
          model: models.Campaign,
          as: 'campaign',
          attributes: ['campaignId', 'campaignName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return {
      batches: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }
}

module.exports = new BatchService();
