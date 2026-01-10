const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Campaign = sequelize.define('Campaign', {
    campaignId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'campaign_id'
    },
    campaignName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'campaign_name'
    },
    description: {
      type: DataTypes.TEXT
    },
    whatsappNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'whatsapp_number'
    },
    walletAddress: {
      type: DataTypes.STRING(255),
      field: 'wallet_address'
    },
    createdBy: {
      type: DataTypes.UUID,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    sourceType: {
      type: DataTypes.ENUM('whatsapp', 'whydonate', 'manual'),
      allowNull: false,
      field: 'source_type'
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'archived'),
      allowNull: false,
      defaultValue: 'draft'
    },
    totalDonationsEur: {
      type: DataTypes.DECIMAL(18, 2),
      defaultValue: 0.00,
      field: 'total_donations_eur'
    },
    totalFeesEur: {
      type: DataTypes.DECIMAL(18, 2),
      defaultValue: 0.00,
      field: 'total_fees_eur'
    },
    metadata: {
      type: DataTypes.JSONB
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'campaigns',
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (campaign) => {
        campaign.updatedAt = new Date();
      }
    }
  });

  Campaign.associate = (models) => {
    Campaign.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator'
    });
    Campaign.hasMany(models.Donation, {
      foreignKey: 'campaignId',
      as: 'donations'
    });
    Campaign.hasMany(models.TransactionBatch, {
      foreignKey: 'campaignId',
      as: 'batches'
    });
    Campaign.hasMany(models.WhyDonatePayout, {
      foreignKey: 'campaignId',
      as: 'whydonatePayouts'
    });
  };

  return Campaign;
};
