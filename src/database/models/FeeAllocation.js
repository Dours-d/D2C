const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FeeAllocation = sequelize.define('FeeAllocation', {
    allocationId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'allocation_id'
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
    feeType: {
      type: DataTypes.ENUM('debt', 'operational', 'transaction'),
      allowNull: false,
      field: 'fee_type'
    },
    feePercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      field: 'fee_percent'
    },
    feeAmountEur: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'fee_amount_eur'
    },
    feeAmountUsdt: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'fee_amount_usdt'
    },
    destinationWallet: {
      type: DataTypes.STRING(255),
      field: 'destination_wallet'
    },
    destinationAccount: {
      type: DataTypes.STRING(255),
      field: 'destination_account'
    },
    allocatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'allocated_at'
    },
    transferred: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    transferredAt: {
      type: DataTypes.DATE,
      field: 'transferred_at'
    },
    transferReference: {
      type: DataTypes.STRING(255),
      field: 'transfer_reference'
    }
  }, {
    tableName: 'fee_allocations',
    timestamps: false,
    underscored: true
  });

  FeeAllocation.associate = (models) => {
    FeeAllocation.belongsTo(models.TransactionBatch, {
      foreignKey: 'batchId',
      as: 'batch'
    });
    FeeAllocation.belongsTo(models.Donation, {
      foreignKey: 'donationId',
      as: 'donation'
    });
  };

  return FeeAllocation;
};
