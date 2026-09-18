'use strict';

/**
 * Put the writer's own name back on articles that came in by email or form.
 *
 * Until submissionService learned to mint a byline profile, every submission
 * from an address we did not already know was parked under the shared
 * «مساهمة بريدية» placeholder — so it published under that instead of the
 * person who wrote it. Their name was captured all along, in
 * submission.senderName; nothing ever read it.
 *
 * This walks the articles still sitting on the placeholder, and for each one
 * whose submission carries a usable name and address, reuses or creates the
 * same signature-only profile the ingester would create today, then moves the
 * article onto it.
 *
 * Only the placeholder's articles are touched. An article an editor has already
 * reassigned by hand is left exactly as they left it.
 *
 * Usage: node scripts/backfill-submission-bylines.js [--dry]
 */

require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');

const PLACEHOLDER_EMAIL = 'submissions-system@al-telegraph.com';

// Same rule the ingester applies — kept in step with
// submissionService.usableName.
const usableName = (raw) => {
  const name = String(raw || '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2 || name.length > 100) return '';
  if (/@/.test(name)) return '';
  return name;
};

(async () => {
  const dry = process.argv.includes('--dry');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alwid_news');

  const User = require('../src/models/User');
  const Article = require('../src/models/Article');

  const placeholder = await User.findOne({ email: PLACEHOLDER_EMAIL }).select('_id name');
  if (!placeholder) {
    console.log('No «مساهمة بريدية» placeholder account exists — nothing to backfill.');
    await mongoose.connection.close();
    return;
  }

  const articles = await Article.find({ author: placeholder._id, isDeleted: { $ne: true } })
    .select('title status author +submission')
    .lean();

  console.log(`${articles.length} article(s) still bylined «${placeholder.name}»${dry ? ' (--dry)' : ''}:\n`);

  let moved = 0;
  let created = 0;
  let skipped = 0;

  for (const article of articles) {
    const email = String(article.submission?.senderEmail || '').toLowerCase().trim();
    const name = usableName(article.submission?.senderName);

    if (!email || !name || email === PLACEHOLDER_EMAIL) {
      skipped += 1;
      console.log(`  – ${article.title} — no usable sender name/address, left as is`);
      continue;
    }

    let author = await User.findOne({ email }).select('_id name');
    const willCreate = !author;

    if (dry) {
      console.log(`  · ${article.title} → ${name} <${email}>${willCreate ? ' (new profile)' : ''}`);
      continue;
    }

    if (!author) {
      author = await User.create({
        name,
        email,
        password: crypto.randomBytes(24).toString('hex'),
        role: 'author',
        isProfileOnly: true,
        isActive: true,
        isEmailVerified: true,
      });
      created += 1;
    }

    await Article.updateOne({ _id: article._id }, { $set: { author: author._id } });
    moved += 1;
    console.log(`  ✓ ${article.title} → ${author.name}`);
  }

  if (!dry) {
    console.log(`\nRebylined ${moved} article(s), created ${created} profile(s), skipped ${skipped}.`);
    if (moved) {
      console.log('Published ones need their pages rebuilt — clear the cache from the admin, or wait out the ISR window.');
    }
  }

  await mongoose.connection.close();
})().catch((err) => { console.error(err); process.exit(1); });
