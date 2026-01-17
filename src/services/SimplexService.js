const axios = require('axios');
const crypto = require('crypto');
const models = require('../database/models');

/**
 * Simplex USDT Purchase Service
 */
class SimplexService {
  constructor() {
    this.apiUrl = process.env.SIMPLEX_API_URL || 'https://sandbox.test-simplex.com';
    this.apiKey = process.env.SIMPLEX_API_KEY;
    this.appId = process.env.SIMPLEX_APP_PROVIDER_ID || process.env.SIMPLEX_APP_ID;
  }

  /**
   * Generate signature for Simplex API request
   * @param {Object} data - Request data
   * @returns {string} Signature
   */
  generateSignature(data) {
    const message = JSON.stringify(data);
    return crypto
      .createHmac('sha256', this.apiKey)
      .update(message)
      .digest('hex');
  }

  /**
   * Initiate Simplex payment request
   * @param {string} batchId - Batch ID
   * @param {Object} userData - User data for Simplex
   * @returns {Promise<Object>} Simplex payment response
   */
  async initiatePayment(batchId, userData) {
    if (!this.apiKey || !this.appId) {
      throw new Error('Simplex API credentials not configured');
    }

    const batch = await models.TransactionBatch.findByPk(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'processing') {
      throw new Error(`Batch status must be 'processing', current: ${batch.status}`);
    }

    if (!batch.targetUsdtAmount) {
      throw new Error('Batch must be processed first to calculate USDT amount');
    }

    try {
      const requestData = {
        account_details: {
          app_provider_id: this.appId,
          app_end_user_id: userData.userId || userData.email,
          app_install_id: batchId
        },
        transaction_details: {
          payment_details: {
            quote_id: `BATCH-${batch.batchId}`,
            fiat_total_amount: {
              amount: batch.totalNetEur.toString(),
              currency: 'EUR'
            },
            requested_digital_amount: {
              amount: batch.targetUsdtAmount.toString(),
              currency: 'USDT'
            },
            destination_wallet: batch.targetWallet,
            network: batch.network
          }
        },
        user_details: {
          first_name: userData.firstName || 'Admin',
          last_name: userData.lastName || 'User',
          email: userData.email,
          date_of_birth: userData.dateOfBirth,
          phone: userData.phone
        }
      };

      const signature = this.generateSignature(requestData);

      const response = await axios.post(
        `${this.apiUrl}/payments/partner/initiate`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Signature': signature,
            'Content-Type': 'application/json'
          }
        }
      );

      // Update batch with Simplex transaction info
      const metadata = batch.metadata || {};
      metadata.simplexRequestId = response.data.payment_id;
      metadata.simplexQuoteId = response.data.quote_id;
      
      await batch.update({
        status: 'awaiting_simplex',
        simplexProcessingAt: new Date(),
        metadata
      });

      return {
        paymentUrl: response.data.payment_url,
        paymentId: response.data.payment_id,
        quoteId: response.data.quote_id
      };
    } catch (error) {
      console.error('Simplex payment initiation error:', error);
      if (error.response) {
        throw new Error(`Simplex API error: ${error.response.data?.error?.message || error.message}`);
      }
      throw new Error(`Failed to initiate Simplex payment: ${error.message}`);
    }
  }

  /**
   * Handle Simplex callback/webhook
   * @param {Object} callbackData - Callback data from Simplex
   * @returns {Promise<Object>} Updated batch
   */
  async handleCallback(callbackData) {
    const { payment_id, quote_id, status } = callbackData;

    const { Op } = require('sequelize');
    // Find batch by quote ID
    const batches = await models.TransactionBatch.findAll({
      where: {
        [Op.and]: [
          models.sequelize.where(
            models.sequelize.json('metadata.simplexQuoteId'),
            quote_id
          )
        ]
      }
    });

    if (batches.length === 0) {
      throw new Error(`Batch not found for quote ID: ${quote_id}`);
    }

    const batch = batches[0];

    const metadata = batch.metadata || {};
    
    if (status === 'success' || status === 'completed') {
      metadata.simplexPaymentId = payment_id;
      metadata.simplexStatus = status;
      metadata.simplexCallback = callbackData;
      
      await batch.update({
        status: 'sending',
        metadata
      });

      return batch;
    } else if (status === 'failed' || status === 'rejected') {
      metadata.simplexPaymentId = payment_id;
      metadata.simplexStatus = status;
      metadata.simplexError = callbackData.error || 'Payment failed';
      
      await batch.update({
        status: 'failed',
        metadata
      });

      throw new Error(`Simplex payment failed: ${callbackData.error || 'Unknown error'}`);
    }

    return batch;
  }

  /**
   * Check Simplex payment status
   * @param {string} paymentId - Simplex payment ID
   * @returns {Promise<Object>} Payment status
   */
  async checkPaymentStatus(paymentId) {
    if (!this.apiKey) {
      throw new Error('Simplex API credentials not configured');
    }

    try {
      const response = await axios.get(
        `${this.apiUrl}/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Simplex status check error:', error);
      throw new Error(`Failed to check payment status: ${error.message}`);
    }
  }
}

module.exports = new SimplexService();
