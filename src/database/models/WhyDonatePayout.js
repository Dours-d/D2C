const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhyDonatePayout = sequelize.define('WhyDonatePayout', {
    payoutId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'payout_id'
    },
    whydonatePayoutId: {
      type: DataTypes.STRING(255),
      unique: true,
      field: 'whydonate_payout_id'
    },
    payoutDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'payout_date'
    },
    donorName: {
      type: DataTypes.STRING(255),
      field: 'donor_name'
    },
    donorEmail: {
      type: DataTypes.STRING(255),
      field: 'donor_email'
    },
    donorPhone: {
      type: DataTypes.STRING(20),
      field: 'donor_phone'
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      references: {
        model: 'currencies',
        key: 'currency_code'
      }
    },
    fee: {
      type: DataTypes.DECIMAL(18, 2),
      defaultValue: 0.00
    },
    netAmount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'net_amount'
    },
    campaignReference: {
      type: DataTypes.STRING(255),
      field: 'campaign_reference'
    },
    campaignId: {
      type: DataTypes.UUID,
      field: 'campaign_id',
      references: {
        model: 'campaigns',
        key: 'campaign_id'
      }
    },
    status: {
      type: DataTypes.STRING(50)
    },
    importedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'imported_at'
    },
    processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    processedAt: {
      type: DataTypes.DATE,
      field: 'processed_at'
    },
    rawData: {
      type: DataTypes.JSONB,
      field: 'raw_data'
    }
  }, {
    tableName: 'whydonate_payouts',
    timestamps: false,
    underscored: true
  });

  WhyDonatePayout.associate = (models) => {
    WhyDonatePayout.belongsTo(models.Campaign, {
      foreignKey: 'campaignId',
      as: 'campaign'
    });
    WhyDonatePayout.belongsTo(models.Currency, {
      foreignKey: 'currency',
      as: 'currencyData'
    });
  };

  return WhyDonatePayout;
};
