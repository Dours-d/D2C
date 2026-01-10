const axios = require('axios');
const models = require('../database/models');

/**
 * WhatsApp Business API Service
 * Supports SID and Secret Key authentication (e.g., Twilio)
 */
class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://api.twilio.com/2010-04-01';
    this.accountSid = process.env.WHATSAPP_ACCOUNT_SID;
    this.authToken = process.env.WHATSAPP_AUTH_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    
    // Legacy support for access token (Facebook/Meta API)
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  }

  /**
   * Get authentication header based on available credentials
   * @returns {Object} Headers object with authentication
   */
  getAuthHeaders() {
    // Prefer SID/Secret Key authentication (Twilio)
    if (this.accountSid && this.authToken) {
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      return {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      };
    }
    
    // Fallback to access token (Facebook/Meta API)
    if (this.accessToken) {
      return {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      };
    }
    
    throw new Error('WhatsApp API credentials not configured. Provide either SID/AuthToken or AccessToken.');
  }

  /**
   * Extract TRON wallet address from message
   * @param {string} message - Message text
   * @returns {string|null} Wallet address or null
   */
  extractWalletAddress(message) {
    // TRON address pattern: T followed by 33 alphanumeric characters
    const pattern = /T[A-Za-z1-9]{33}/;
    const match = message.match(pattern);
    return match ? match[0] : null;
  }

  /**
   * Extract donation amount and currency from message
   * @param {string} message - Message text
   * @returns {Object|null} {amount, currency} or null
   */
  extractAmount(message) {
    // Patterns: "100 EUR", "€100", "$50", "50 USD", "100 USDT"
    const patterns = [
      /(\d+\.?\d*)\s*(EUR|USD|USDT|€|\$)/i,
      /(€|\$)(\d+\.?\d*)/i,
      /(\d+\.?\d*)\s*(euro|dollar|usdt)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const amount = parseFloat(match[1] || match[2]);
        let currency = (match[2] || match[1]).toUpperCase();
        
        if (currency === '€') currency = 'EUR';
        if (currency === '$') currency = 'USD';
        
        return { amount, currency };
      }
    }

    return null;
  }

  /**
   * Extract campaign link from message
   * @param {string} message - Message text
   * @returns {string|null} Campaign link or null
   */
  extractCampaignLink(message) {
    // Look for URLs
    const urlPattern = /(https?:\/\/[^\s]+)/;
    const match = message.match(urlPattern);
    return match ? match[0] : null;
  }

  /**
   * Scan WhatsApp messages for a phone number
   * @param {string} whatsappNumber - WhatsApp number to scan
   * @param {Object} dateRange - {startDate, endDate}
   * @returns {Promise<Array>} Array of messages
   */
  async scanChats(whatsappNumber, dateRange = {}) {
    try {
      const headers = this.getAuthHeaders();
      
      // For Twilio: Fetch messages from a specific number
      if (this.accountSid && this.authToken) {
        const url = `${this.apiUrl}/Accounts/${this.accountSid}/Messages.json`;
        const params = new URLSearchParams({
          'To': `whatsapp:${whatsappNumber}`,
          'PageSize': '100'
        });

        if (dateRange.startDate) {
          params.append('DateSent>=', dateRange.startDate);
        }
        if (dateRange.endDate) {
          params.append('DateSent<=', dateRange.endDate);
        }

        const response = await axios.get(`${url}?${params.toString()}`, { headers });
        
        return response.data.messages.map(msg => ({
          id: msg.sid,
          from: msg.from.replace('whatsapp:', ''),
          to: msg.to.replace('whatsapp:', ''),
          text: msg.body,
          timestamp: new Date(msg.dateSent).getTime() / 1000,
          direction: msg.direction,
          status: msg.status
        }));
      }

      // For Facebook/Meta API: Use webhook-based approach
      // Messages should be stored via webhooks, query from database
      const { Op } = require('sequelize');
      const models = require('../database/models');
      
      const where = {
        whatsappNumber: whatsappNumber
      };

      if (dateRange.startDate) {
        where.messageTimestamp = { [Op.gte]: new Date(dateRange.startDate) };
      }
      if (dateRange.endDate) {
        where.messageTimestamp = { 
          ...where.messageTimestamp,
          [Op.lte]: new Date(dateRange.endDate) 
        };
      }

      const storedMessages = await models.WhatsAppChat.findAll({
        where,
        order: [['messageTimestamp', 'DESC']],
        limit: 100
      });

      return storedMessages.map(msg => ({
        id: msg.messageId,
        from: msg.senderNumber,
        to: msg.whatsappNumber,
        text: msg.messageText,
        timestamp: new Date(msg.messageTimestamp).getTime() / 1000
      }));
    } catch (error) {
      console.error('WhatsApp scan error:', error);
      throw new Error(`Failed to scan WhatsApp chats: ${error.message}`);
    }
  }

  /**
   * Send WhatsApp message (for Twilio API)
   * @param {string} to - Recipient WhatsApp number
   * @param {string} message - Message text
   * @param {string} from - Sender WhatsApp number (optional, uses phoneNumberId if not provided)
   * @returns {Promise<Object>} Sent message response
   */
  async sendMessage(to, message, from = null) {
    try {
      const headers = this.getAuthHeaders();
      const fromNumber = from || this.phoneNumberId || `whatsapp:${process.env.WHATSAPP_FROM_NUMBER}`;

      if (this.accountSid && this.authToken) {
        // Twilio API
        const url = `${this.apiUrl}/Accounts/${this.accountSid}/Messages.json`;
        const params = new URLSearchParams({
          'From': fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
          'To': to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
          'Body': message
        });

        const response = await axios.post(url, params.toString(), { headers });
        return response.data;
      } else if (this.accessToken) {
        // Facebook/Meta API
        const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
        const response = await axios.post(url, {
          messaging_product: 'whatsapp',
          to: to.replace('whatsapp:', ''),
          type: 'text',
          text: { body: message }
        }, { headers });
        return response.data;
      }
    } catch (error) {
      console.error('WhatsApp send message error:', error);
      throw new Error(`Failed to send WhatsApp message: ${error.message}`);
    }
  }

  /**
   * Process WhatsApp chat messages and extract donations
   * @param {Array} chatIds - Array of chat IDs to process
   * @returns {Promise<Array>} Array of extracted donation data
   */
  async extractDonations(chatIds) {
    const { Op } = require('sequelize');
    const chats = await models.WhatsAppChat.findAll({
      where: {
        chatId: {
          [Op.in]: chatIds
        },
        processingStatus: 'pending'
      }
    });

    const donations = [];

    for (const chat of chats) {
      try {
        const walletAddress = this.extractWalletAddress(chat.messageText);
        const amountData = this.extractAmount(chat.messageText);
        const campaignLink = this.extractCampaignLink(chat.messageText);

        if (walletAddress && amountData) {
          // Update chat with extracted data
          await chat.update({
            extractedWalletAddress: walletAddress,
            extractedAmount: amountData.amount,
            extractedCurrency: amountData.currency,
            extractedCampaignLink: campaignLink,
            processingStatus: 'processed',
            processedAt: new Date()
          });

          donations.push({
            chatId: chat.chatId,
            whatsappNumber: chat.senderNumber,
            donorName: null, // Could be extracted from contact info
            walletAddress,
            amount: amountData.amount,
            currency: amountData.currency,
            campaignLink,
            messageText: chat.messageText,
            messageTimestamp: chat.messageTimestamp
          });
        } else {
          await chat.update({
            processingStatus: 'ignored',
            processingResult: 'No wallet address or amount found'
          });
        }
      } catch (error) {
        await chat.update({
          processingStatus: 'failed',
          processingResult: error.message
        });
      }
    }

    return donations;
  }

  /**
   * Create donations from processed WhatsApp chats
   * @param {Array} donationData - Array of donation data from extractDonations
   * @param {string} campaignId - Campaign ID to associate with
   * @returns {Promise<Array>} Created donations
   */
  async createDonationsFromChats(donationData, campaignId) {
    const CurrencyConverter = require('./CurrencyConverter');
    const FeeCalculator = require('./FeeCalculator');
    const createdDonations = [];

    for (const data of donationData) {
      try {
        // Convert to EUR
        const conversion = await CurrencyConverter.convertToEur(data.amount, data.currency);

        // Calculate fees
        const fees = FeeCalculator.calculateFees(conversion.euroAmount);

        // Find or create campaign if needed
        let targetCampaignId = campaignId;
        if (!targetCampaignId && data.campaignLink) {
          // Try to match existing campaign or create new one
          // This is simplified - in production, you'd have better campaign matching
          const existingCampaign = await models.Campaign.findOne({
            where: {
              whatsappNumber: data.whatsappNumber
            }
          });

          if (existingCampaign) {
            targetCampaignId = existingCampaign.campaignId;
          }
        }

        if (!targetCampaignId) {
          throw new Error('Campaign ID required');
        }

        // Create donation
        const donation = await models.Donation.create({
          campaignId: targetCampaignId,
          sourceType: 'whatsapp',
          sourceIdentifier: data.chatId,
          whatsappNumber: data.whatsappNumber,
          donorName: data.donorName,
          originalAmount: data.amount,
          originalCurrency: data.currency,
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
          donationDate: data.messageTimestamp || new Date(),
          status: 'pending'
        });

        createdDonations.push(donation);
      } catch (error) {
        console.error('Error creating donation from chat:', error);
      }
    }

    return createdDonations;
  }

  /**
   * Store WhatsApp message in database
   * @param {Object} messageData - Message data from webhook
   * @returns {Promise<Object>} Stored chat record
   */
  async storeMessage(messageData) {
    const {
      whatsappNumber,
      messageId,
      senderNumber,
      messageText,
      timestamp
    } = messageData;

    const [chat, created] = await models.WhatsAppChat.findOrCreate({
      where: {
        whatsappNumber,
        messageId
      },
      defaults: {
        senderNumber,
        messageText,
        messageTimestamp: timestamp ? new Date(timestamp * 1000) : new Date(),
        processingStatus: 'pending'
      }
    });

    return chat;
  }
}

module.exports = new WhatsAppService();
