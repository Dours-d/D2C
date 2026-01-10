require('dotenv').config();
const app = require('./app');
const models = require('./database/models');
const logger = require('./utils/logger');
const config = require('./config');

/**
 * Server Startup
 */
async function startServer() {
  try {
    // Test database connection
    await models.sequelize.authenticate();
    logger.info('Database connection established');

    // Sync database (in development only)
    if (config.env === 'development') {
      // Don't force sync in production - use migrations instead
      // await models.sequelize.sync({ alter: true });
      logger.info('Database models loaded');
    }

    // Start server
    const port = config.port;
    app.listen(port, () => {
      logger.info(`Server running on port ${port} in ${config.env} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await models.sequelize.close();
  process.exit(0);
});

startServer();
