'use strict';

const mongoose = require('mongoose');

/**
 * One finished day of readership, kept for good.
 *
 * The raw logs it is built from expire — page_views after 30 days,
 * analytics_events after 90 — so without this nothing older than a quarter
 * survives and the dashboard cannot answer "since launch". A day is written
 * once it has ended (Baghdad time) and never changes after that; the current
 * day is always read live from the event log instead.
 */
const dailyStatSchema = new mongoose.Schema(
  {
    // YYYY-MM-DD, Baghdad calendar day
    date: { type: String, required: true, unique: true },
    views: { type: Number, default: 0 },
    // Distinct visitor ids that day. null, not 0, on days before visitor ids
    // were collected: "not measured" must not read as "nobody came".
    visitors: { type: Number, default: null },
    articles: [
      {
        _id: false,
        article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
        views: Number,
      },
    ],
  },
  { timestamps: false, collection: 'daily_stats' }
);

module.exports = mongoose.model('DailyStat', dailyStatSchema);
