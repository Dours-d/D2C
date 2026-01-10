const { Sequelize } = require('sequelize');
const config = require('../config');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions || {}
  }
);

// Import all models
const User = require('./User')(sequelize);
const Currency = require('./Currency')(sequelize);
const Campaign = require('./Campaign')(sequelize);
const ExchangeRate = require('./ExchangeRate')(sequelize);
const Donation = require('./Donation')(sequelize);
const WhatsAppChat = require('./WhatsAppChat')(sequelize);
const WhatsAppScanJob = require('./WhatsAppScanJob')(sequelize);
const WhyDonatePayout = require('./WhyDonatePayout')(sequelize);
const TransactionBatch = require('./TransactionBatch')(sequelize);
const BatchDonation = require('./BatchDonation')(sequelize);
const BlockchainTransaction = require('./BlockchainTransaction')(sequelize);
const FeeAllocation = require('./FeeAllocation')(sequelize);
const OperationalAccount = require('./OperationalAccount')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);
const SystemConfig = require('./SystemConfig')(sequelize);

// Define associations
const models = {
  User,
  Currency,
  Campaign,
  ExchangeRate,
  Donation,
  WhatsAppChat,
  WhatsAppScanJob,
  WhyDonatePayout,
  TransactionBatch,
  BatchDonation,
  BlockchainTransaction,
  FeeAllocation,
  OperationalAccount,
  AuditLog,
  SystemConfig
};

// Initialize associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
