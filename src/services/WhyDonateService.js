const csv = require('csv-parser');
const fs = require('fs');
const models = require('../database/models');
const CurrencyConverter = require('./CurrencyConverter');
const FeeCalculator = require('./FeeCalculator');

/**
 * WhyDonate CSV Import Service
 */
class WhyDonateService {
  /**
   * Parse WhyDonate CSV file
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Array>} Parsed payout data
   */
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          // Map CSV columns to our data structure
          // Adjust column names based on actual WhyDonate CSV format
          results.push({
            whydonatePayoutId: data['Payout ID'] || data['payout_id'] || data['ID'],
            payoutDate: data['Date'] || data['date'] || data['Payout Date'],
            donorName: data['Donor Name'] || data['donor_name'] || data['Name'],
            donorEmail: data['Email'] || data['email'] || data['Donor Email'],
            donorPhone: data['Phone'] || data['phone'] || data['Donor Phone'],
            amount: parseFloat(data['Amount'] || data['amount'] || data['Donation Amount'] || 0),
            currency: (data['Currency'] || data['currency'] || 'EUR').toUpperCase(),
            fee: parseFloat(data['Fee'] || data['fee'] || 0),
            netAmount: parseFloat(data['Net Amount'] || data['net_amount'] || data['Amount'] || 0),
            campaignReference: data['Campaign'] || data['campaign'] || data['Campaign Reference'],
            status: data['Status'] || data['status'] || 'completed',
            rawData: data
          });
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Match payout to existing campaign or create new one
   * @param {Object} payout - Payout data
   * @param {string} userId - User ID for campaign creation
   * @returns {Promise<string>} Campaign ID
   */
  async matchCampaign(payout, userId) {
    // Try to find existing campaign by reference
    if (payout.campaignReference) {
      const { Op } = require('sequelize');
      const existingCampaign = await models.Campaign.findOne({
        where: {
          campaignName: {
            [Op.iLike]: `%${payout.campaignReference}%`
          }
        }
      });

      if (existingCampaign) {
        return existingCampaign.campaignId;
      }
    }

    // Create new campaign if not found
    const campaign = await models.Campaign.create({
      campaignName: payout.campaignReference || `WhyDonate Campaign - ${payout.payoutDate}`,
      description: `Auto-created from WhyDonate import`,
      whatsappNumber: payout.donorPhone || '0000000000',
      sourceType: 'whydonate',
      status: 'active',
      createdBy: userId
    });

    return campaign.campaignId;
  }

  /**
   * Import payouts to database
   * @param {Array} payouts - Array of payout data
   * @param {string} userId - User ID performing import
   * @returns {Promise<Object>} Import results
   */
  async importPayouts(payouts, userId) {
    const imported = [];
    const errors = [];

    for (const payout of payouts) {
      try {
        // Check if already imported
        const existing = await models.WhyDonatePayout.findOne({
          where: {
            whydonatePayoutId: payout.whydonatePayoutId
          }
        });

        if (existing) {
          continue; // Skip already imported
        }

        // Match or create campaign
        const campaignId = await this.matchCampaign(payout, userId);

        // Create payout record
        const payoutRecord = await models.WhyDonatePayout.create({
          whydonatePayoutId: payout.whydonatePayoutId,
          payoutDate: new Date(payout.payoutDate),
          donorName: payout.donorName,
          donorEmail: payout.donorEmail,
          donorPhone: payout.donorPhone,
          amount: payout.amount,
          currency: payout.currency,
          fee: payout.fee,
          netAmount: payout.netAmount,
          campaignReference: payout.campaignReference,
          campaignId,
          status: payout.status,
          rawData: payout.rawData
        });

        imported.push(payoutRecord);
      } catch (error) {
        errors.push({
          payout: payout.whydonatePayoutId,
          error: error.message
        });
      }
    }

    return {
      imported: imported.length,
      errors: errors.length,
      details: {
        imported,
        errors
      }
    };
  }

  /**
   * Create donations from WhyDonate payouts
   * @param {Array} payoutIds - Array of payout IDs to process
   * @returns {Promise<Array>} Created donations
   */
  async createDonationsFromPayouts(payoutIds) {
    const { Op } = require('sequelize');
    const payouts = await models.WhyDonatePayout.findAll({
      where: {
        payoutId: {
          [Op.in]: payoutIds
        },
        processed: false
      }
    });

    const createdDonations = [];

    for (const payout of payouts) {
      try {
        // Convert to EUR if needed
        const conversion = await CurrencyConverter.convertToEur(
          payout.netAmount, // Use net amount from WhyDonate
          payout.currency
        );

        // Calculate fees (25% on the net amount)
        const fees = FeeCalculator.calculateFees(conversion.euroAmount);

        // Create donation
        const donation = await models.Donation.create({
          campaignId: payout.campaignId,
          sourceType: 'whydonate',
          sourceIdentifier: payout.whydonatePayoutId,
          donorName: payout.donorName,
          email: payout.donorEmail,
          whatsappNumber: payout.donorPhone,
          originalAmount: payout.netAmount,
          originalCurrency: payout.currency,
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
          donationDate: payout.payoutDate,
          status: 'pending'
        });

        // Mark payout as processed
        await payout.update({
          processed: true,
          processedAt: new Date()
        });

        createdDonations.push(donation);
      } catch (error) {
        console.error('Error creating donation from payout:', error);
      }
    }

    return createdDonations;
  }
}

module.exports = new WhyDonateService();
