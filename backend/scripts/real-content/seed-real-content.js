'use strict';

/*
 * Seeds the real editorial content into MongoDB (Atlas):
 *   1. ensures the four categories exist (shir / sard / qiraat / hiwar)
 *   2. upserts the byline author accounts (with Cloudinary avatars)
 *   3. upserts the 17 articles (content HTML, hero ogImage, inline gallery)
 *   4. removes the AI filler articles (identified by their picsum.photos images)
 *
 * Prereq: run upload-cloudinary.js first to produce image-urls.json.
 *
 * Flags:
 *   --keep-filler   do not delete the picsum filler articles
 *   --dry           connect + report, but do not write
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const config = require('../../src/config/env');
const User = require('../../src/models/User');
const Category = require('../../src/models/Category');
const Article = require('../../src/models/Article');
const { generateSlug } = require('../../src/utils/slugGenerator');
const { sanitizeHtml } = require('../../src/utils/sanitizer');
const { calculateReadingTime, sanitizeExcerpt } = require('../../src/utils/readingTime');
const { AUTHORS, ARTICLES, buildHtml } = require('./content');

const KEEP_FILLER = process.argv.includes('--keep-filler');
const DRY = process.argv.includes('--dry');
const AUTHOR_PASSWORD = process.env.CONTENT_AUTHOR_PASSWORD || 'Telegraph#2026';

const CATEGORIES = [
  { slug: 'shir', name: 'شعر', nameEn: 'Poetry', color: '#8e44ad', icon: '📜', order: 2 },
  { slug: 'sard', name: 'سرد', nameEn: 'Prose', color: '#2980b9', icon: '📖', order: 3 },
  { slug: 'qiraat', name: 'قراءات', nameEn: 'Reviews', color: '#27ae60', icon: '🔍', order: 4 },
  { slug: 'hiwar', name: 'حوار', nameEn: 'Interview', color: '#e74c3c', icon: '🎙️', order: 6 },
];

async function uniqueSlug(base, takenIds) {
  let slug = generateSlug(base) || `article-${Date.now()}`;
  const existing = await Article.findOne({ slug }).select('_id');
  if (existing && !takenIds.has(String(existing._id))) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
}

(async () => {
  const imgPath = path.join(__dirname, 'image-urls.json');
  if (!fs.existsSync(imgPath)) {
    console.error('❌ image-urls.json not found. Run: node scripts/real-content/upload-cloudinary.js');
    process.exit(1);
  }
  const IMAGE_URLS = JSON.parse(fs.readFileSync(imgPath, 'utf8'));
  const urlFor = (key) => {
    const rec = IMAGE_URLS[key];
    if (!rec) throw new Error(`No uploaded URL for image key: ${key}`);
    return rec.url;
  };

  await mongoose.connect(config.mongodb.uri);
  console.log('📦 Connected to MongoDB:', mongoose.connection.name);

  // 1) Categories -----------------------------------------------------------
  const catBySlug = {};
  for (const c of CATEGORIES) {
    let cat = await Category.findOne({ slug: c.slug });
    if (!cat && !DRY) {
      cat = await Category.create({ ...c, isActive: true, showInNav: true });
      console.log(`  📁 created category ${c.slug} (${c.name})`);
    } else if (cat) {
      console.log(`  📁 category ${c.slug} exists`);
    }
    catBySlug[c.slug] = cat;
  }

  // 2) Authors --------------------------------------------------------------
  const userByKey = {};
  for (const [key, a] of Object.entries(AUTHORS)) {
    const slug = generateSlug(a.name);
    const email = `${slug}@altilgraf.com`;
    const avatar = a.avatar ? { url: urlFor(a.avatar), publicId: IMAGE_URLS[a.avatar].publicId } : undefined;
    let user = await User.findOne({ email });
    if (!user) {
      if (!DRY) {
        user = await User.create({
          name: a.name,
          email,
          password: AUTHOR_PASSWORD,
          role: 'author',
          bio: a.bio,
          avatar,
          isActive: true,
          isEmailVerified: true,
        });
      }
      console.log(`  👤 created author ${a.name} <${email}>`);
    } else {
      user.name = a.name;
      user.bio = a.bio;
      if (avatar) user.avatar = avatar;
      if (user.role === 'reader') user.role = 'author';
      if (!DRY) await user.save();
      console.log(`  👤 updated author ${a.name} <${email}>`);
    }
    userByKey[key] = user;
  }

  // 3) Articles -------------------------------------------------------------
  const takenIds = new Set();
  let created = 0;
  let updated = 0;
  const now = Date.now();

  for (let i = 0; i < ARTICLES.length; i++) {
    const art = ARTICLES[i];
    const cat = catBySlug[art.category];
    const author = userByKey[art.author];
    if (!cat) throw new Error(`Missing category ${art.category}`);
    if (!author && !DRY) throw new Error(`Missing author ${art.author}`);

    const rawHtml = buildHtml(art, urlFor);
    const content = sanitizeHtml(rawHtml);
    const excerpt = sanitizeExcerpt(art.subtitle ? `${art.subtitle}. ${content}` : content, 260);
    const readingTimeMin = calculateReadingTime(content);
    const heroRec = IMAGE_URLS[art.hero];

    const ogImage = {
      url: heroRec.url,
      publicId: heroRec.publicId,
      alt: art.title,
      caption: art.heroCaption || '',
      width: heroRec.width,
      height: heroRec.height,
    };
    const figItems = (art.figures && art.figures.items) || [];
    const figTitle = art.figures && art.figures.title;
    const gallery = figItems.map((f) => ({
      url: urlFor(f.key),
      publicId: IMAGE_URLS[f.key].publicId,
      alt: f.caption || figTitle || art.title,
      caption: f.caption || figTitle || '',
    }));

    const doc = {
      title: art.title,
      subtitle: art.subtitle || undefined,
      content,
      excerpt,
      category: cat._id,
      author: author ? author._id : undefined,
      tags: art.tags || [],
      status: 'published',
      publishedAt: new Date(now - i * 6 * 60 * 60 * 1000), // 6h apart, newest first
      isFeatured: !!art.featured,
      isBreaking: false,
      commentsEnabled: true,
      readingTimeMin,
      views: { total: 0, last24h: 0, last7d: 0 },
      ogImage,
      gallery,
      language: 'ar',
      seo: {
        title: art.title.slice(0, 70),
        description: excerpt.slice(0, 160),
        keywords: (art.tags || []).slice(0, 8),
      },
    };

    // upsert by a stable slug derived from title
    let existing = await Article.findOne({ slug: generateSlug(art.title) });
    if (existing) {
      takenIds.add(String(existing._id));
      if (!DRY) {
        Object.assign(existing, doc);
        await existing.save();
      }
      updated++;
      console.log(`  📰 updated [${art.category}] ${art.title}`);
    } else {
      const slug = await uniqueSlug(art.title, takenIds);
      if (!DRY) {
        const c = await Article.create({ ...doc, slug });
        takenIds.add(String(c._id));
      }
      created++;
      console.log(`  📰 created [${art.category}] ${art.title}`);
    }
  }

  // 4) Remove AI filler (seed.js used picsum.photos for every filler image) --
  let removed = 0;
  if (!KEEP_FILLER) {
    const fillerQuery = { 'ogImage.url': /picsum\.photos/i };
    removed = await Article.countDocuments(fillerQuery);
    if (!DRY && removed > 0) await Article.deleteMany(fillerQuery);
    console.log(`  🗑️  ${DRY ? 'would remove' : 'removed'} ${removed} filler article(s)`);
  }

  // update author article counts
  if (!DRY) {
    for (const user of Object.values(userByKey)) {
      const count = await Article.countDocuments({ author: user._id, status: 'published' });
      await User.updateOne({ _id: user._id }, { $set: { articlesCount: count } });
    }
  }

  console.log('\n✅ Done.');
  console.log(`   authors: ${Object.keys(AUTHORS).length}`);
  console.log(`   articles created: ${created}, updated: ${updated}`);
  console.log(`   filler removed: ${removed}`);
  if (DRY) console.log('   (dry run — no writes performed)');

  await mongoose.connection.close();
  process.exit(0);
})().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
