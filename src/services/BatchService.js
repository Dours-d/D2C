const models = require('../database/models');
const FeeCalculator = require('./FeeCalculator');
const ExchangeRateService = require('./ExchangeRateService');
const config = require('../config');
const { Op } = require('sequelize');

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

    const metadata = batch.metadata || {};
    if (!metadata.grossDepositEur) {
      throw new Error('Gross deposit must be set before processing batch');
    }

    // Get EUR to USDT rate
    const rateInfo = await ExchangeRateService.getExchangeRate('EUR', 'USDT');

    // Calculate USDT amount
    const usdtAmount = batch.totalNetEur * rateInfo.rate;

    const reserve = this.getSimplexReserve(batch.totalNetEur);
    const operationalStatus = this.buildOperationalFeeStatus(batch, metadata);
    metadata.simplexMinEur = reserve.minimumEur;
    metadata.simplexReserveEur = reserve.reserveRequiredEur;
    metadata.simplexEligible = reserve.reserveRequiredEur === 0;
    metadata.operationalFeeGrossDepositEur = operationalStatus.baseGrossEur;
    metadata.operationalFeeCurrentEur = operationalStatus.currentEur;
    metadata.operationalFeePaidEur = operationalStatus.paidEur;
    metadata.operationalFeeDueEur = operationalStatus.dueEur;

    // Update batch
    await batch.update({
      status: 'processing',
      targetUsdtAmount: usdtAmount,
      eurToUsdtRate: rateInfo.rate,
      initiatedAt: new Date(),
      metadata
    });

    return batch;
  }

  getSimplexReserve(totalNetEur) {
    const minimum = Number.isFinite(config.simplex.minPurchaseEur)
      ? config.simplex.minPurchaseEur
      : 44;
    const total = parseFloat(totalNetEur || 0);
    const reserveRequired = total >= minimum ? 0 : this.roundDecimal(minimum - total, 2);

    return {
      minimumEur: minimum,
      reserveRequiredEur: reserveRequired
    };
  }

  roundDecimal(value, decimals = 2) {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  buildOperationalFeeStatus(batch, metadata = {}) {
    const baseGrossEur = parseFloat(
      metadata.grossDepositEur || batch.totalNetEur || 0
    );
    const currentEur = this.roundDecimal(baseGrossEur * 0.1, 2);
    const paidEur = this.roundDecimal(parseFloat(metadata.operationalFeePaidEur || 0), 2);
    const dueEur = this.roundDecimal(Math.max(currentEur - paidEur, 0), 2);

    return {
      baseGrossEur: this.roundDecimal(baseGrossEur, 2),
      currentEur,
      paidEur,
      dueEur
    };
  }

  async getOperationalFeeStatus(batchId) {
    const batch = await models.TransactionBatch.findByPk(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    const metadata = batch.metadata || {};
    const status = this.buildOperationalFeeStatus(batch, metadata);

    return {
      batchId: batch.batchId,
      baseGrossEur: status.baseGrossEur,
      currentEur: status.currentEur,
      paidEur: status.paidEur,
      dueEur: status.dueEur
    };
  }

  async recordOperationalFeePayment(batchId, amountEur, note = null) {
    const batch = await models.TransactionBatch.findByPk(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    const amount = this.roundDecimal(parseFloat(amountEur || 0), 2);
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    const metadata = batch.metadata || {};
    const currentPaid = this.roundDecimal(parseFloat(metadata.operationalFeePaidEur || 0), 2);
    const newPaid = this.roundDecimal(currentPaid + amount, 2);

    const status = this.buildOperationalFeeStatus(batch, {
      ...metadata,
      operationalFeePaidEur: newPaid
    });

    metadata.operationalFeePaidEur = status.paidEur;
    metadata.operationalFeeDueEur = status.dueEur;
    metadata.operationalFeeCurrentEur = status.currentEur;
    metadata.operationalFeeGrossDepositEur = status.baseGrossEur;
    metadata.operationalFeeLastPaidAt = new Date().toISOString();
    metadata.operationalFeeLastPaymentEur = amount;
    if (note) {
      metadata.operationalFeeLastNote = note;
    }

    await batch.update({ metadata });

    return {
      batchId: batch.batchId,
      ...status
    };
  }

  async getBatchReserve(batchId) {
    const batch = await models.TransactionBatch.findByPk(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    const reserve = this.getSimplexReserve(batch.totalNetEur);

    return {
      batchId: batch.batchId,
      totalNetEur: parseFloat(batch.totalNetEur || 0),
      minimumEur: reserve.minimumEur,
      reserveRequiredEur: reserve.reserveRequiredEur,
      eligible: reserve.reserveRequiredEur === 0
    };
  }

  async getLandingChecklist(batchId) {
    const batch = await models.TransactionBatch.findByPk(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    const metadata = batch.metadata || {};
    const reserve = this.getSimplexReserve(batch.totalNetEur);
    const operational = this.buildOperationalFeeStatus(batch, metadata);

    const grossDepositSet = parseFloat(metadata.grossDepositEur || 0) > 0;
    const operationalPaid = operational.currentEur > 0 && operational.dueEur === 0;
    const processedStatuses = ['processing', 'awaiting_simplex', 'simplex_processing', 'sending', 'completed'];
    const simplexInitiatedStatuses = ['awaiting_simplex', 'simplex_processing', 'sending', 'completed'];
    const isProcessed = processedStatuses.includes(batch.status);
    const simplexInitiated = Boolean(metadata.simplexRequestId || metadata.simplexQuoteId) || simplexInitiatedStatuses.includes(batch.status);
    const tronSent = Boolean(batch.transactionHash) || ['sending', 'completed'].includes(batch.status);

    return {
      batchId: batch.batchId,
      status: batch.status,
      metrics: {
        grossDepositEur: this.roundDecimal(parseFloat(metadata.grossDepositEur || 0), 2),
        totalNetEur: this.roundDecimal(parseFloat(batch.totalNetEur || 0), 2),
        simplexMinimumEur: reserve.minimumEur,
        simplexReserveRequiredEur: reserve.reserveRequiredEur,
        operationalFeeCurrentEur: operational.currentEur,
        operationalFeePaidEur: operational.paidEur,
        operationalFeeDueEur: operational.dueEur
      },
      steps: [
        {
          key: 'gross_deposit_set',
          label: 'Gross deposit recorded',
          done: grossDepositSet,
          value: this.roundDecimal(parseFloat(metadata.grossDepositEur || 0), 2)
        },
        {
          key: 'operational_fee_computed',
          label: 'Operational fee computed (10% of gross)',
          done: grossDepositSet && operational.currentEur > 0,
          value: operational.currentEur
        },
        {
          key: 'operational_fee_paid',
          label: 'Operational fee marked as paid',
          done: operationalPaid,
          value: {
            paidEur: operational.paidEur,
            dueEur: operational.dueEur
          }
        },
        {
          key: 'batch_processed',
          label: 'Batch processed',
          done: isProcessed
        },
        {
          key: 'simplex_eligible',
          label: 'Eligible for Simplex minimum',
          done: reserve.reserveRequiredEur === 0,
          value: reserve.reserveRequiredEur
        },
        {
          key: 'simplex_initiated',
          label: 'Simplex purchase initiated',
          done: simplexInitiated
        },
        {
          key: 'tron_sent',
          label: 'TRON transfer sent',
          done: tronSent
        },
        {
          key: 'batch_completed',
          label: 'Batch completed',
          done: batch.status === 'completed'
        }
      ]
    };
  }

  async setGrossDeposit(batchId, grossDepositEur, note = null) {
    const batch = await models.TransactionBatch.findByPk(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    const gross = this.roundDecimal(parseFloat(grossDepositEur || 0), 2);
    if (gross <= 0) {
      throw new Error('Gross deposit must be greater than 0');
    }

    const metadata = batch.metadata || {};
    metadata.grossDepositEur = gross;
    metadata.operationalFeeGrossDepositEur = gross;
    metadata.operationalFeeWithheldEur = this.roundDecimal(gross * 0.1, 2);
    if (note) {
      metadata.grossDepositNote = note;
    }

    const status = this.buildOperationalFeeStatus(batch, metadata);
    metadata.operationalFeeCurrentEur = status.currentEur;
    metadata.operationalFeeDueEur = status.dueEur;

    await batch.update({ metadata });

    return {
      batchId: batch.batchId,
      grossDepositEur: gross,
      operationalFeeWithheldEur: metadata.operationalFeeWithheldEur,
      operationalFee: {
        baseGrossEur: status.baseGrossEur,
        currentEur: status.currentEur,
        paidEur: status.paidEur,
        dueEur: status.dueEur
      }
    };
  }

  async getReserveSummary(dateString) {
    const { start, end, label } = this.resolveDateRange(dateString);

    const batches = await models.TransactionBatch.findAll({
      where: {
        initiatedAt: {
          [Op.gte]: start,
          [Op.lt]: end
        }
      }
    });

    let totalReserve = 0;
    let belowMinimumCount = 0;

    batches.forEach((batch) => {
      const reserve = this.getSimplexReserve(batch.totalNetEur);
      totalReserve += reserve.reserveRequiredEur;
      if (reserve.reserveRequiredEur > 0) {
        belowMinimumCount += 1;
      }
    });

    return {
      date: label,
      batchCount: batches.length,
      belowMinimumCount,
      minimumEur: this.getSimplexReserve(0).minimumEur,
      totalReserveEur: this.roundDecimal(totalReserve, 2)
    };
  }

  resolveDateRange(dateString) {
    const base = dateString ? new Date(dateString) : new Date();
    if (Number.isNaN(base.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    const start = new Date(base);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const label = start.toISOString().slice(0, 10);

    return { start, end, label };
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
