const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OperationalAccount = sequelize.define('OperationalAccount', {
    accountId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'account_id'
    },
    accountName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'account_name'
    },
    accountType: {
      type: DataTypes.ENUM('bank', 'crypto_wallet', 'payment_processor'),
      field: 'account_type'
    },
    accountDetails: {
      type: DataTypes.JSONB,
      field: 'account_details'
    },
    currency: {
      type: DataTypes.STRING(3),
      field: 'currency',
      references: {
        model: 'currencies',
        key: 'currency_code'
      }
    },
    currentBalance: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0.00,
      field: 'current_balance'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'operational_accounts',
    timestamps: false,
    underscored: true
  });

  OperationalAccount.associate = (models) => {
    OperationalAccount.belongsTo(models.Currency, {
      foreignKey: 'currency',
      as: 'currencyData'
    });
  };

  return OperationalAccount;
};
