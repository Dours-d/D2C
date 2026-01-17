const logger = require('../utils/logger');

/**
 * Fee Calculator Service
 * Calculates 25% fee breakdown: 10% debt, 10% operational, 5% transaction
 */
class FeeCalculator {
  constructor() {
    this.feeStructure = {
      total: 0.25,
      debt: 0.1,
      operational: 0.1,
      transaction: 0.05
    };
  }

  /**
   * Calculate fees for a donation amount
   * @param {number} amount - Amount in EUR
   * @returns {Object} Fee breakdown object
   */
  calculateFees(amount) {
    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const debtFeeAmount = this.roundDecimal(amount * this.feeStructure.debt, 8);
    const operationalFeeAmount = this.roundDecimal(amount * this.feeStructure.operational, 8);
    const transactionFeeAmount = this.roundDecimal(amount * this.feeStructure.transaction, 8);
    const totalFeeAmount = this.roundDecimal(
      debtFeeAmount + operationalFeeAmount + transactionFeeAmount,
      8
    );
    const netAmount = this.roundDecimal(amount - totalFeeAmount, 8);

    logger.debug('Calculated fees', {
      amount,
      totalFeeAmount,
      netAmount
    });

    return {
      grossAmount: amount,
      totalFeePercent: this.feeStructure.total * 100,
      debtFeePercent: this.feeStructure.debt * 100,
      operationalFeePercent: this.feeStructure.operational * 100,
      transactionFeePercent: this.feeStructure.transaction * 100,
      debtFeeAmount,
      operationalFeeAmount,
      transactionFeeAmount,
      totalFeeAmount,
      netAmount
    };
  }

  /**
   * Calculate fees for multiple donations (batch)
   * @param {Array} donations - Array of donation objects with euroAmount and fee fields
   * @returns {Object} Aggregated fee breakdown
   */
  calculateBatchFees(donations) {
    if (!Array.isArray(donations) || donations.length === 0) {
      throw new Error('Donations array is required and must not be empty');
    }

    let totalGross = 0;
    let totalDebtFee = 0;
    let totalOperationalFee = 0;
    let totalTransactionFee = 0;
    let totalNet = 0;

    donations.forEach((donation) => {
      const euroAmount = parseFloat(donation.euroAmount || donation.euro_amount || 0);
      totalGross += euroAmount;
      totalDebtFee += parseFloat(donation.debtFeeAmount || donation.debt_fee_amount || 0);
      totalOperationalFee += parseFloat(donation.operationalFeeAmount || donation.operational_fee_amount || 0);
      totalTransactionFee += parseFloat(donation.transactionFeeAmount || donation.transaction_fee_amount || 0);
      totalNet += parseFloat(donation.netAmountEur || donation.net_amount_eur || 0);
    });

    return {
      totalGrossEur: this.roundDecimal(totalGross, 8),
      totalDebtFeeEur: this.roundDecimal(totalDebtFee, 8),
      totalOperationalFeeEur: this.roundDecimal(totalOperationalFee, 8),
      totalTransactionFeeEur: this.roundDecimal(totalTransactionFee, 8),
      totalFeeEur: this.roundDecimal(totalDebtFee + totalOperationalFee + totalTransactionFee, 8),
      totalNetEur: this.roundDecimal(totalNet, 8),
      donationCount: donations.length
    };
  }

  /**
   * Round decimal to specified precision
   * @param {number} value - Value to round
   * @param {number} decimals - Number of decimal places
   * @returns {number} Rounded value
   */
  roundDecimal(value, decimals = 8) {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}

module.exports = new FeeCalculator();
