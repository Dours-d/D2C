const models = require('../database/models');
const FeeCalculator = require('../services/FeeCalculator');
const CurrencyConverter = require('../services/CurrencyConverter');

/**
 * Donation Controller
 */
class DonationController {
  /**
   * List all donations
   * GET /api/donations
   */
  async list(req, res) {
    try {
      const { status, sourceType, campaignId, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (status) where.status = status;
      if (sourceType) where.sourceType = sourceType;
      if (campaignId) where.campaignId = campaignId;

      const { count, rows } = await models.Donation.findAndCountAll({
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

      res.json({
        success: true,
        donations: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('List donations error:', error);
      res.status(500).json({ error: 'Failed to list donations' });
    }
  }

  /**
   * Get donation by ID
   * GET /api/donations/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;

      const donation = await models.Donation.findByPk(id, {
        include: [
          {
            model: models.Campaign,
            as: 'campaign'
          }
        ]
      });

      if (!donation) {
        return res.status(404).json({ error: 'Donation not found' });
      }

      res.json({
        success: true,
        donation
      });
    } catch (error) {
      console.error('Get donation error:', error);
      res.status(500).json({ error: 'Failed to get donation' });
    }
  }

  /**
   * Create donation with automatic fee calculation
   * POST /api/donations
   */
  async create(req, res) {
    try {
      const {
        campaignId,
        sourceType,
        sourceIdentifier,
        donorName,
        whatsappNumber,
        email,
        originalAmount,
        originalCurrency,
        donationDate
      } = req.body;

      if (!campaignId || !sourceType || !originalAmount || !originalCurrency) {
        return res.status(400).json({ error: 'Campaign ID, source type, amount, and currency are required' });
      }

      // Convert to EUR
      const conversion = await CurrencyConverter.convertToEur(originalAmount, originalCurrency);

      // Calculate fees
      const fees = FeeCalculator.calculateFees(
        conversion.euroAmount,
        process.env.DEFAULT_DEBT_FEE_PERCENT || 10,
        process.env.DEFAULT_OPERATIONAL_FEE_PERCENT || 10,
        process.env.DEFAULT_TRANSACTION_FEE_PERCENT || 5
      );

      // Create donation
      const donation = await models.Donation.create({
        campaignId,
        sourceType,
        sourceIdentifier,
        donorName,
        whatsappNumber,
        email,
        originalAmount,
        originalCurrency,
        euroAmount: conversion.euroAmount,
        conversionRate: conversion.conversionRate,
        totalFeePercent: fees.totalFeePercent,
        debtFeePercent: fees.debtFeePercent,
        operationalFeePercent: fees.operationalFeePercent,
        transactionFeePercent: fees.transactionFeePercent,
        debtFeeAmount: fees.debtFeeAmount,
        operationalFeeAmount: fees.operationalFeeAmount,
        transactionFeeAmount: fees.transactionFeeAmount,
        netAmountEur: fees.netAmount,
        donationDate: donationDate ? new Date(donationDate) : new Date(),
        status: 'pending',
        processedBy: req.user.userId
      });

      // Update campaign totals
      await this.updateCampaignTotals(campaignId);

      res.status(201).json({
        success: true,
        donation
      });
    } catch (error) {
      console.error('Create donation error:', error);
      res.status(500).json({ error: 'Failed to create donation' });
    }
  }

  /**
   * Batch create donations
   * POST /api/donations/batch-create
   */
  async batchCreate(req, res) {
    try {
      const { donations } = req.body;

      if (!Array.isArray(donations) || donations.length === 0) {
        return res.status(400).json({ error: 'Donations array is required' });
      }

      const createdDonations = [];

      for (const donationData of donations) {
        const {
          campaignId,
          sourceType,
          sourceIdentifier,
          donorName,
          whatsappNumber,
          email,
          originalAmount,
          originalCurrency,
          donationDate
        } = donationData;

        // Convert to EUR
        const conversion = await CurrencyConverter.convertToEur(originalAmount, originalCurrency);

        // Calculate fees
        const fees = FeeCalculator.calculateFees(conversion.euroAmount);

        // Create donation
        const donation = await models.Donation.create({
          campaignId,
          sourceType,
          sourceIdentifier,
          donorName,
          whatsappNumber,
          email,
          originalAmount,
          originalCurrency,
          euroAmount: conversion.euroAmount,
          conversionRate: conversion.conversionRate,
          totalFeePercent: fees.totalFeePercent,
          debtFeePercent: fees.debtFeePercent,
          operationalFeePercent: fees.operationalFeePercent,
          transactionFeePercent: fees.transactionFeePercent,
          debtFeeAmount: fees.debtFeeAmount,
          operationalFeeAmount: fees.operationalFeeAmount,
          transactionFeeAmount: fees.transactionFeeAmount,
          netAmountEur: fees.netAmount,
          donationDate: donationDate ? new Date(donationDate) : new Date(),
          status: 'pending',
          processedBy: req.user.userId
        });

        createdDonations.push(donation);

        // Update campaign totals
        await this.updateCampaignTotals(campaignId);
      }

      res.status(201).json({
        success: true,
        donations: createdDonations,
        count: createdDonations.length
      });
    } catch (error) {
      console.error('Batch create donations error:', error);
      res.status(500).json({ error: 'Failed to batch create donations' });
    }
  }

  /**
   * Update donation
   * PUT /api/donations/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const donation = await models.Donation.findByPk(id);

      if (!donation) {
        return res.status(404).json({ error: 'Donation not found' });
      }

      // If amount or currency changed, recalculate fees
      if (updateData.originalAmount || updateData.originalCurrency) {
        const originalAmount = updateData.originalAmount || donation.originalAmount;
        const originalCurrency = updateData.originalCurrency || donation.originalCurrency;

        const conversion = await CurrencyConverter.convertToEur(originalAmount, originalCurrency);
        const fees = FeeCalculator.calculateFees(conversion.euroAmount);

        updateData.euroAmount = conversion.euroAmount;
        updateData.conversionRate = conversion.conversionRate;
        updateData.debtFeeAmount = fees.debtFeeAmount;
        updateData.operationalFeeAmount = fees.operationalFeeAmount;
        updateData.transactionFeeAmount = fees.transactionFeeAmount;
        updateData.netAmountEur = fees.netAmount;
      }

      await donation.update(updateData);

      // Update campaign totals
      await this.updateCampaignTotals(donation.campaignId);

      res.json({
        success: true,
        donation
      });
    } catch (error) {
      console.error('Update donation error:', error);
      res.status(500).json({ error: 'Failed to update donation' });
    }
  }

  /**
   * Get donation statistics
   * GET /api/donations/stats
   */
  async getStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const where = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      const donations = await models.Donation.findAll({
        where,
        attributes: [
          [models.sequelize.fn('SUM', models.sequelize.col('euro_amount')), 'totalEur'],
          [models.sequelize.fn('SUM', models.sequelize.col('debt_fee_amount')), 'totalDebtFee'],
          [models.sequelize.fn('SUM', models.sequelize.col('operational_fee_amount')), 'totalOperationalFee'],
          [models.sequelize.fn('SUM', models.sequelize.col('transaction_fee_amount')), 'totalTransactionFee'],
          [models.sequelize.fn('SUM', models.sequelize.col('net_amount_eur')), 'totalNet'],
          [models.sequelize.fn('COUNT', models.sequelize.col('donation_id')), 'count']
        ],
        raw: true
      });

      res.json({
        success: true,
        stats: donations[0] || {}
      });
    } catch (error) {
      console.error('Get donation stats error:', error);
      res.status(500).json({ error: 'Failed to get donation statistics' });
    }
  }

  /**
   * Get pending donations
   * GET /api/donations/pending
   */
  async getPending(req, res) {
    try {
      const donations = await models.Donation.findAll({
        where: { status: 'pending' },
        include: [
          {
            model: models.Campaign,
            as: 'campaign',
            attributes: ['campaignId', 'campaignName']
          }
        ],
        order: [['createdAt', 'ASC']]
      });

      res.json({
        success: true,
        donations
      });
    } catch (error) {
      console.error('Get pending donations error:', error);
      res.status(500).json({ error: 'Failed to get pending donations' });
    }
  }

  /**
   * Update campaign totals
   * @private
   */
  async updateCampaignTotals(campaignId) {
    const campaign = await models.Campaign.findByPk(campaignId);
    if (!campaign) return;

    const totals = await models.Donation.findAll({
      where: { campaignId },
      attributes: [
        [models.sequelize.fn('SUM', models.sequelize.col('euro_amount')), 'totalDonations'],
        [models.sequelize.fn('SUM', models.sequelize.col('debt_fee_amount')), 'totalDebtFee'],
        [models.sequelize.fn('SUM', models.sequelize.col('operational_fee_amount')), 'totalOperationalFee'],
        [models.sequelize.fn('SUM', models.sequelize.col('transaction_fee_amount')), 'totalTransactionFee']
      ],
      raw: true,
      group: []
    });
    
    const totalDonations = parseFloat(totals[0]?.totalDonations || 0);
    const totalFees = parseFloat(totals[0]?.totalDebtFee || 0) +
                     parseFloat(totals[0]?.totalOperationalFee || 0) +
                     parseFloat(totals[0]?.totalTransactionFee || 0);

    await campaign.update({
      totalDonationsEur: totalDonations,
      totalFeesEur: totalFees
    });
  }
}

module.exports = new DonationController();
