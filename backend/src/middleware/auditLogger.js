'use strict';

const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Determine severity based on action
 */
const getSeverity = (action) => {
  const critical = ['user.delete', 'user.role.change', 'system.config', 'article.delete.hard'];
  const high = ['user.create', 'article.delete', 'category.delete', 'user.ban'];
  const medium = ['article.publish', 'article.archive', 'comment.delete', 'notification.send'];

  if (critical.some((a) => action.includes(a))) return 'critical';
  if (high.some((a) => action.includes(a))) return 'high';
  if (medium.some((a) => action.includes(a))) return 'medium';
  return 'low';
};

/**
 * Middleware factory for audit logging
 * @param {string} action - Action identifier (e.g., 'article.create')
 * @param {string} resourceType - Resource type
 * @param {Function} [getResourceInfo] - Function to extract resource info from req
 */
const auditLog = (action, resourceType, getResourceInfo = null) => {
  return async (req, res, next) => {
    // Store original json method to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      res.json = originalJson;

      // Log after response is sent
      setImmediate(async () => {
        try {
          let resourceId = null;
          let resourceTitle = null;
          let changes = null;

          if (getResourceInfo) {
            const info = await getResourceInfo(req, data);
            resourceId = info?.id || null;
            resourceTitle = info?.title || null;
            changes = info?.changes || null;
          } else {
            // Try to extract from common patterns
            resourceId = req.params?.id || data?.data?._id || null;
            resourceTitle = data?.data?.title || data?.data?.name || null;
          }

          await AuditLog.log({
            userId: req.user?._id,
            userEmail: req.user?.email,
            userRole: req.user?.role,
            action,
            resourceType,
            resourceId,
            resourceTitle,
            changes,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers?.['user-agent'],
            requestMethod: req.method,
            requestPath: req.originalUrl,
            statusCode: res.statusCode,
            severity: getSeverity(action),
            metadata: {
              params: req.params,
              query: req.query,
            },
          });
        } catch (err) {
          logger.error('Audit log middleware error:', err.message);
        }
      });

      return originalJson(data);
    };

    next();
  };
};

/**
 * Simple audit log helper (call directly in controller)
 */
const logAction = async ({ req, action, resourceType, resourceId, resourceTitle, changes, severity }) => {
  try {
    await AuditLog.log({
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      action,
      resourceType,
      resourceId,
      resourceTitle,
      changes,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
      requestMethod: req.method,
      requestPath: req.originalUrl,
      severity: severity || getSeverity(action),
    });
  } catch (err) {
    logger.error('logAction error:', err.message);
  }
};

module.exports = { auditLog, logAction };
