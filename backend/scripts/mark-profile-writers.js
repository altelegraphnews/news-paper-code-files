'use strict';

/**
 * One-time migration: mark signature-only writer profiles.
 *
 * Any author-role account that has never logged in is treated as a byline
 * identity (isProfileOnly: true) — it can no longer log in and is managed
 * from the admin «الكُتّاب» page instead of the team page.
 *
 * Usage: node scripts/mark-profile-writers.js [--dry]
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const dry = process.argv.includes('--dry');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alwid_news');
  const User = require('../src/models/User');

  const filter = {
    role: 'author',
    isProfileOnly: { $ne: true },
    $or: [{ lastLoginAt: null }, { lastLoginAt: { $exists: false } }],
  };

  const candidates = await User.find(filter).select('name email lastLoginAt').lean();
  console.log(`${candidates.length} author account(s) never logged in:`);
  candidates.forEach((u) => console.log(`  - ${u.name} <${u.email}>`));

  if (dry) {
    console.log('\n--dry: no changes made.');
  } else if (candidates.length) {
    const res = await User.updateMany(filter, { $set: { isProfileOnly: true } });
    console.log(`\nMarked ${res.modifiedCount} account(s) as signature-only profiles.`);
  }

  await mongoose.connection.close();
})().catch((err) => { console.error(err); process.exit(1); });
