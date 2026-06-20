'use strict';

const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: [
        'page_view',
        'article_view',
        'article_share',
        'article_print',
        'article_read_complete',
        'article_read_25',
        'article_read_50',
        'article_read_75',
        'comment_submit',
        'search',
        'ticker_click',
        'category_view',
        'tag_view',
        'user_register',
        'user_login',
        'notification_click',
        'external_link_click',
        'custom',
      ],
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
    sessionId: {
      type: String,
    },
    ipAddress: {
      type: String,
      select: false,
    },
    userAgent: {
      type: String,
      select: false,
    },
    referrer: String,
    country: String,
    city: String,
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },
    browser: String,
    os: String,
    properties: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    duration: Number, // seconds spent on page
    scrollDepth: Number, // percentage
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'analytics_events',
  }
);

// TTL index - auto-delete events after 90 days
analyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Query indexes
analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ article: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ user: 1, timestamp: -1 });
analyticsEventSchema.index({ sessionId: 1 });

// Static: aggregate dashboard stats
analyticsEventSchema.statics.getDashboardStats = async function (startDate, endDate) {
  const pipeline = [
    {
      $match: {
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
      },
    },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
      },
    },
  ];

  const results = await this.aggregate(pipeline);
  return results.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});
};

// Static: get trending articles by views in timeframe
analyticsEventSchema.statics.getTrending = async function (hours = 24, limit = 10) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        eventType: 'article_view',
        article: { $ne: null },
        timestamp: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$article',
        views: { $sum: 1 },
        uniqueSessions: { $addToSet: '$sessionId' },
      },
    },
    {
      $addFields: {
        uniqueViews: { $size: '$uniqueSessions' },
      },
    },
    { $sort: { views: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'articles',
        localField: '_id',
        foreignField: '_id',
        as: 'article',
      },
    },
    { $unwind: '$article' },
    {
      $project: {
        article: {
          _id: 1, title: 1, slug: 1, ogImage: 1, category: 1, publishedAt: 1,
        },
        views: 1,
        uniqueViews: 1,
      },
    },
  ]);
};

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
