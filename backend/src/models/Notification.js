'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    icon: String,
    image: String,
    url: String,
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      default: null,
    },
    type: {
      type: String,
      enum: ['breaking', 'newsletter', 'system', 'comment', 'custom'],
      default: 'custom',
    },
    targetAudience: {
      type: String,
      enum: ['all', 'subscribers', 'specific'],
      default: 'all',
    },
    targetUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
      default: 'draft',
    },
    scheduledAt: Date,
    sentAt: Date,
    stats: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    tags: [String],
    utm: {
      source: String,
      medium: String,
      campaign: String,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ article: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
