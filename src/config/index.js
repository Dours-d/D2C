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
    url: process.env.DATABASE_URL,
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
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    apiKey: process.env.WHATSAPP_API_KEY,
    webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET
  },
  stripe: {
    apiKey: process.env.STRIPE_API_KEY,
    apiUrl: process.env.STRIPE_API_URL || 'https://api.stripe.com/v1'
  },
  simplex: {
    apiUrl: process.env.SIMPLEX_API_URL,
    apiKey: process.env.SIMPLEX_API_KEY,
    appId: process.env.SIMPLEX_APP_PROVIDER_ID || process.env.SIMPLEX_APP_ID,
    minPurchaseEur: parseFloat(process.env.SIMPLEX_MIN_EUR || '44')
  },
  tron: {
    network: process.env.TRON_NETWORK || 'mainnet',
    privateKey: process.env.TRON_PRIVATE_KEY,
    fullNode: process.env.TRON_FULL_NODE,
    solidityNode: process.env.TRON_SOLIDITY_NODE,
    eventServer: process.env.TRON_EVENT_SERVER,
    usdtContract: process.env.TRON_USDT_CONTRACT || process.env.USDT_TRC20_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  },
  exchangeRates: {
    updateMinutes: parseInt(process.env.EXCHANGE_RATE_UPDATE_MINUTES || '30', 10)
  },
  frontendUrl: process.env.FRONTEND_URL,
  corsOrigin: process.env.CORS_ORIGIN,
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  },
  validateConfig() {
    const errors = [];
    const warnings = [];

    const requireValue = (key, value, message) => {
      if (!value) {
        errors.push(message || `${key} is required`);
      }
    };

    const warnIfMissing = (key, value, message) => {
      if (!value) {
        warnings.push(message || `${key} is not configured`);
      }
    };

    requireValue('JWT_SECRET', process.env.JWT_SECRET, 'JWT_SECRET is required for authentication');
    if (!process.env.DATABASE_URL) {
      requireValue('DB_HOST', process.env.DB_HOST, 'DB_HOST is required for database connection');
      requireValue('DB_NAME', process.env.DB_NAME, 'DB_NAME is required for database connection');
      requireValue('DB_USER', process.env.DB_USER, 'DB_USER is required for database connection');
      warnIfMissing('DB_PASSWORD', process.env.DB_PASSWORD, 'DB_PASSWORD is not set (required for production DBs)');
    }
    warnIfMissing('STRIPE_API_KEY', process.env.STRIPE_API_KEY, 'STRIPE_API_KEY is required for exchange rates');
    warnIfMissing('SIMPLEX_API_KEY', process.env.SIMPLEX_API_KEY, 'SIMPLEX_API_KEY is required for Simplex payments');
    warnIfMissing(
      'SIMPLEX_APP_PROVIDER_ID',
      process.env.SIMPLEX_APP_PROVIDER_ID || process.env.SIMPLEX_APP_ID,
      'SIMPLEX_APP_PROVIDER_ID is required for Simplex payments'
    );
    warnIfMissing('TRON_PRIVATE_KEY', process.env.TRON_PRIVATE_KEY, 'TRON_PRIVATE_KEY is required for blockchain transfers');
    warnIfMissing('ADMIN_EMAIL', process.env.ADMIN_EMAIL, 'ADMIN_EMAIL is not configured');
    warnIfMissing('ADMIN_PASSWORD', process.env.ADMIN_PASSWORD, 'ADMIN_PASSWORD is not configured');
    warnIfMissing('SMTP_HOST', process.env.SMTP_HOST, 'SMTP_HOST is not configured');
    warnIfMissing('SMTP_USER', process.env.SMTP_USER, 'SMTP_USER is not configured');

    return { errors, warnings };
  }
};
