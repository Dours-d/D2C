const models = require('../database/models');
const WhatsAppService = require('../services/WhatsAppService');
const { whatsappQueue } = require('../queue');

/**
 * WhatsApp Scanner Job Worker
 */
whatsappQueue.process('scan-whatsapp', async (job) => {
  const { scanId, whatsappNumber, userId } = job.data;

  try {
    // Update scan job status
    const scanJob = await models.WhatsAppScanJob.findByPk(scanId);
    if (!scanJob) {
      throw new Error('Scan job not found');
    }

    await scanJob.update({
      status: 'scanning',
      startedAt: new Date()
    });

    // Scan WhatsApp chats
    const messages = await WhatsAppService.scanChats(whatsappNumber);

    // Store messages in database
    let messagesScanned = 0;
    let walletsFound = 0;

    for (const message of messages) {
      const chat = await WhatsAppService.storeMessage({
        whatsappNumber,
        messageId: message.id,
        senderNumber: message.from,
        messageText: message.text,
        timestamp: message.timestamp
      });

      messagesScanned++;

      // Extract wallet address
      const walletAddress = WhatsAppService.extractWalletAddress(message.text);
      if (walletAddress) {
        walletsFound++;
        await chat.update({ extractedWalletAddress: walletAddress });
      }
    }

    const { Op } = require('sequelize');
    // Extract donations
    const chats = await models.WhatsAppChat.findAll({
      where: {
        whatsappNumber,
        processingStatus: 'pending'
      }
    });

    const donations = await WhatsAppService.extractDonations(
      chats.map(c => c.chatId)
    );

    // Update scan job
    await scanJob.update({
      status: 'completed',
      messagesScanned,
      walletsFound,
      donationsIdentified: donations.length,
      completedAt: new Date()
    });

    return {
      success: true,
      messagesScanned,
      walletsFound,
      donationsIdentified: donations.length
    };
  } catch (error) {
    // Update scan job with error
    const scanJob = await models.WhatsAppScanJob.findByPk(scanId);
    if (scanJob) {
      await scanJob.update({
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date()
      });
    }

    throw error;
  }
});

module.exports = whatsappQueue;
