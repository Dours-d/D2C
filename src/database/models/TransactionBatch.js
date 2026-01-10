const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TransactionBatch = sequelize.define('TransactionBatch', {
    batchId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'batch_id'
    },
    batchNumber: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
      field: 'batch_number'
    },
    campaignId: {
      type: DataTypes.UUID,
      field: 'campaign_id',
      references: {
        model: 'campaigns',
        key: 'campaign_id'
      }
    },
    totalGrossEur: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'total_gross_eur'
    },
    totalDebtFeeEur: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0.00,
      field: 'total_debt_fee_eur'
    },
    totalOperationalFeeEur: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0.00,
      field: 'total_operational_fee_eur'
    },
    totalTransactionFeeEur: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0.00,
      field: 'total_transaction_fee_eur'
    },
    totalNetEur: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'total_net_eur'
    },
    targetUsdtAmount: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'target_usdt_amount'
    },
    eurToUsdtRate: {
      type: DataTypes.DECIMAL(12, 6),
      field: 'eur_to_usdt_rate'
    },
    simplexFee: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'simplex_fee'
    },
    targetWallet: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'target_wallet'
    },
    network: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'TRON'
    },
    status: {
      type: DataTypes.ENUM('draft', 'pending', 'processing', 'awaiting_simplex', 'sending', 'completed', 'failed', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft'
    },
    initiatedBy: {
      type: DataTypes.UUID,
      field: 'initiated_by',
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    initiatedAt: {
      type: DataTypes.DATE,
      field: 'initiated_at'
    },
    simplexProcessingAt: {
      type: DataTypes.DATE,
      field: 'simplex_processing_at'
    },
    sentToBlockchainAt: {
      type: DataTypes.DATE,
      field: 'sent_to_blockchain_at'
    },
    completedAt: {
      type: DataTypes.DATE,
      field: 'completed_at'
    },
    transactionHash: {
      type: DataTypes.STRING(255),
      field: 'transaction_hash'
    },
    blockNumber: {
      type: DataTypes.BIGINT,
      field: 'block_number'
    },
    notes: {
      type: DataTypes.TEXT
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
    tableName: 'transaction_batches',
    timestamps: false,
    underscored: true,
    hooks: {
      beforeCreate: (batch) => {
        if (!batch.batchNumber) {
          const now = new Date();
          batch.batchNumber = `BATCH-${now.toISOString().replace(/[-:T]/g, '').split('.')[0]}`;
        }
      },
      beforeUpdate: (batch) => {
        batch.updatedAt = new Date();
      }
    }
  });

  TransactionBatch.associate = (models) => {
    TransactionBatch.belongsTo(models.Campaign, {
      foreignKey: 'campaignId',
      as: 'campaign'
    });
    TransactionBatch.belongsTo(models.User, {
      foreignKey: 'initiatedBy',
      as: 'initiator'
    });
    TransactionBatch.hasMany(models.BatchDonation, {
      foreignKey: 'batchId',
      as: 'batchDonations'
    });
    TransactionBatch.hasMany(models.BlockchainTransaction, {
      foreignKey: 'batchId',
      as: 'blockchainTransactions'
    });
    TransactionBatch.hasMany(models.FeeAllocation, {
      foreignKey: 'batchId',
      as: 'feeAllocations'
    });
  };

  return TransactionBatch;
};
