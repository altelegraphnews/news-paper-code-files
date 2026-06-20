'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    userEmail: String, // denormalized for quick display
    userRole: String,
    action: {
      type: String,
      required: true,
      // e.g., 'article.create', 'article.delete', 'user.role.change', etc.
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['article', 'category', 'comment', 'user', 'ticker', 'notification', 'system', 'media'],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    resourceTitle: String, // denormalized
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
    },
    ipAddress: String,
    userAgent: String,
    requestMethod: String,
    requestPath: String,
    statusCode: Number,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'audit_logs',
  }
);

// TTL: keep audit logs for 1 year
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

// Static: log an action
auditLogSchema.statics.log = async function ({
  userId,
  userEmail,
  userRole,
  action,
  resourceType,
  resourceId,
  resourceTitle,
  changes,
  ipAddress,
  userAgent,
  requestMethod,
  requestPath,
  statusCode,
  severity = 'low',
  metadata,
}) {
  try {
    await this.create({
      user: userId,
      userEmail,
      userRole,
      action,
      resourceType,
      resourceId,
      resourceTitle,
      changes,
      ipAddress,
      userAgent,
      requestMethod,
      requestPath,
      statusCode,
      severity,
      metadata,
      timestamp: new Date(),
    });
  } catch (error) {
    // Audit log failure should not break the request
    console.error('AuditLog.log error:', error.message);
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
