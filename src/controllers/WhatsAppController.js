const models = require('../database/models');
const WhatsAppService = require('../services/WhatsAppService');
const WhatsAppQueryService = require('../services/WhatsAppQueryService');

/**
 * WhatsApp Controller
 */
class WhatsAppController {
  /**
   * Trigger WhatsApp scan
   * POST /api/whatsapp/scan
   */
  async scan(req, res) {
    try {
      const { whatsappNumber, dateRange } = req.body;

      if (!whatsappNumber) {
        return res.status(400).json({ error: 'WhatsApp number is required' });
      }

      // Create scan job
      const scanJob = await models.WhatsAppScanJob.create({
        whatsappNumber,
        initiatedBy: req.user.userId,
        status: 'pending'
      });

      // TODO: Add to background job queue
      // For now, return immediately
      res.json({
        success: true,
        scanId: scanJob.scanId,
        message: 'Scan job created. Processing will start shortly.'
      });
    } catch (error) {
      console.error('WhatsApp scan error:', error);
      res.status(500).json({ error: 'Failed to start WhatsApp scan' });
    }
  }

  /**
   * List scan jobs
   * GET /api/whatsapp/scans
   */
  async listScans(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows } = await models.WhatsAppScanJob.findAndCountAll({
        include: [
          {
            model: models.User,
            as: 'initiator',
            attributes: ['userId', 'username']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        scans: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('List scans error:', error);
      res.status(500).json({ error: 'Failed to list scan jobs' });
    }
  }

  /**
   * Get scan details
   * GET /api/whatsapp/scans/:id
   */
  async getScan(req, res) {
    try {
      const { id } = req.params;

      const scan = await models.WhatsAppScanJob.findByPk(id, {
        include: [
          {
            model: models.User,
            as: 'initiator',
            attributes: ['userId', 'username', 'email']
          }
        ]
      });

      if (!scan) {
        return res.status(404).json({ error: 'Scan job not found' });
      }

      res.json({
        success: true,
        scan
      });
    } catch (error) {
      console.error('Get scan error:', error);
      res.status(500).json({ error: 'Failed to get scan details' });
    }
  }

  /**
   * List scanned chats
   * GET /api/whatsapp/chats
   */
  async listChats(req, res) {
    try {
      const { whatsappNumber, processingStatus, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (whatsappNumber) where.whatsappNumber = whatsappNumber;
      if (processingStatus) where.processingStatus = processingStatus;

      const { count, rows } = await models.WhatsAppChat.findAndCountAll({
        where,
        order: [['messageTimestamp', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        chats: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('List chats error:', error);
      res.status(500).json({ error: 'Failed to list chats' });
    }
  }

  /**
   * Process specific chat
   * POST /api/whatsapp/chats/:id/process
   */
  async processChat(req, res) {
    try {
      const { id } = req.params;
      const { campaignId } = req.body;

      const chat = await models.WhatsAppChat.findByPk(id);

      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      // Extract donations
      const donations = await WhatsAppService.extractDonations([id]);

      if (donations.length === 0) {
        return res.json({
          success: true,
          message: 'No donations extracted from chat',
          donations: []
        });
      }

      // Create donations
      const createdDonations = await WhatsAppService.createDonationsFromChats(
        donations,
        campaignId
      );

      res.json({
        success: true,
        donations: createdDonations,
        count: createdDonations.length
      });
    } catch (error) {
      console.error('Process chat error:', error);
      res.status(500).json({ error: 'Failed to process chat' });
    }
  }

  /**
   * List tracked WhatsApp numbers
   * GET /api/whatsapp/numbers
   */
  async listNumbers(req, res) {
    try {
      const numbers = await models.WhatsAppChat.findAll({
        attributes: [
          [models.sequelize.fn('DISTINCT', models.sequelize.col('whatsapp_number')), 'whatsappNumber']
        ],
        raw: true
      });

      res.json({
        success: true,
        numbers: numbers.map(n => n.whatsappNumber)
      });
    } catch (error) {
      console.error('List numbers error:', error);
      res.status(500).json({ error: 'Failed to list WhatsApp numbers' });
    }
  }

  /**
   * Webhook for receiving WhatsApp messages
   * POST /api/whatsapp/webhook
   */
  async webhook(req, res) {
    try {
      // Handle Twilio webhook format
      if (req.body.AccountSid) {
        const message = req.body;
        const from = message.From?.replace('whatsapp:', '') || message.From;
        const to = message.To?.replace('whatsapp:', '') || message.To;
        
        await WhatsAppService.storeMessage({
          whatsappNumber: to,
          messageId: message.MessageSid || message.Sid,
          senderNumber: from,
          messageText: message.Body || message.MessageBody || '',
          timestamp: message.DateSent ? new Date(message.DateSent).getTime() / 1000 : Date.now() / 1000
        });

        // Respond to Twilio
        res.type('text/xml');
        return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }

      // Handle Facebook/Meta webhook format
      if (req.body.object === 'whatsapp_business_account') {
        const entries = req.body.entry || [];
        
        for (const entry of entries) {
          const changes = entry.changes || [];
          for (const change of changes) {
            if (change.field === 'messages') {
              const value = change.value;
              const messages = value.messages || [];
              
              for (const message of messages) {
                const from = message.from;
                const to = value.metadata?.phone_number_id || value.metadata?.display_phone_number;
                
                await WhatsAppService.storeMessage({
                  whatsappNumber: to,
                  messageId: message.id,
                  senderNumber: from,
                  messageText: message.text?.body || message.type || '',
                  timestamp: message.timestamp ? parseInt(message.timestamp) : Date.now() / 1000
                });
              }
            }
          }
        }

        // Respond to Facebook/Meta
        return res.status(200).json({ status: 'success' });
      }

      // Unknown format
      res.status(400).json({ error: 'Unknown webhook format' });
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  }

  /**
   * Send WhatsApp message
   * POST /api/whatsapp/send
   */
  async sendMessage(req, res) {
    try {
      const { to, message, from } = req.body;

      if (!to || !message) {
        return res.status(400).json({ error: 'Recipient and message are required' });
      }

      const result = await WhatsAppService.sendMessage(to, message, from);

      res.json({
        success: true,
        messageId: result.sid || result.messages?.[0]?.id,
        result
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: `Failed to send message: ${error.message}` });
    }
  }

  /**
   * Parse exported WhatsApp chat file
   * POST /api/whatsapp/parse-exported
   */
  async parseExported(req, res) {
    try {
      const { filePath, phoneNumber } = req.body;

      if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
      }

      const messages = await WhatsAppQueryService.parseExportedFile(filePath, phoneNumber);

      res.json({
        success: true,
        messages,
        count: messages.length
      });
    } catch (error) {
      console.error('Parse exported file error:', error);
      res.status(500).json({ error: `Failed to parse file: ${error.message}` });
    }
  }

  /**
   * Query messages from exported JSON
   * POST /api/whatsapp/query
   */
  async queryMessages(req, res) {
    try {
      const { jsonPath, query = {} } = req.body;

      if (!jsonPath) {
        return res.status(400).json({ error: 'JSON path is required' });
      }

      const messages = await WhatsAppQueryService.queryMessages(jsonPath, query);

      res.json({
        success: true,
        messages,
        count: messages.length
      });
    } catch (error) {
      console.error('Query messages error:', error);
      res.status(500).json({ error: `Failed to query messages: ${error.message}` });
    }
  }

  /**
   * Extract donations from exported file
   * POST /api/whatsapp/extract-donations-file
   */
  async extractDonationsFromFile(req, res) {
    try {
      const { filePath, phoneNumber, storeInDatabase, campaignId } = req.body;

      if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
      }

      const donations = await WhatsAppQueryService.extractDonationsFromFile(filePath, {
        phoneNumber,
        storeInDatabase: storeInDatabase === true,
        campaignId
      });

      res.json({
        success: true,
        donations,
        count: donations.length,
        storedInDatabase: storeInDatabase === true
      });
    } catch (error) {
      console.error('Extract donations from file error:', error);
      res.status(500).json({ error: `Failed to extract donations: ${error.message}` });
    }
  }

  /**
   * Process WhatsApp database file
   * POST /api/whatsapp/process-database
   */
  async processDatabase(req, res) {
    try {
      const { dbPath, platform, keyFile, mediaDir, phoneNumber, startDate, endDate, storeInDatabase, campaignId } = req.body;

      if (!dbPath) {
        return res.status(400).json({ error: 'Database path is required' });
      }

      const result = await WhatsAppQueryService.processDatabase(dbPath, {
        platform: platform || 'android',
        keyFile,
        mediaDir,
        phoneNumber,
        startDate,
        endDate,
        storeInDatabase: storeInDatabase === true,
        campaignId,
        outputDir: req.body.outputDir
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Process database error:', error);
      res.status(500).json({ error: `Failed to process database: ${error.message}` });
    }
  }
}

module.exports = new WhatsAppController();
