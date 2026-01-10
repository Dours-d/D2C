require('dotenv').config();

/**
 * Application Configuration
 */
module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'd2c_donations',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0
  },
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL,
    accountSid: process.env.WHATSAPP_ACCOUNT_SID,
    authToken: process.env.WHATSAPP_AUTH_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    fromNumber: process.env.WHATSAPP_FROM_NUMBER,
    // Legacy support
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN
  },
  stripe: {
    apiKey: process.env.STRIPE_API_KEY,
    apiUrl: process.env.STRIPE_API_URL || 'https://api.stripe.com/v1'
  },
  simplex: {
    apiUrl: process.env.SIMPLEX_API_URL,
    apiKey: process.env.SIMPLEX_API_KEY,
    appId: process.env.SIMPLEX_APP_ID
  },
  tron: {
    network: process.env.TRON_NETWORK || 'mainnet',
    privateKey: process.env.TRON_PRIVATE_KEY,
    fullNode: process.env.TRON_FULL_NODE,
    solidityNode: process.env.TRON_SOLIDITY_NODE,
    eventServer: process.env.TRON_EVENT_SERVER,
    usdtContract: process.env.USDT_TRC20_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  }
};
