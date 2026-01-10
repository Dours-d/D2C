const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatsAppChat = sequelize.define('WhatsAppChat', {
    chatId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'chat_id'
    },
    whatsappNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'whatsapp_number'
    },
    messageId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'message_id'
    },
    senderNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'sender_number'
    },
    messageText: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'message_text'
    },
    messageTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'message_timestamp'
    },
    extractedWalletAddress: {
      type: DataTypes.STRING(255),
      field: 'extracted_wallet_address'
    },
    extractedCampaignLink: {
      type: DataTypes.STRING(500),
      field: 'extracted_campaign_link'
    },
    extractedAmount: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'extracted_amount'
    },
    extractedCurrency: {
      type: DataTypes.STRING(10),
      field: 'extracted_currency'
    },
    processingStatus: {
      type: DataTypes.ENUM('pending', 'processed', 'failed', 'ignored'),
      defaultValue: 'pending',
      field: 'processing_status'
    },
    processingResult: {
      type: DataTypes.TEXT,
      field: 'processing_result'
    },
    processedAt: {
      type: DataTypes.DATE,
      field: 'processed_at'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'whatsapp_chats',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['whatsapp_number', 'message_id']
      }
    ]
  });

  return WhatsAppChat;
};
