const logger = require('../utils/logger');

/**
 * Error Handling Middleware
 * Produces a standardized JSON shape and includes a correlationId.
 */
const errorHandler = (err, req, res, next) => {
  const correlationId = req.requestId;

  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.userId,
    correlationId
  });

  const isDev = process.env.NODE_ENV === 'development';

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation error',
        details: err.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      },
      correlationId,
      ...(isDev ? { debug: { stack: err.stack } } : {})
    });
  }

  // Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE',
        message: 'Duplicate entry',
        details: { message: err.message }
      },
      correlationId,
      ...(isDev ? { debug: { stack: err.stack } } : {})
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error',
        details: { message: err.message }
      },
      correlationId,
      ...(isDev ? { debug: { stack: err.stack } } : {})
    });
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  const message = err.message || (statusCode >= 500 ? 'Internal server error' : 'Request failed');

  res.status(statusCode).json({
    error: {
      code,
      message
    },
    correlationId,
    ...(isDev ? { debug: { stack: err.stack } } : {})
  });
};

module.exports = errorHandler;
