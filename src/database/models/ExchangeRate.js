const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ExchangeRate = sequelize.define('ExchangeRate', {
    exchangeId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'exchange_id'
    },
    baseCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'base_currency',
      references: {
        model: 'currencies',
        key: 'currency_code'
      }
    },
    targetCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'target_currency',
      references: {
        model: 'currencies',
        key: 'currency_code'
      }
    },
    rate: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false
    },
    source: {
      type: DataTypes.ENUM('stripe', 'manual', 'simplex'),
      allowNull: false
    },
    validFrom: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'valid_from'
    },
    validTo: {
      type: DataTypes.DATE,
      field: 'valid_to'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'exchange_rates',
    timestamps: false,
    underscored: true
  });

  ExchangeRate.associate = (models) => {
    ExchangeRate.belongsTo(models.Currency, {
      foreignKey: 'baseCurrency',
      as: 'baseCurrencyData'
    });
    ExchangeRate.belongsTo(models.Currency, {
      foreignKey: 'targetCurrency',
      as: 'targetCurrencyData'
    });
  };

  return ExchangeRate;
};
