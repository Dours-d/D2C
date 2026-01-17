/**
 * WhatsApp Query Service
 * Integrates with whatsapp-chat-exporter module to query and parse WhatsApp chats
 */

const path = require('path');
const WhatsAppChatExporter = require('../../whatsapp-chat-exporter');
const WhatsAppService = require('./WhatsAppService');
const logger = require('../utils/logger');
const models = require('../database/models');

class WhatsAppQueryService {
  constructor() {
    this.exporter = WhatsAppChatExporter;
    this.parser = new WhatsAppChatExporter.WhatsAppChatParser();
    this.queryService = new WhatsAppChatExporter.WhatsAppQueryService();
  }
  
  /**
   * Export WhatsApp chats using Python exporter
   * @param {Object} options - Export options
   * @returns {Promise<string>} Output directory path
   */
  async exportChats(options = {}) {
    try {
      const outputDir = await this.exporter.exportChats({
        sourcePath: options.sourcePath,
        outputDir: options.outputDir || './whatsapp-export',
        format: options.format || 'json',
        platform: options.platform || 'android',
        keyFile: options.keyFile,
        mediaDir: options.mediaDir
      });
      
      logger.info(`WhatsApp chats exported to: ${outputDir}`);
      return outputDir;
    } catch (error) {
      logger.error('Failed to export WhatsApp chats:', error);
      throw error;
    }
  }
  
  /**
   * Parse exported chat file (.txt format)
   * @param {string} filePath - Path to exported chat file
   * @param {string} phoneNumber - Optional phone number to filter
   * @returns {Promise<Array>} Parsed messages
   */
  async parseExportedFile(filePath, phoneNumber = null) {
    try {
      if (phoneNumber) {
        return await this.parser.parseForNumber(filePath, phoneNumber);
      }
      return await this.parser.parseExportedFile(filePath);
    } catch (error) {
      logger.error(`Failed to parse exported file ${filePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Query messages from exported JSON
   * @param {string} jsonPath - Path to exported JSON file
   * @param {Object} query - Query options
   * @returns {Promise<Array>} Filtered messages
   */
  async queryMessages(jsonPath, query = {}) {
    try {
      return await this.queryService.query(jsonPath, query);
    } catch (error) {
      logger.error(`Failed to query messages from ${jsonPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Extract donations from exported chat file
   * @param {string} filePath - Path to exported chat file
   * @param {Object} options - Options
   * @returns {Promise<Array>} Extracted donations
   */
  async extractDonationsFromFile(filePath, options = {}) {
    try {
      // Parse the exported file
      const messages = await this.parseExportedFile(filePath, options.phoneNumber);
      
      // Extract donations using query service
      const donations = this.queryService.extractDonations(messages);
      
      // Store in database if requested
      if (options.storeInDatabase) {
        await this.storeDonations(donations, options.campaignId);
      }
      
      return donations;
    } catch (error) {
      logger.error(`Failed to extract donations from ${filePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Extract donations from exported JSON
   * @param {string} jsonPath - Path to exported JSON file
   * @param {Object} query - Query options
   * @returns {Promise<Array>} Extracted donations
   */
  async extractDonationsFromJson(jsonPath, query = {}) {
    try {
      // Query messages
      const messages = await this.queryMessages(jsonPath, query);
      
      // Extract donations
      const donations = this.queryService.extractDonations(messages);
      
      return donations;
    } catch (error) {
      logger.error(`Failed to extract donations from ${jsonPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Store extracted donations in database
   * @param {Array} donations - Array of donation data
   * @param {string} campaignId - Campaign ID to associate with
   * @returns {Promise<Array>} Created donation records
   */
  async storeDonations(donations, campaignId) {
    const CurrencyConverter = require('./CurrencyConverter');
    const FeeCalculator = require('./FeeCalculator');
    const createdDonations = [];
    
    for (const data of donations) {
      try {
        // Convert to EUR
        const conversion = await CurrencyConverter.convertToEur(data.amount, data.currency);
        
        // Calculate fees
        const fees = FeeCalculator.calculateFees(conversion.euroAmount);
        
        // Find or create campaign if needed
        let targetCampaignId = campaignId;
        if (!targetCampaignId) {
          // Try to find existing campaign by wallet address
          const existingCampaign = await models.Campaign.findOne({
            where: {
              walletAddress: data.walletAddress
            }
          });
          
          if (existingCampaign) {
            targetCampaignId = existingCampaign.campaignId;
          }
        }
        
        if (!targetCampaignId) {
          logger.warn(`No campaign ID found for donation from ${data.senderName}, skipping`);
          continue;
        }
        
        // Create donation
        const donation = await models.Donation.create({
          campaignId: targetCampaignId,
          sourceType: 'whatsapp',
          sourceIdentifier: data.messageId,
          whatsappNumber: data.senderPhone,
          donorName: data.senderName,
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
          donationDate: data.timestamp || new Date(),
          status: 'pending'
        });
        
        createdDonations.push(donation);
      } catch (error) {
        logger.error(`Error storing donation from ${data.senderName}:`, error);
      }
    }
    
    return createdDonations;
  }
  
  /**
   * Process WhatsApp database file (msgstore.db)
   * @param {string} dbPath - Path to msgstore.db
   * @param {Object} options - Options
   * @returns {Promise<Object>} Export result
   */
  async processDatabase(dbPath, options = {}) {
    try {
      // Export using Python exporter
      const outputDir = await this.exportChats({
        sourcePath: dbPath,
        platform: options.platform || 'android',
        keyFile: options.keyFile,
        mediaDir: options.mediaDir,
        format: 'json',
        outputDir: options.outputDir || './whatsapp-export'
      });
      
      // Query and extract donations
      const jsonPath = path.join(outputDir, 'result.json');
      const donations = await this.extractDonationsFromJson(jsonPath, {
        phoneNumber: options.phoneNumber,
        startDate: options.startDate,
        endDate: options.endDate
      });
      
      // Store in database if requested
      let createdDonations = [];
      if (options.storeInDatabase) {
        createdDonations = await this.storeDonations(donations, options.campaignId);
      }
      
      return {
        outputDir,
        jsonPath,
        donationsFound: donations.length,
        donationsStored: createdDonations.length,
        donations
      };
    } catch (error) {
      logger.error(`Failed to process WhatsApp database ${dbPath}:`, error);
      throw error;
    }
  }
}

module.exports = new WhatsAppQueryService();
