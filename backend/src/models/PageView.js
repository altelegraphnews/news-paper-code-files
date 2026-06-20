'use strict';

const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      required: true,
    },
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sessionId: String,
    ipAddress: {
      type: String,
      select: false,
    },
    country: String,
    city: String,
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },
    referrer: String,
    referrerDomain: String,
    isBot: {
      type: Boolean,
      default: false,
    },
    duration: Number,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    date: {
      type: String, // YYYY-MM-DD format for grouping
    },
    hour: {
      type: Number, // 0-23 for hourly stats
    },
  },
  {
    timestamps: false,
    collection: 'page_views',
  }
);

// TTL: auto-delete after 30 days (raw views)
pageViewSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
pageViewSchema.index({ article: 1, timestamp: -1 });
pageViewSchema.index({ date: 1, article: 1 });
pageViewSchema.index({ sessionId: 1 });
pageViewSchema.index({ path: 1, timestamp: -1 });

// Pre-save: extract date and hour
pageViewSchema.pre('save', function (next) {
  const ts = this.timestamp || new Date();
  this.date = ts.toISOString().split('T')[0];
  this.hour = ts.getHours();
  next();
});

// Static: get views summary by date range
pageViewSchema.statics.getSummary = async function (startDate, endDate, articleId = null) {
  const match = {
    timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
    isBot: false,
  };

  if (articleId) match.article = new mongoose.Types.ObjectId(articleId);

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$date',
        views: { $sum: 1 },
        uniqueSessions: { $addToSet: '$sessionId' },
        uniqueCountries: { $addToSet: '$country' },
      },
    },
    {
      $addFields: {
        uniqueVisitors: { $size: '$uniqueSessions' },
        countriesCount: { $size: '$uniqueCountries' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

module.exports = mongoose.model('PageView', pageViewSchema);
