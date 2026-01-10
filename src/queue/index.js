const Queue = require('bull');
const Redis = require('redis');

/**
 * Bull Queue Setup
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0
};

// Create queues
const whatsappQueue = new Queue('whatsapp-scan', {
  redis: redisConfig
});

const batchQueue = new Queue('batch-process', {
  redis: redisConfig
});

const blockchainQueue = new Queue('blockchain-monitor', {
  redis: redisConfig
});

module.exports = {
  whatsappQueue,
  batchQueue,
  blockchainQueue
};
