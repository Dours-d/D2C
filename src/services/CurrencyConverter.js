const ExchangeRateService = require('./ExchangeRateService');

/**
 * Currency Converter Service
 * Utility service for currency conversion operations
 */
class CurrencyConverter {
  /**
   * Convert amount to EUR
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency code
   * @returns {Promise<Object>} Conversion result with EUR amount and rate
   */
  async convertToEur(amount, fromCurrency) {
    if (fromCurrency === 'EUR') {
      return {
        euroAmount: amount,
        conversionRate: 1,
        originalAmount: amount,
        originalCurrency: fromCurrency
      };
    }

    const result = await ExchangeRateService.convertCurrency(amount, fromCurrency, 'EUR');
    
    return {
      euroAmount: result.convertedAmount,
      conversionRate: result.rate,
      originalAmount: amount,
      originalCurrency: fromCurrency
    };
  }

  /**
   * Convert EUR to target currency
   * @param {number} eurAmount - Amount in EUR
   * @param {string} toCurrency - Target currency code
   * @returns {Promise<Object>} Conversion result
   */
  async convertFromEur(eurAmount, toCurrency) {
    if (toCurrency === 'EUR') {
      return {
        amount: eurAmount,
        rate: 1,
        currency: toCurrency
      };
    }

    const result = await ExchangeRateService.convertCurrency(eurAmount, 'EUR', toCurrency);
    
    return {
      amount: result.convertedAmount,
      rate: result.rate,
      currency: toCurrency
    };
  }

  /**
   * Format currency amount
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted amount
   */
  formatAmount(amount, currency = 'EUR', decimals = 2) {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return formatter.format(amount);
  }

  /**
   * Validate currency code
   * @param {string} currencyCode - Currency code to validate
   * @returns {boolean} True if valid
   */
  isValidCurrencyCode(currencyCode) {
    return /^[A-Z]{3}$/.test(currencyCode);
  }
}

module.exports = new CurrencyConverter();
