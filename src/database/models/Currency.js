const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Currency = sequelize.define('Currency', {
    currencyCode: {
      type: DataTypes.STRING(3),
      primaryKey: true,
      field: 'currency_code'
    },
    currencyName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'currency_name'
    },
    symbol: {
      type: DataTypes.STRING(5)
    },
    isCrypto: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_crypto'
    },
    decimalPlaces: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
      field: 'decimal_places'
    }
  }, {
    tableName: 'currencies',
    timestamps: false,
    underscored: true
  });

  Currency.associate = (models) => {
    Currency.hasMany(models.ExchangeRate, {
      foreignKey: 'baseCurrency',
      as: 'baseExchangeRates'
    });
    Currency.hasMany(models.ExchangeRate, {
      foreignKey: 'targetCurrency',
      as: 'targetExchangeRates'
    });
    Currency.hasMany(models.Donation, {
      foreignKey: 'originalCurrency',
      as: 'donations'
    });
  };

  return Currency;
};
