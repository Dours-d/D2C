const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Donation = sequelize.define('Donation', {
    donationId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'donation_id'
    },
    campaignId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'campaign_id',
      references: {
        model: 'campaigns',
        key: 'campaign_id'
      }
    },
    sourceType: {
      type: DataTypes.ENUM('whatsapp', 'whydonate', 'manual'),
      allowNull: false,
      field: 'source_type'
    },
    sourceIdentifier: {
      type: DataTypes.STRING(255),
      field: 'source_identifier'
    },
    donorName: {
      type: DataTypes.STRING(255),
      field: 'donor_name'
    },
    whatsappNumber: {
      type: DataTypes.STRING(20),
      field: 'whatsapp_number'
    },
    email: {
      type: DataTypes.STRING(255)
    },
    originalAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'original_amount'
    },
    originalCurrency: {
      type: DataTypes.STRING(3),
      field: 'original_currency',
      references: {
        model: 'currencies',
        key: 'currency_code'
      }
    },
    euroAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'euro_amount'
    },
    conversionRate: {
      type: DataTypes.DECIMAL(12, 6),
      allowNull: false,
      field: 'conversion_rate'
    },
    totalFeePercent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 25.00,
      field: 'total_fee_percent'
    },
    debtFeePercent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 10.00,
      field: 'debt_fee_percent'
    },
    operationalFeePercent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 10.00,
      field: 'operational_fee_percent'
    },
    transactionFeePercent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 5.00,
      field: 'transaction_fee_percent'
    },
    debtFeeAmount: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0.00,
      field: 'debt_fee_amount'
    },
    operationalFeeAmount: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0.00,
      field: 'operational_fee_amount'
    },
    transactionFeeAmount: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0.00,
      field: 'transaction_fee_amount'
    },
    netAmountEur: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'net_amount_eur'
    },
    donationDate: {
      type: DataTypes.DATE,
      field: 'donation_date'
    },
    status: {
      type: DataTypes.ENUM('pending', 'converted', 'batched', 'sent', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    processedBy: {
      type: DataTypes.UUID,
      field: 'processed_by',
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    processedAt: {
      type: DataTypes.DATE,
      field: 'processed_at'
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
    tableName: 'donations',
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (donation) => {
        donation.updatedAt = new Date();
      }
    }
  });

  Donation.associate = (models) => {
    Donation.belongsTo(models.Campaign, {
      foreignKey: 'campaignId',
      as: 'campaign'
    });
    Donation.belongsTo(models.Currency, {
      foreignKey: 'originalCurrency',
      as: 'currency'
    });
    Donation.belongsTo(models.User, {
      foreignKey: 'processedBy',
      as: 'processor'
    });
    Donation.hasMany(models.BatchDonation, {
      foreignKey: 'donationId',
      as: 'batchDonations'
    });
    Donation.hasMany(models.BlockchainTransaction, {
      foreignKey: 'donationId',
      as: 'blockchainTransactions'
    });
    Donation.hasMany(models.FeeAllocation, {
      foreignKey: 'donationId',
      as: 'feeAllocations'
    });
  };

  return Donation;
};
