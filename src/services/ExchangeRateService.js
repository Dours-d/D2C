const axios = require('axios');
const models = require('../database/models');

/**
 * Exchange Rate Service
 * Fetches exchange rates from Stripe API and manages rate storage
 */
class ExchangeRateService {
  constructor() {
    this.stripeApiKey = process.env.STRIPE_API_KEY;
    this.stripeApiUrl = process.env.STRIPE_API_URL || 'https://api.stripe.com/v1';
  }

  /**
   * Get exchange rate from Stripe API
   * @param {string} baseCurrency - Base currency code (e.g., 'EUR')
   * @param {string} targetCurrency - Target currency code (e.g., 'USD')
   * @returns {Promise<number>} Exchange rate
   */
  async getStripeRate(baseCurrency, targetCurrency) {
    if (!this.stripeApiKey) {
      throw new Error('Stripe API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.stripeApiUrl}/exchange_rates/${baseCurrency}`,
        {
          headers: {
            'Authorization': `Bearer ${this.stripeApiKey}`
          }
        }
      );

      const rates = response.data.rates;
      if (!rates || !rates[targetCurrency]) {
        throw new Error(`Exchange rate not found for ${baseCurrency} to ${targetCurrency}`);
      }

      return parseFloat(rates[targetCurrency]);
    } catch (error) {
      if (error.response) {
        throw new Error(`Stripe API error: ${error.response.data?.error?.message || error.message}`);
      }
      throw new Error(`Failed to fetch exchange rate: ${error.message}`);
    }
  }

  /**
   * Get or fetch exchange rate (checks database first, then Stripe)
   * @param {string} baseCurrency - Base currency code
   * @param {string} targetCurrency - Target currency code
   * @param {boolean} forceRefresh - Force refresh from Stripe
   * @returns {Promise<Object>} Exchange rate object
   */
  async getExchangeRate(baseCurrency, targetCurrency, forceRefresh = false) {
    // Check database for active rate
    if (!forceRefresh) {
      const existingRate = await models.ExchangeRate.findOne({
        where: {
          baseCurrency,
          targetCurrency,
          validTo: null
        },
        order: [['validFrom', 'DESC']]
      });

      if (existingRate) {
        return {
          rate: parseFloat(existingRate.rate),
          source: existingRate.source,
          validFrom: existingRate.validFrom,
          exchangeId: existingRate.exchangeId
        };
      }
    }

    // Fetch from Stripe
    const rate = await this.getStripeRate(baseCurrency, targetCurrency);

    // Store in database
    const exchangeRate = await models.ExchangeRate.create({
      baseCurrency,
      targetCurrency,
      rate,
      source: 'stripe',
      validFrom: new Date()
    });

    return {
      rate,
      source: 'stripe',
      validFrom: exchangeRate.validFrom,
      exchangeId: exchangeRate.exchangeId
    };
  }

  /**
   * Convert amount from one currency to another
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @param {boolean} forceRefresh - Force refresh rate
   * @returns {Promise<Object>} Conversion result
   */
  async convertCurrency(amount, fromCurrency, toCurrency, forceRefresh = false) {
    if (fromCurrency === toCurrency) {
      return {
        originalAmount: amount,
        convertedAmount: amount,
        rate: 1,
        fromCurrency,
        toCurrency
      };
    }

    const rateInfo = await this.getExchangeRate(fromCurrency, toCurrency, forceRefresh);
    const convertedAmount = amount * rateInfo.rate;

    return {
      originalAmount: amount,
      convertedAmount: this.roundDecimal(convertedAmount, 8),
      rate: rateInfo.rate,
      fromCurrency,
      toCurrency,
      source: rateInfo.source
    };
  }

  /**
   * Refresh all exchange rates from Stripe
   * @param {Array} currencyPairs - Array of {base, target} objects
   * @returns {Promise<Array>} Updated rates
   */
  async refreshRates(currencyPairs = [
    { base: 'EUR', target: 'USD' },
    { base: 'USD', target: 'EUR' },
    { base: 'EUR', target: 'USDT' },
    { base: 'USD', target: 'USDT' }
  ]) {
    const results = [];

    for (const pair of currencyPairs) {
      try {
        // Invalidate old rates
        await models.ExchangeRate.update(
          { validTo: new Date() },
          {
            where: {
              baseCurrency: pair.base,
              targetCurrency: pair.target,
              validTo: null
            }
          }
        );

        // Fetch new rate
        const rateInfo = await this.getExchangeRate(pair.base, pair.target, true);
        results.push({
          ...pair,
          rate: rateInfo.rate,
          success: true
        });
      } catch (error) {
        results.push({
          ...pair,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * Get rate history
   * @param {string} baseCurrency - Base currency
   * @param {string} targetCurrency - Target currency
   * @param {number} limit - Number of records to return
   * @returns {Promise<Array>} Rate history
   */
  async getRateHistory(baseCurrency, targetCurrency, limit = 30) {
    return await models.ExchangeRate.findAll({
      where: {
        baseCurrency,
        targetCurrency
      },
      order: [['validFrom', 'DESC']],
      limit
    });
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

module.exports = new ExchangeRateService();
