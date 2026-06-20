'use strict';

// One-off cleanup: zero out the fake seeded view counts and wipe the
// analytics collections so all numbers reflect real reader activity only.
// Usage: node scripts/reset-views.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const config = require('../src/config/env');

const Article = require('../src/models/Article');
const PageView = require('../src/models/PageView');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');

const run = async () => {
  await mongoose.connect(config.mongodb.uri);

  const articles = await Article.updateMany(
    {},
    {
      $set: {
        'views.total': 0,
        'views.last24h': 0,
        'views.last7d': 0,
        'views.lastUpdated': new Date(),
      },
    }
  );
  const pageViews = await PageView.deleteMany({});
  const events = await AnalyticsEvent.deleteMany({});

  console.log(`Articles reset:        ${articles.modifiedCount}`);
  console.log(`PageViews deleted:     ${pageViews.deletedCount}`);
  console.log(`Analytics events deleted: ${events.deletedCount}`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
