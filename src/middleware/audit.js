const models = require('../database/models');

/**
 * Audit Logging Middleware
 */
const auditLog = (action, entityType) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json;

    // Override json method to capture response
    res.json = function(data) {
      // Log after response is sent
      setImmediate(async () => {
        try {
          await models.AuditLog.create({
            userId: req.user?.userId,
            action: action || `${req.method} ${req.path}`,
            entityType: entityType || req.path.split('/')[2],
            entityId: req.params.id || req.body?.id,
            oldValues: req.method === 'PUT' || req.method === 'DELETE' ? req.body : null,
            newValues: req.method === 'POST' || req.method === 'PUT' ? data : null,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
          });
        } catch (error) {
          console.error('Audit log error:', error);
        }
      });

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = auditLog;
