/**
 * Fee Calculator Service
 * Calculates 25% fee breakdown: 10% debt, 10% operational, 5% transaction
 */
class FeeCalculator {
  /**
   * Calculate fees for a donation amount
   * @param {number} amount - Amount in EUR
   * @param {number} debtPercent - Debt fee percentage (default: 10)
   * @param {number} operationalPercent - Operational fee percentage (default: 10)
   * @param {number} transactionPercent - Transaction fee percentage (default: 5)
   * @returns {Object} Fee breakdown object
   */
  calculateFees(amount, debtPercent = 10, operationalPercent = 10, transactionPercent = 5) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const totalFeePercent = debtPercent + operationalPercent + transactionPercent;
    
    const debtFeeAmount = this.roundDecimal((amount * debtPercent) / 100, 8);
    const operationalFeeAmount = this.roundDecimal((amount * operationalPercent) / 100, 8);
    const transactionFeeAmount = this.roundDecimal((amount * transactionPercent) / 100, 8);
    const totalFeeAmount = debtFeeAmount + operationalFeeAmount + transactionFeeAmount;
    const netAmount = this.roundDecimal(amount - totalFeeAmount, 8);

    return {
      grossAmount: amount,
      totalFeePercent,
      debtFeePercent: debtPercent,
      operationalFeePercent: operationalPercent,
      transactionFeePercent: transactionPercent,
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

    donations.forEach(donation => {
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

  /**
   * Validate fee percentages
   * @param {number} debtPercent - Debt fee percentage
   * @param {number} operationalPercent - Operational fee percentage
   * @param {number} transactionPercent - Transaction fee percentage
   * @returns {boolean} True if valid
   */
  validateFeePercentages(debtPercent, operationalPercent, transactionPercent) {
    const total = debtPercent + operationalPercent + transactionPercent;
    return total >= 0 && total <= 100;
  }
}

module.exports = new FeeCalculator();
