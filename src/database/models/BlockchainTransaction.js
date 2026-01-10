const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BlockchainTransaction = sequelize.define('BlockchainTransaction', {
    transactionId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'transaction_id'
    },
    batchId: {
      type: DataTypes.UUID,
      field: 'batch_id',
      references: {
        model: 'transaction_batches',
        key: 'batch_id'
      }
    },
    donationId: {
      type: DataTypes.UUID,
      field: 'donation_id',
      references: {
        model: 'donations',
        key: 'donation_id'
      }
    },
    fromWallet: {
      type: DataTypes.STRING(255),
      field: 'from_wallet'
    },
    toWallet: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'to_wallet'
    },
    usdtAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'usdt_amount'
    },
    networkFeeTrx: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'network_fee_trx'
    },
    networkFeeUsdt: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'network_fee_usdt'
    },
    transactionHash: {
      type: DataTypes.STRING(255),
      unique: true,
      field: 'transaction_hash'
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'confirmed', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    blockNumber: {
      type: DataTypes.BIGINT,
      field: 'block_number'
    },
    confirmations: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    confirmedAt: {
      type: DataTypes.DATE,
      field: 'confirmed_at'
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
    tableName: 'blockchain_transactions',
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (transaction) => {
        transaction.updatedAt = new Date();
      }
    }
  });

  BlockchainTransaction.associate = (models) => {
    BlockchainTransaction.belongsTo(models.TransactionBatch, {
      foreignKey: 'batchId',
      as: 'batch'
    });
    BlockchainTransaction.belongsTo(models.Donation, {
      foreignKey: 'donationId',
      as: 'donation'
    });
  };

  return BlockchainTransaction;
};
