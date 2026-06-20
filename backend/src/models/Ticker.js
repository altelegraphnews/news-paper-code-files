'use strict';

const mongoose = require('mongoose');

const tickerSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'نص الشريط الإخباري مطلوب'],
      trim: true,
      maxlength: [300, 'نص الشريط لا يتجاوز 300 حرف'],
    },
    url: {
      type: String,
      trim: true,
    },
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      default: null,
    },
    type: {
      type: String,
      enum: ['breaking', 'info', 'update', 'promo'],
      default: 'info',
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startAt: {
      type: Date,
      default: Date.now,
    },
    endAt: {
      type: Date,
    },
    color: {
      type: String,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'رمز اللون غير صالح'],
    },
    backgroundColor: {
      type: String,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'رمز لون الخلفية غير صالح'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    clickCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
tickerSchema.index({ isActive: 1, priority: -1 });
tickerSchema.index({ startAt: 1, endAt: 1 });
tickerSchema.index({ type: 1, isActive: 1 });

// Query helper: active tickers now
tickerSchema.query.activeNow = function () {
  const now = new Date();
  return this.where({
    isActive: true,
    startAt: { $lte: now },
    $or: [{ endAt: null }, { endAt: { $gte: now } }],
  });
};

// Static: get active tickers sorted by priority
tickerSchema.statics.getActive = async function (limit = 10) {
  const now = new Date();
  return this.find({
    isActive: true,
    startAt: { $lte: now },
    $or: [{ endAt: null }, { endAt: { $gte: now } }],
  })
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit)
    .populate('article', 'title slug')
    .lean();
};

module.exports = mongoose.model('Ticker', tickerSchema);
