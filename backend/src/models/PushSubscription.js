'use strict';

const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userAgent: String,
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ userId: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
