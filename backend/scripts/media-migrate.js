'use strict';

/**
 * Move every picture off Cloudinary onto Cloudflare R2 without losing track of
 * where a single one of them belongs.
 *
 * A picture is tied to the site by nothing but a string — a URL or a Cloudinary
 * public_id — written into some document: an article's cover (ogImage), its
 * gallery, an <img> inside its body HTML, a writer's avatar, a category's
 * image, a push notification. So the inventory does not trust the Mongoose
 * schemas to say where those strings are. It reads every string of every
 * document in every collection and records each Cloudinary reference with the
 * exact document and field path it was found at. That record is what lets each
 * picture land back in exactly the place it came from.
 *
 * Cloudinary's own listing is the other half: every file the account holds,
 * attached to something or not. Joining the two gives three lists — pictures in
 * use, pictures nothing points at (media-library uploads never placed), and
 * references to files Cloudinary no longer has.
 *
 * ── Steps so far ────────────────────────────────────────────────────────────
 * All read-only: nothing at Cloudinary or in MongoDB is written, moved or
 * deleted. Output lands in backend/backup/r2-migration/ (gitignored, like the
 * rest of backend/backup/).
 *
 *   node scripts/media-migrate.js assets       list every file Cloudinary holds
 *   node scripts/media-migrate.js backup       download every original, verified
 *   railway run --service backend node scripts/media-migrate.js inventory
 *                                              find where each one is used
 *
 * `assets` and `backup` need only the Cloudinary keys; `inventory` needs the
 * production MONGODB_URI as well, which `railway run` injects without anyone
 * having to read it. Re-running any step resumes rather than redoing work.
 *
 * --out=<dir> writes somewhere else (for trying `inventory` against a local DB
 * without overwriting the production inventory).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const config = require('../src/config/env');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const OUT = path.resolve(arg('out') || path.join(__dirname, '..', 'backup', 'r2-migration'));
const ASSETS = path.join(OUT, 'cloudinary-assets.json');
const INVENTORY = path.join(OUT, 'inventory.json');
const CSV = path.join(OUT, 'where-every-picture-belongs.csv');
const SUMMARY = path.join(OUT, 'summary.txt');
// The originals are the same files whichever database is being inventoried,
// so they always live in the one place.
const ORIGINALS = path.join(__dirname, '..', 'backup', 'r2-migration', 'originals');
const ORIGINALS_INDEX = path.join(__dirname, '..', 'backup', 'r2-migration', 'originals.json');
// The backup cloudinary-prune-derived.js took on 2026-09-18. A file that is
// still the same version at Cloudinary is copied from there, not downloaded.
const OLD_BACKUP = path.join(__dirname, '..', 'backup', 'cloudinary-originals');

const SITE = 'https://al-telegraph.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Write-then-rename, so an interrupted run never leaves half a file. */
const writeFileAtomic = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, data);
  fs.renameSync(`${file}.tmp`, file);
};
const writeJson = (file, data) => writeFileAtomic(file, JSON.stringify(data, null, 2));

/** Run fn over items, n at a time. */
const pool = async (items, n, fn) => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
};

const requireCloudinary = () => {
  if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
    throw new Error('Cloudinary credentials not set (CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET).');
  }
};

// ── assets: every file the Cloudinary account holds ─────────────────────────

// Every new Cloudinary account is seeded with these. They are Cloudinary's
// pictures, not the paper's; the inventory says whether anything uses one.
const isDemo = (publicId) => /^(samples\/|cld-sample(-\d+)?$|main-sample$|sample$)/.test(publicId);

const assetKey = (resourceType, type, publicId) => `${resourceType}/${type}/${publicId}`;

// The media library uploads with resource_type 'auto', so video is possible
// and so is raw; the 2026-09-18 backup listed images only.
const RESOURCE_TYPES = ['image', 'video', 'raw'];
const DELIVERY_TYPES = ['upload', 'private', 'authenticated'];

const listAssets = async () => {
  const all = [];
  for (const resourceType of RESOURCE_TYPES) {
    for (const type of DELIVERY_TYPES) {
      let cursor;
      do {
        const res = await cloudinary.api.resources({
          resource_type: resourceType,
          type,
          max_results: 500,
          next_cursor: cursor,
        });
        all.push(...(res.resources || []));
        cursor = res.next_cursor;
        process.stdout.write(`\r  listed ${all.length} files…`);
        await sleep(150);
      } while (cursor);
    }
  }
  process.stdout.write('\n');
  return all.map((r) => ({
    key: assetKey(r.resource_type, r.type, r.public_id),
    public_id: r.public_id,
    resource_type: r.resource_type,
    type: r.type,
    format: r.format || null,
    bytes: r.bytes,
    width: r.width || null,
    height: r.height || null,
    created_at: r.created_at,
    version: r.version,
    secure_url: r.secure_url,
    etag: r.etag || null,
    demo: isDemo(r.public_id),
  }));
};

const folderOf = (publicId) => {
  const parts = publicId.split('/');
  return parts.length > 2 ? parts.slice(0, 2).join('/') : parts.length === 2 ? parts[0] : '(root)';
};

const runAssets = async () => {
  requireCloudinary();
  console.log(`Cloudinary account: ${config.cloudinary.cloudName}`);
  const assets = await listAssets();
  writeJson(ASSETS, { listedAt: new Date().toISOString(), cloudName: config.cloudinary.cloudName, assets });

  const byFolder = new Map();
  for (const a of assets) {
    const k = `${a.resource_type.padEnd(5)} ${a.type.padEnd(13)} ${folderOf(a.public_id)}`;
    const cur = byFolder.get(k) || { n: 0, bytes: 0 };
    cur.n += 1;
    cur.bytes += a.bytes;
    byFolder.set(k, cur);
  }
  const total = assets.reduce((s, a) => s + a.bytes, 0);
  console.log(`\n${assets.length} files, ${mb(total)}:`);
  for (const [k, v] of [...byFolder].sort((x, y) => y[1].n - x[1].n)) {
    console.log(`  ${k.padEnd(48)} ${String(v.n).padStart(6)}  ${mb(v.bytes).padStart(10)}`);
  }
  console.log(`\n  ${ASSETS}`);
  return assets;
};

// ── backup: every original, on this disk, verified ──────────────────────────

/** Images and video keep their format outside the public_id; raw files carry it inside. */
const fileNameOf = (a) => (a.resource_type === 'raw' || !a.format ? a.public_id : `${a.public_id}.${a.format}`);
/** A public_id is a path; never let one climb out of the backup folder. */
const safeRel = (rel) => rel.split('/').map((s) => (s === '' || s === '.' || s === '..' ? '_' : s)).join('/');
const oldBackupName = (a) => `${a.public_id.replace(/[/\\]/g, '__')}.${a.format || 'bin'}`;

const originalUrl = (a) => (a.type === 'upload'
  ? a.secure_url
  : cloudinary.utils.private_download_url(a.public_id, a.format, { resource_type: a.resource_type, type: a.type }));

const download = async (url, attempts = 4) => {
  for (let i = 1; ; i += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i >= attempts) throw err;
      await sleep(1000 * 2 ** i);
    } finally {
      clearTimeout(timer);
    }
  }
};

const runBackup = async () => {
  if (!fs.existsSync(ASSETS)) throw new Error('No asset list yet — run `assets` (or `inventory`) first.');
  const { assets, listedAt } = readJson(ASSETS);
  const files = fs.existsSync(ORIGINALS_INDEX) ? readJson(ORIGINALS_INDEX).files : {};

  const oldManifest = path.join(OLD_BACKUP, 'manifest.json');
  const oldByUrl = new Map(
    fs.existsSync(oldManifest) ? readJson(oldManifest).originals.map((o) => [o.url, o]) : []
  );

  const counts = { kept: 0, copied: 0, downloaded: 0 };
  const failed = [];
  let done = 0;
  let newBytes = 0;

  console.log(`Backing up ${assets.length} originals (list taken ${listedAt}) into\n  ${ORIGINALS}\n`);

  await pool(assets, 6, async (a) => {
    const rel = safeRel(fileNameOf(a));
    const dest = path.join(ORIGINALS, rel);
    try {
      const prev = files[a.key];
      if (prev && prev.bytes === a.bytes && prev.version === a.version
        && fs.existsSync(dest) && fs.statSync(dest).size === a.bytes) {
        counts.kept += 1;
        return;
      }

      // Same URL means same version: the file has not been replaced since.
      let buf;
      let source;
      const old = oldByUrl.get(a.secure_url);
      const oldFile = old && path.join(OLD_BACKUP, old.file || oldBackupName(a));
      if (oldFile && fs.existsSync(oldFile) && fs.statSync(oldFile).size === a.bytes) {
        buf = fs.readFileSync(oldFile);
        source = 'backup-2026-09-18';
      } else {
        buf = await download(originalUrl(a));
        source = 'cloudinary';
        newBytes += buf.length;
      }

      if (buf.length !== a.bytes) throw new Error(`got ${buf.length} bytes, Cloudinary says ${a.bytes}`);
      const hash = md5(buf);
      if (a.etag && a.etag.replace(/"/g, '') !== hash) throw new Error(`md5 ${hash} ≠ Cloudinary etag ${a.etag}`);

      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      files[a.key] = { file: rel, bytes: buf.length, version: a.version, sha256: sha256(buf), md5: hash, source };
      counts[source === 'cloudinary' ? 'downloaded' : 'copied'] += 1;
    } catch (err) {
      failed.push({ key: a.key, error: err.message });
    } finally {
      done += 1;
      if (done % 10 === 0 || done === assets.length) process.stdout.write(`\r  ${done}/${assets.length}…`);
      if (done % 100 === 0) writeJson(ORIGINALS_INDEX, { updatedAt: new Date().toISOString(), listedAt, files });
    }
  });
  process.stdout.write('\n');
  writeJson(ORIGINALS_INDEX, { updatedAt: new Date().toISOString(), listedAt, files });

  // Prove it: every listed original has a file of exactly the right size.
  const missing = assets.filter((a) => {
    const f = files[a.key];
    const p = f && path.join(ORIGINALS, f.file);
    return !f || !fs.existsSync(p) || fs.statSync(p).size !== a.bytes;
  });
  const total = assets.reduce((s, a) => s + a.bytes, 0);

  console.log(`\n${counts.downloaded} downloaded (${mb(newBytes)}), ${counts.copied} copied from the 2026-09-18 backup, ${counts.kept} already here.`);
  if (failed.length) {
    console.log(`\n✗ ${failed.length} failed:`);
    failed.slice(0, 30).forEach((f) => console.log(`  ${f.key} — ${f.error}`));
  }
  if (missing.length) {
    console.log(`\n✗ ${missing.length} of ${assets.length} originals are NOT safely on disk. Re-run backup.`);
    process.exitCode = 1;
  } else {
    console.log(`\n✓ All ${assets.length} originals on disk, every one the exact size Cloudinary reports (${mb(total)}).`);
  }
};

// ── inventory: where every picture is used ──────────────────────────────────

const CLOUDINARY_REF = /(?:https?:)?\/\/(?:[a-z0-9-]+\.)*cloudinary\.com\/[^\s"'<>()\\]+/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;
const ATTR = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const VERSION = /^v\d+$/;
const TRANSFORM = /^[a-z]{1,4}_[^/]*$/;

const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * Every Cloudinary URL inside a string, each with where it sits when the
 * string is HTML — `img[src]`, `img[data-full]`, `a[href]` — or `text`.
 */
const urlsIn = (s) => {
  const found = [...s.matchAll(CLOUDINARY_REF)].map((m) => ({ raw: m[0], at: m.index, context: null }));
  if (!found.length || !s.includes('<')) return found;

  const ranges = [];
  for (const tag of s.matchAll(TAG)) {
    for (const attr of tag[0].matchAll(ATTR)) {
      const value = attr[2] ?? attr[3] ?? '';
      const q = attr[0].search(/["']/);
      const start = tag.index + attr.index + q + 1;
      ranges.push({ start, end: start + value.length, name: `${tag[1].toLowerCase()}[${attr[1].toLowerCase()}]` });
    }
  }
  for (const f of found) {
    const r = ranges.find((x) => f.at >= x.start && f.at < x.end);
    f.context = r ? r.name : 'text';
  }
  return found;
};

/**
 * Resolve a delivery URL to the file it serves. The path after the delivery
 * type is [transformations…]/[v<version>]/<public_id>[.<ext>]; rather than
 * guess where the transformations stop, try each split against the real list
 * of public_ids. Unresolved URLs come back with a best guess and a reason.
 */
const resolveUrl = (rawUrl, index, cloudName) => {
  const raw = rawUrl.replace(/[.,;:!?]+$/, '');
  let url;
  try {
    url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
  } catch {
    return { raw, problem: 'not a parseable URL' };
  }
  if (!/^(res(-\d+)?\.cloudinary\.com|[a-z0-9-]+-res\.cloudinary\.com)$/.test(url.hostname)) {
    return { raw, problem: `not a Cloudinary file URL (${url.hostname})` };
  }
  const [cloud, resourceType, type, ...rest] = url.pathname.split('/').filter(Boolean).map(safeDecode);
  if (cloud !== cloudName) return { raw, problem: `belongs to a different Cloudinary account (${cloud})` };

  for (let i = 0; i < rest.length; i += 1) {
    let tail = rest.slice(i);
    if (VERSION.test(tail[0])) tail = tail.slice(1);
    if (!tail.length) continue;
    const joined = tail.join('/');
    for (const candidate of [joined, joined.replace(/\.[a-z0-9]{2,5}$/i, '')]) {
      const asset = index.get(assetKey(resourceType, type, candidate));
      if (asset) {
        const transformation = rest.slice(0, i).filter((s) => !VERSION.test(s)).join('/') || null;
        return { raw, asset, transformation };
      }
    }
  }

  let lead = 0;
  while (lead < rest.length - 1 && (VERSION.test(rest[lead]) || TRANSFORM.test(rest[lead]))) lead += 1;
  const guess = rest.slice(lead).join('/').replace(/\.[a-z0-9]{2,5}$/i, '');
  return { raw, guess: `${resourceType}/${type}/${guess}`, problem: 'file not found at Cloudinary' };
};

/** Plain words for a field path: what a reader of the CSV sees. */
const describe = (collection, field, context, nth) => {
  const p = field;
  switch (collection) {
    case 'articles':
      if (/^ogImage\.(url|publicId)$/.test(p)) return 'article cover photo';
      if (/^gallery\.\d+\./.test(p)) return `article gallery photo #${Number(p.split('.')[1]) + 1}`;
      if (p === 'content') return `picture #${nth} inside the article text (${context})`;
      if (p.startsWith('submission')) return `kept with the reader submission (${p})`;
      return `article field ${p}`;
    case 'users':
      return /^avatar\.(url|publicId)$/.test(p) ? 'profile photo' : `user field ${p}`;
    case 'categories':
      if (/^image\.url$/.test(p)) return 'category image';
      if (p === 'icon') return 'category icon';
      return `category field ${p}`;
    case 'notifications':
      return `push notification ${p}`;
    case 'audit_logs':
      return `audit log, history only (${p})`;
    case 'siteconfigs':
      return `site setting ${p}`;
    default:
      return `${collection} ${p}`;
  }
};

const labelFor = (collection, doc, categories) => {
  switch (collection) {
    case 'articles': {
      const cat = categories.get(String(doc.category));
      return {
        label: oneLine(doc.title),
        status: doc.status || '',
        link: doc.slug && doc.status === 'published' ? `${SITE}/article/${cat ? cat.slug : 'uncategorized'}/${doc.slug}` : '',
      };
    }
    case 'users':
      return {
        label: oneLine(doc.name),
        status: doc.isActive === false ? 'inactive' : doc.isProfileOnly ? 'writer profile' : doc.role || '',
        link: doc.slug ? `${SITE}/author/${doc.slug}` : '',
      };
    case 'categories':
      return {
        label: oneLine(doc.name),
        status: doc.isActive === false ? 'inactive' : 'active',
        link: doc.slug ? `${SITE}/category/${doc.slug}` : '',
      };
    default:
      return { label: oneLine(doc.title || doc.name || doc.key || ''), status: oneLine(doc.status || doc.type || ''), link: '' };
  }
};

const isWalkable = (v) => v && typeof v === 'object' && !(v instanceof Date) && !v._bsontype && !Buffer.isBuffer(v);

const walk = (value, keyPath, visit) => {
  if (typeof value === 'string') {
    visit(value, keyPath);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, [...keyPath, i], visit));
  } else if (isWalkable(value)) {
    for (const [k, v] of Object.entries(value)) walk(v, [...keyPath, k], visit);
  }
};

const hostOf = (uri) => (String(uri).match(/^[^:]+:\/\/(?:[^@/]*@)?([^/?]+)/) || [])[1] || '(unknown host)';

/**
 * What is known about each file without Cloudinary's listing (see rescue):
 * the 2026-09-18 backup manifest, and every original saved since.
 */
const knownAssets = () => {
  const index = new Map();
  const oldManifest = path.join(OLD_BACKUP, 'manifest.json');
  if (fs.existsSync(oldManifest)) {
    for (const o of readJson(oldManifest).originals) {
      const key = assetKey('image', 'upload', o.public_id);
      index.set(key, {
        key, public_id: o.public_id, resource_type: 'image', type: 'upload', format: o.format, bytes: o.bytes,
        width: null, height: null, secure_url: o.url, demo: isDemo(o.public_id),
      });
    }
  }
  const saved = fs.existsSync(ORIGINALS_INDEX) ? readJson(ORIGINALS_INDEX).files : {};
  for (const [key, f] of Object.entries(saved)) {
    if (index.has(key)) continue;
    const [resourceType, type, ...rest] = key.split('/');
    const publicId = rest.join('/');
    index.set(key, {
      key, public_id: publicId, resource_type: resourceType, type, format: path.extname(f.file).slice(1) || null,
      bytes: f.bytes, width: null, height: null, secure_url: f.from || null, demo: isDemo(publicId),
    });
  }
  return index;
};

const runInventory = async () => {
  // Prefer Cloudinary's own listing; since 2026-10-31 it answers "disabled
  // account", so fall back to what the backups know and to the URLs themselves.
  let index;
  let listing = 'Cloudinary listing';
  try {
    requireCloudinary();
    index = new Map((await runAssets()).map((a) => [a.key, a]));
  } catch (err) {
    listing = '2026-09-18 backup + copies saved since';
    const why = (err && (err.message || (err.error && err.error.message))) || String(err);
    console.log(`Cloudinary listing unavailable (${why}) — resolving from backups and URLs instead.`);
    index = knownAssets();
  }
  const byPublicId = new Map();
  for (const a of index.values()) {
    byPublicId.set(a.public_id, a);
    if (a.format) byPublicId.set(`${a.public_id}.${a.format}`, a);
  }
  /** Resolve against what is known, else take the URL's own word for its file. */
  const resolveAny = (raw) => {
    const hit = resolveUrl(raw, index, config.cloudinary.cloudName || 'nz1gfsdt');
    if (hit.asset || !/file not found/.test(hit.problem || '')) return hit;
    const p = parseDelivery(raw);
    if (!p) return hit;
    const asset = {
      key: p.key, public_id: p.publicId, resource_type: p.resourceType, type: p.type, format: p.ext,
      bytes: 0, width: null, height: null, secure_url: deliveryUrl(p), demo: isDemo(p.publicId), unlisted: true,
    };
    index.set(p.key, asset);
    byPublicId.set(p.publicId, asset);
    return { raw: hit.raw, asset, transformation: p.transformation };
  };
  const assetsList = () => [...index.values()];

  await mongoose.connect(config.mongodb.uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  console.log(`\nMongoDB: ${hostOf(config.mongodb.uri)} / ${db.databaseName}`);

  const categories = new Map(
    (await db.collection('categories').find({}, { projection: { slug: 1, name: 1 } }).toArray())
      .map((c) => [String(c._id), c])
  );

  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .filter((c) => c.type !== 'view' && !c.name.startsWith('system.'))
    .map((c) => c.name)
    .sort();

  const references = [];
  const scanned = {};

  for (const name of collections) {
    let docs = 0;
    const started = Date.now();
    for await (const doc of db.collection(name).find({}, { batchSize: 500 })) {
      docs += 1;
      const found = [];
      walk(doc, [], (value, keyPath) => {
        const field = keyPath.join('.');
        const key = keyPath[keyPath.length - 1];

        if (value.includes('cloudinary.com')) {
          for (const u of urlsIn(value)) found.push({ field, context: u.context, kind: 'url', ...resolveAny(u.raw) });
          return;
        }
        // A bare public_id: stored beside a URL (ogImage.publicId), on its own,
        // or as the audit trail of a media-library upload.
        const mediaUpload = name === 'audit_logs' && key === 'resourceId' && doc.action === 'media.upload';
        if (value && (key === 'publicId' || key === 'public_id' || mediaUpload || byPublicId.has(value))) {
          const asset = byPublicId.get(value);
          found.push({ field, context: null, kind: 'publicId', raw: value, asset, problem: asset ? null : 'file not found at Cloudinary' });
        }
      });
      if (!found.length) continue;

      const who = labelFor(name, doc, categories);
      const nth = new Map();
      for (const f of found) {
        const assetK = f.asset ? f.asset.key : f.guess || null;
        if (f.field === 'content' && assetK && !nth.has(assetK)) nth.set(assetK, nth.size + 1);
        references.push({
          collection: name,
          docId: String(doc._id),
          ...who,
          field: f.field,
          where: describe(name, f.field, f.context, nth.get(assetK)),
          context: f.context,
          kind: f.kind,
          value: f.raw,
          assetKey: f.asset ? f.asset.key : null,
          guess: f.asset ? null : f.guess || null,
          transformation: f.transformation || null,
          problem: f.problem || null,
        });
      }
    }
    scanned[name] = docs;
    console.log(`  scanned ${name.padEnd(22)} ${String(docs).padStart(7)} docs  ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
  await mongoose.disconnect();

  // Join.
  const used = new Map();
  for (const r of references) if (r.assetKey) used.set(r.assetKey, (used.get(r.assetKey) || 0) + 1);
  const assets = assetsList();
  const orphans = assets.filter((a) => !used.has(a.key));
  const broken = references.filter((r) => r.problem);

  const inventory = {
    generatedAt: new Date().toISOString(),
    mongo: `${hostOf(config.mongodb.uri)}/${db.databaseName}`,
    cloudName: config.cloudinary.cloudName,
    listing,
    scanned,
    assets: assets.map((a) => ({ ...a, refs: used.get(a.key) || 0 })),
    references,
    orphans: orphans.map((a) => a.key),
  };
  writeJson(INVENTORY, inventory);
  writeCsv(inventory, index);
  writeSummary(inventory, index, broken);
  console.log(`\n${fs.readFileSync(SUMMARY, 'utf8')}`);
  console.log(`  ${INVENTORY}\n  ${CSV}\n  ${SUMMARY}`);
};

// ── rescue: whatever the CDN still holds ────────────────────────────────────
//
// On 2026-10-31 at 18:06 UTC Cloudinary began answering "Unknown customer
// nz1gfsdt". The Admin API refuses every call, so `assets` can list nothing,
// and any rendition its CDN is not already holding comes back 401. What the
// CDN does hold keeps serving until it ages out — so this cannot wait for a
// listing that will never come. It works from the published site instead:
// every published article, writer and category through the public API,
// exactly what a reader can see. It records where each picture appears and
// saves every original it can still get. A picture whose original is gone
// falls back to the largest rendition the site itself asked for, which the
// CDN may still hold; those are marked degraded.

const PUBLIC_API = 'https://api.al-telegraph.com/api/v1';
const PUBLISHED = path.join(OUT, 'published-site.json');
const PUBLISHED_CSV = path.join(OUT, 'published-site.csv');

const isTransformSeg = (s) => s.split(',').every((p) => /^[a-z]{1,4}_[^,]+$/.test(p));

/** Split a delivery URL without Cloudinary's listing to check it against. */
const parseDelivery = (rawUrl) => {
  const raw = rawUrl.replace(/[.,;:!?]+$/, '');
  let url;
  try {
    url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
  } catch {
    return null;
  }
  if (!/^(res(-\d+)?\.cloudinary\.com|[a-z0-9-]+-res\.cloudinary\.com)$/.test(url.hostname)) return null;
  const [cloud, resourceType, type, ...rest] = url.pathname.split('/').filter(Boolean).map(safeDecode);
  if (!rest.length) return null;
  const transforms = [];
  let version = null;
  let i = 0;
  while (i < rest.length - 1 && (VERSION.test(rest[i]) || isTransformSeg(rest[i]))) {
    if (VERSION.test(rest[i])) version = rest[i];
    else transforms.push(rest[i]);
    i += 1;
  }
  const tail = rest.slice(i).join('/');
  const m = resourceType !== 'raw' && tail.match(/^(.*)\.([a-z0-9]{2,5})$/i);
  const publicId = m ? m[1] : tail;
  return {
    raw,
    cloud,
    resourceType,
    type,
    transformation: transforms.join('/') || null,
    version,
    publicId,
    ext: m ? m[2].toLowerCase() : null,
    key: assetKey(resourceType, type, publicId),
  };
};

const deliveryUrl = (p, { transformation = null, version = p.version, ext = p.ext } = {}) => [
  `https://res.cloudinary.com/${p.cloud}/${p.resourceType}/${p.type}`,
  transformation,
  version,
  `${p.publicId.split('/').map(encodeURIComponent).join('/')}${ext ? `.${ext}` : ''}`,
].filter(Boolean).join('/');

/**
 * Every URL this picture may still be cached under, best first: the original,
 * then the exact renditions the site requested — the image loader's widths,
 * the gallery sizes the editor bakes into article HTML, the 1200×630 share
 * card, the face-cropped avatars. A cache hit needs the URL to the character.
 */
const LOADER_WIDTHS = [1920, 1200, 828, 640, 384, 256, 128, 64];
const AVATAR_PX = [256, 192, 144, 128, 112, 96, 88, 80, 72, 64];
const candidatesFor = (p) => {
  // Known only by public_id (no URL anywhere): the cache key is a guess.
  if (p.bare) {
    return [null, 'jpg', 'png', 'jpeg', 'webp'].map((ext) => ({ url: deliveryUrl(p, { version: null, ext }), original: true }));
  }
  const list = [
    { url: p.transformation ? deliveryUrl(p) : p.raw, original: true },
    { url: deliveryUrl(p, { version: null }), original: true },
  ];
  if (p.transformation) list.push({ url: p.raw, original: false });
  for (const w of [2000, 1200]) list.push({ url: deliveryUrl(p, { transformation: `f_webp,q_auto,c_limit,w_${w}` }) });
  for (const w of LOADER_WIDTHS) list.push({ url: deliveryUrl(p, { transformation: `f_webp,q_auto:eco,c_limit,w_${w}` }) });
  list.push({ url: deliveryUrl(p, { transformation: 'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630', ext: 'jpg' }) });
  for (const px of AVATAR_PX) {
    list.push({ url: deliveryUrl(p, { transformation: `f_webp,q_auto,c_fill,g_face,w_${px},h_${px}` }) });
    list.push({ url: deliveryUrl(p, { transformation: `f_webp,q_auto,c_fill,g_face,w_${px},h_${Math.round(px * 4 / 3)}` }) });
  }
  const seen = new Set();
  return list.filter((c) => !seen.has(c.url) && seen.add(c.url)).map((c) => ({ original: false, ...c }));
};

const EXT_OF = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4' };

/** One GET, no retries for a 401/404 — those are answers, not hiccups. */
const tryFetch = async (url) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.status === 401 || res.status === 404 || res.status === 400) return { ok: false, status: res.status };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get('content-type') || '').split(';')[0].trim();
      return { ok: true, type, buf: Buffer.from(await res.arrayBuffer()) };
    } catch (err) {
      if (attempt === 3) return { ok: false, status: err.message };
      await sleep(1500 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 'unreachable' };
};

let lastApiCall = 0;
const apiGet = async (pathname) => {
  for (let attempt = 1; ; attempt += 1) {
    // The public limiter allows 100 requests a minute per IP; stay under it.
    const wait = lastApiCall + 700 - Date.now();
    if (wait > 0) await sleep(wait);
    lastApiCall = Date.now();
    const res = await fetch(`${PUBLIC_API}${pathname}`, { headers: { Accept: 'application/json' } });
    if (res.status === 429) {
      await sleep(61000);
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 404 || attempt >= 4) throw new Error(`${pathname}: HTTP ${res.status}`);
    await sleep(2000 * attempt);
  }
};

const runRescue = async () => {
  const files = fs.existsSync(ORIGINALS_INDEX) ? readJson(ORIGINALS_INDEX).files : {};
  const saveIndex = () => writeJson(ORIGINALS_INDEX, { updatedAt: new Date().toISOString(), files });
  const oldManifest = path.join(OLD_BACKUP, 'manifest.json');
  const oldById = new Map(
    fs.existsSync(oldManifest) ? readJson(oldManifest).originals.map((o) => [o.public_id, o]) : []
  );

  const refs = [];
  const seenRef = new Set();
  const pictures = new Map(); // key → parsed delivery URL of its first sighting

  const record = (owner, field, value, context, where) => {
    for (const u of value.includes('<') ? urlsIn(value) : [...value.matchAll(CLOUDINARY_REF)].map((m) => ({ raw: m[0], context: null }))) {
      const p = parseDelivery(u.raw);
      const k = `${owner.type}|${owner.id}|${field}|${u.raw}`;
      if (seenRef.has(k)) continue;
      seenRef.add(k);
      if (p && !pictures.has(p.key)) pictures.set(p.key, p);
      refs.push({ owner, field, context: u.context || context || null, where, url: u.raw, key: p ? p.key : null });
    }
  };

  const ownerOfUser = (u) => ({ type: 'user', id: String(u._id), name: oneLine(u.name), link: u.slug ? `${SITE}/author/${u.slug}` : '' });
  const recordAvatar = (u) => {
    const url = u && u.avatar && (typeof u.avatar === 'string' ? u.avatar : u.avatar.url);
    if (url) record(ownerOfUser(u), 'avatar.url', url, null, 'profile photo');
  };

  // Save every picture not yet saved: the 2026-09-18 copy if it is the same
  // version, else the CDN, else an older copy rather than none.
  const tried = new Set();
  const saveAll = async (label) => {
    const todo = [...pictures.values()].filter((p) => !files[p.key] && !tried.has(p.key));
    if (!todo.length) return;
    let done = 0;
    await pool(todo, 8, async (p) => {
      tried.add(p.key);
      try {
        const old = oldById.get(p.publicId);
        const sameVersion = old && (!p.version || old.url.includes(`/${p.version}/`));
        const oldFile = old && path.join(OLD_BACKUP, old.file || oldBackupName({ public_id: p.publicId, format: old.format }));
        if (sameVersion && fs.existsSync(oldFile) && fs.statSync(oldFile).size === old.bytes) {
          const buf = fs.readFileSync(oldFile);
          const rel = safeRel(`${p.publicId}.${old.format}`);
          fs.mkdirSync(path.dirname(path.join(ORIGINALS, rel)), { recursive: true });
          fs.writeFileSync(path.join(ORIGINALS, rel), buf);
          files[p.key] = { file: rel, bytes: buf.length, sha256: sha256(buf), md5: md5(buf), source: 'backup-2026-09-18', degraded: false, version: p.version };
          return;
        }
        for (const c of candidatesFor(p)) {
          const got = await tryFetch(c.url);
          if (!got.ok || !got.buf.length) continue;
          const ext = (c.original && p.ext) || EXT_OF[got.type] || 'bin';
          const rel = safeRel(`${p.publicId}.${ext}`);
          fs.mkdirSync(path.dirname(path.join(ORIGINALS, rel)), { recursive: true });
          fs.writeFileSync(path.join(ORIGINALS, rel), got.buf);
          files[p.key] = {
            file: rel, bytes: got.buf.length, sha256: sha256(got.buf), md5: md5(got.buf), contentType: got.type,
            source: 'cloudinary-cdn', from: c.url, degraded: !c.original, version: p.version,
          };
          return;
        }
        // Nothing left at the CDN; an older copy beats none.
        if (old && fs.existsSync(oldFile) && fs.statSync(oldFile).size === old.bytes) {
          const buf = fs.readFileSync(oldFile);
          const rel = safeRel(`${p.publicId}.${old.format}`);
          fs.mkdirSync(path.dirname(path.join(ORIGINALS, rel)), { recursive: true });
          fs.writeFileSync(path.join(ORIGINALS, rel), buf);
          files[p.key] = { file: rel, bytes: buf.length, sha256: sha256(buf), md5: md5(buf), source: 'backup-2026-09-18', degraded: false, olderVersion: true, version: p.version };
        }
      } finally {
        done += 1;
        if (done % 10 === 0 || done === todo.length) process.stdout.write(`\r  ${label}: ${done}/${todo.length}…`);
        if (done % 50 === 0) saveIndex();
      }
    });
    process.stdout.write('\n');
    saveIndex();
  };

  if (process.argv.includes('--from-inventory')) {
    // The database sees what the public API cannot: drafts, the review queue,
    // scheduled articles, inactive writers, notifications.
    if (!fs.existsSync(INVENTORY)) throw new Error('No inventory yet — run `inventory` first.');
    const inv = readJson(INVENTORY);
    for (const r of inv.references) {
      const p = r.kind === 'url' ? parseDelivery(r.value) : null;
      if (p && !pictures.has(p.key)) pictures.set(p.key, p);
    }
    for (const r of inv.references) {
      if (r.kind !== 'publicId' || !r.assetKey || pictures.has(r.assetKey)) continue;
      const [resourceType, type, ...rest] = r.assetKey.split('/');
      pictures.set(r.assetKey, {
        raw: null, cloud: config.cloudinary.cloudName || 'nz1gfsdt', resourceType, type,
        transformation: null, version: null, publicId: rest.join('/'), ext: null, key: r.assetKey, bare: true,
      });
    }
    await saveAll('pictures the database refers to');
    const all = [...pictures.values()];
    const lost = all.filter((x) => !files[x.key]);
    console.log(`\n${all.length} pictures referenced in the database: ${all.length - lost.length} saved, ${lost.length} could not be saved.`);
    lost.slice(0, 40).forEach((x) => console.log(`  ✗ ${x.key}`));
    return;
  }

  // 1. Categories and writers.
  const catRes = await apiGet('/categories');
  const catWalk = (list) => (list || []).forEach((c) => {
    const owner = { type: 'category', id: String(c._id), name: oneLine(c.name), link: c.slug ? `${SITE}/category/${c.slug}` : '' };
    if (c.image && c.image.url) record(owner, 'image.url', c.image.url, null, 'category image');
    if (c.icon && c.icon.includes('cloudinary.com')) record(owner, 'icon', c.icon, null, 'category icon');
    catWalk(c.children || c.subcategories);
  });
  catWalk(Array.isArray(catRes.data) ? catRes.data : catRes.data && catRes.data.categories);
  const authors = (await apiGet('/users/authors')).data || [];
  authors.forEach(recordAvatar);
  console.log(`  ${authors.length} writers, categories read`);

  // 2. Every published article: the list carries cover, gallery and byline.
  const articles = [];
  for (let page = 1; ; page += 1) {
    const res = await apiGet(`/articles?limit=100&page=${page}`);
    articles.push(...(res.data || []));
    process.stdout.write(`\r  listed ${articles.length} published articles…`);
    if (!res.meta || !res.meta.pagination || !res.meta.pagination.hasNext) break;
  }
  process.stdout.write('\n');

  const ownerOfArticle = (a) => ({
    type: 'article',
    id: String(a._id),
    name: oneLine(a.title),
    link: `${SITE}/article/${(a.category && a.category.slug) || 'uncategorized'}/${a.slug}`,
  });
  const recordArticle = (a) => {
    const owner = ownerOfArticle(a);
    if (a.ogImage && a.ogImage.url) record(owner, 'ogImage.url', a.ogImage.url, null, 'article cover photo');
    (a.gallery || []).forEach((g, i) => g && g.url && record(owner, `gallery.${i}.url`, g.url, null, `article gallery photo #${i + 1}`));
    if (typeof a.content === 'string' && a.content.includes('cloudinary.com')) {
      const nth = new Map();
      for (const u of urlsIn(a.content)) {
        const p = parseDelivery(u.raw);
        const k = p ? p.key : u.raw;
        if (!nth.has(k)) nth.set(k, nth.size + 1);
        record(owner, 'content', u.raw, u.context, `picture #${nth.get(k)} inside the article text (${u.context})`);
      }
    }
    recordAvatar(a.author);
    (a.coAuthors || []).forEach(recordAvatar);
  };
  articles.forEach(recordArticle);

  await saveAll('covers, galleries, profile photos');

  // 4. Article bodies — one request each, at the public rate limit.
  let n = 0;
  for (const a of articles) {
    n += 1;
    try {
      const res = await apiGet(`/articles/${encodeURIComponent(a.slug)}`);
      const full = res.data && (res.data.article || res.data);
      if (full) recordArticle({ ...full, category: full.category || a.category });
    } catch (err) {
      console.log(`\n  ✗ ${a.slug}: ${err.message}`);
    }
    if (n % 10 === 0 || n === articles.length) process.stdout.write(`\r  read ${n}/${articles.length} article bodies…`);
    if (n % 200 === 0) await saveAll(`pictures found so far`);
  }
  process.stdout.write('\n');
  await saveAll('pictures inside article text');

  // 5. Report.
  const report = {
    crawledAt: new Date().toISOString(),
    articles: articles.length,
    writers: authors.length,
    references: refs,
    pictures: [...pictures.values()].map((p) => ({ key: p.key, publicId: p.publicId, ext: p.ext, version: p.version, saved: files[p.key] || null })),
  };
  writeJson(PUBLISHED, report);

  const header = ['picture', 'where it appears', 'on', 'page', 'field', 'saved as', 'saved from', 'current URL'];
  const rows = refs.map((r) => {
    const f = r.key && files[r.key];
    const from = !f ? 'NOT SAVED — gone from Cloudinary'
      : f.source === 'backup-2026-09-18' ? `backup of 2026-09-18${f.olderVersion ? ' (older version)' : ''}`
        : f.degraded ? `Cloudinary CDN — resized copy only (${f.from.split('/upload/')[1].split('/')[0]})` : 'Cloudinary CDN — original';
    return [r.key ? r.key.split('/').slice(2).join('/') : r.url, r.where, r.owner.name, r.owner.link, r.field, f ? f.file : '', from, r.url];
  });
  writeFileAtomic(PUBLISHED_CSV, `﻿${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`);

  const pics = report.pictures;
  const saved = pics.filter((p) => p.saved);
  const lost = pics.filter((p) => !p.saved);
  const degraded = saved.filter((p) => p.saved.degraded);
  const fromBackup = saved.filter((p) => p.saved.source === 'backup-2026-09-18');
  console.log(`\nPublished site: ${articles.length} articles, ${authors.length} writers, ${refs.length} picture placements, ${pics.length} distinct pictures.`);
  console.log(`  saved original:       ${saved.length - degraded.length}  (${fromBackup.length} from the 2026-09-18 backup, ${saved.length - degraded.length - fromBackup.length} from the CDN)`);
  console.log(`  saved resized only:   ${degraded.length}`);
  console.log(`  could not be saved:   ${lost.length}`);
  lost.slice(0, 25).forEach((p) => console.log(`    ✗ ${p.publicId}`));
  console.log(`\n  ${PUBLISHED}\n  ${PUBLISHED_CSV}`);
};

// ── upload: every original and every rendition onto R2 ──────────────────────
//
// R2 cannot resize, so each picture goes up as its original plus the fixed
// renditions in src/services/mediaVariants.js — the same module the upload
// route renders with, so migrated and new pictures come out alike. Keys keep
// the Cloudinary public_id (<publicId>.<ext>, r/<variant>/<publicId>.webp),
// which makes the later database rewrite a pure function of the old URL.
//
// A ledger records each finished picture, so a re-run (after a dropped
// connection, say) picks up where it stopped rather than starting again.

const LEDGER = path.join(__dirname, '..', 'backup', 'r2-migration', 'r2-ledger.json');
const IMMUTABLE = 'public, max-age=31536000, immutable';

const r2Client = () => {
  const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`R2 is not configured (${missing.join(', ')}). Run under: railway run --service backend node scripts/media-migrate.js …`);
  }
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
};

const runUpload = async () => {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const mv = require('../src/services/mediaVariants');
  const s3 = r2Client();
  const Bucket = process.env.R2_BUCKET;

  // Everything the site uses (originals.json), plus the media-library uploads
  // nothing uses yet, which only the 2026-09-18 backup still holds.
  const files = readJson(ORIGINALS_INDEX).files;
  const work = Object.entries(files).map(([key, f]) => ({
    publicId: key.split('/').slice(2).join('/'),
    file: path.join(ORIGINALS, f.file),
    ext: path.extname(f.file).slice(1).toLowerCase(),
    sha256: f.sha256,
  }));
  const oldManifest = path.join(OLD_BACKUP, 'manifest.json');
  if (fs.existsSync(oldManifest)) {
    for (const o of readJson(oldManifest).originals) {
      if (isDemo(o.public_id) || files[assetKey('image', 'upload', o.public_id)]) continue;
      const file = path.join(OLD_BACKUP, o.file || oldBackupName(o));
      if (fs.existsSync(file)) work.push({ publicId: o.public_id, file, ext: (o.format || 'jpg').toLowerCase(), sha256: null });
    }
  }

  // --limit=N: a few pictures first, to look at on the live domain.
  const limit = parseInt(arg('limit'), 10);
  if (limit > 0) work.splice(limit);

  const ledger = fs.existsSync(LEDGER) ? readJson(LEDGER) : {};
  const put = async (Key, Body, ContentType) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType, CacheControl: IMMUTABLE }));
        return;
      } catch (err) {
        if (attempt >= 4) throw err;
        await sleep(1000 * 2 ** attempt);
      }
    }
  };

  const counts = { uploaded: 0, kept: 0 };
  const failed = [];
  let done = 0;
  let bytesUp = 0;
  console.log(`Uploading ${work.length} pictures to R2 bucket ${Bucket}, each with ${mv.VARIANTS.length} renditions…\n`);

  await pool(work, 3, async (w) => {
    try {
      const buf = fs.readFileSync(w.file);
      const sha = w.sha256 || sha256(buf);
      const prev = ledger[w.publicId];
      if (prev && prev.complete && prev.sha256 === sha) {
        counts.kept += 1;
        return;
      }
      const { info, outputs } = await mv.renderVariants(buf);
      const key = `${w.publicId}.${w.ext}`;
      await put(key, buf, mv.CONTENT_TYPES[w.ext] || 'application/octet-stream');
      await Promise.all(outputs.map((o) => put(mv.variantKey(w.publicId, o.name), o.buffer, o.contentType)));
      ledger[w.publicId] = {
        key,
        bytes: buf.length,
        sha256: sha,
        format: w.ext,
        width: info.width,
        height: info.height,
        variants: outputs.map((o) => mv.variantKey(w.publicId, o.name)),
        complete: true,
        at: new Date().toISOString(),
      };
      bytesUp += buf.length + outputs.reduce((s, o) => s + o.buffer.length, 0);
      counts.uploaded += 1;
    } catch (err) {
      failed.push({ publicId: w.publicId, error: err.message });
    } finally {
      done += 1;
      if (done % 10 === 0 || done === work.length) process.stdout.write(`\r  ${done}/${work.length}…`);
      if (done % 25 === 0) writeJson(LEDGER, ledger);
    }
  });
  process.stdout.write('\n');
  writeJson(LEDGER, ledger);

  console.log(`\n${counts.uploaded} uploaded (${mb(bytesUp)} with renditions), ${counts.kept} already on R2.`);
  if (failed.length) {
    console.log(`\n✗ ${failed.length} failed — re-run to retry:`);
    failed.slice(0, 40).forEach((f) => console.log(`  ${f.publicId} — ${f.error}`));
    process.exitCode = 1;
  } else {
    console.log(`✓ All ${work.length} pictures are on R2 with every rendition.`);
  }
};

// ── rewrite: point every stored reference at R2 ─────────────────────────────
//
// The picture stays where it is; only its address changes. Each Cloudinary
// URL found in a document is replaced in place — a cover's url, a gallery
// entry, every <img src>/data-full/href inside article HTML and inside each of
// its saved revisions — by the R2 address of the same file: the original for
// an untransformed URL, the matching width rendition for a gallery URL baked
// at w_1200/w_2000. publicId fields and data-public-id attributes are already
// correct (every R2 key kept its public_id) and are left alone.
//
// Safety:
//   - only pictures the ledger shows fully on R2 are rewritten; the rest are
//     listed and left exactly as they are
//   - every document's old values are written to rewrite-snapshot.jsonl
//     BEFORE it is changed, and `rollback` puts them back
//   - each update matches on the old values, so an editor saving the same
//     article at that moment is never overwritten; such documents are
//     reported, and a re-run picks them up
//   - --dry plans everything and writes nothing

const SNAPSHOT = path.join(__dirname, '..', 'backup', 'r2-migration', 'rewrite-snapshot.jsonl');
const PLAN = path.join(__dirname, '..', 'backup', 'r2-migration', 'rewrite-plan.json');
// History (audit_logs) is left as it was written; analytics hold no pictures.
const REWRITE_COLLECTIONS = ['articles', 'users', 'categories', 'siteconfigs', 'notifications', 'comments', 'tickers'];
const RENDITION_WIDTHS = [64, 128, 256, 384, 640, 828, 1200, 1920, 2000];

const runRewrite = async () => {
  const mv = require('../src/services/mediaVariants');
  const dry = process.argv.includes('--dry');
  if (!fs.existsSync(LEDGER)) throw new Error('No R2 ledger — run `upload` first.');
  const ledger = readJson(LEDGER);
  const base = mv.mediaBase();

  /** The R2 address for one Cloudinary URL, or null when it must stay. */
  const r2Address = (raw) => {
    const p = parseDelivery(raw);
    if (!p || p.cloud !== (config.cloudinary.cloudName || 'nz1gfsdt')) return { to: null, why: 'not ours' };
    const entry = ledger[p.publicId];
    if (!entry || !entry.complete) return { to: null, why: `not on R2: ${p.publicId}` };
    const w = (p.transformation || '').match(/(?:^|,)w_(\d+)/);
    if (w && /c_limit/.test(p.transformation)) {
      const want = Number(w[1]);
      const width = RENDITION_WIDTHS.find((x) => x >= want) || 2000;
      return { to: `${base}/${mv.encodePath(mv.variantKey(p.publicId, `w${width}`))}` };
    }
    return { to: `${base}/${mv.encodePath(entry.key)}` };
  };

  /** A string with every Cloudinary URL in it replaced; trailing punctuation kept. */
  const rewriteString = (value, misses) => value.replace(CLOUDINARY_REF, (m) => {
    const trail = (m.match(/[.,;:!?]+$/) || [''])[0];
    const { to, why } = r2Address(m);
    if (!to) {
      misses.push({ url: m, why });
      return m;
    }
    return to + trail;
  });

  await mongoose.connect(config.mongodb.uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  console.log(`MongoDB: ${hostOf(config.mongodb.uri)} / ${db.databaseName}${dry ? '  — DRY RUN, nothing is written' : ''}\n`);

  const plan = [];
  const misses = [];
  const conflicts = [];
  let urls = 0;
  let applied = 0;

  for (const name of REWRITE_COLLECTIONS) {
    let docs = 0;
    for await (const doc of db.collection(name).find({})) {
      const fields = [];
      walk(doc, [], (value, keyPath) => {
        if (!value.includes('cloudinary.com')) return;
        const missed = [];
        const next = rewriteString(value, missed);
        misses.push(...missed.map((x) => ({ collection: name, _id: String(doc._id), field: keyPath.join('.'), ...x })));
        if (next !== value) {
          urls += (value.match(CLOUDINARY_REF) || []).length - missed.length;
          fields.push({ path: keyPath.join('.'), old: value, new: next });
        }
      });
      if (!fields.length) continue;
      docs += 1;
      plan.push({ collection: name, _id: String(doc._id), fields: fields.map((f) => f.path) });
      if (dry) continue;

      fs.appendFileSync(SNAPSHOT, `${JSON.stringify({ collection: name, _id: String(doc._id), at: new Date().toISOString(), fields })}\n`);
      const filter = { _id: doc._id };
      const set = {};
      for (const f of fields) {
        filter[f.path] = f.old;
        set[f.path] = f.new;
      }
      const res = await db.collection(name).updateOne(filter, { $set: set });
      if (res.matchedCount === 1) applied += 1;
      else conflicts.push({ collection: name, _id: String(doc._id) });
    }
    if (docs) console.log(`  ${name.padEnd(14)} ${String(docs).padStart(5)} documents ${dry ? 'would change' : 'changed'}`);
  }

  // The media library's index: one row per picture now on R2, dated by its
  // original upload (the v<unix> version in its Cloudinary URL) so the
  // library keeps its newest-first order.
  const files = fs.existsSync(ORIGINALS_INDEX) ? readJson(ORIGINALS_INDEX).files : {};
  const oldManifest = path.join(OLD_BACKUP, 'manifest.json');
  const oldVersions = new Map(fs.existsSync(oldManifest)
    ? readJson(oldManifest).originals.map((o) => [o.public_id, (o.url.match(/\/v(\d+)\//) || [])[1]])
    : []);
  // Raw files (a Word drawing kept as it came) have an address but are not
  // pictures the library could show.
  const rows = Object.entries(ledger).filter(([, e]) => e.complete && !e.raw).map(([publicId, e]) => {
    const saved = files[assetKey('image', 'upload', publicId)];
    const v = (saved && saved.version && saved.version.replace(/^v/, '')) || oldVersions.get(publicId);
    const createdAt = v ? new Date(Number(v) * 1000) : new Date();
    return {
      updateOne: {
        filter: { publicId },
        update: {
          $setOnInsert: {
            publicId, key: e.key, url: `${base}/${mv.encodePath(e.key)}`, folder: path.posix.dirname(publicId),
            format: e.format, bytes: e.bytes, width: e.width, height: e.height, resourceType: 'image',
            variants: e.variants, source: 'cloudinary-migration', uploadedBy: null, createdAt, updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    };
  });
  let indexed = 0;
  if (!dry && rows.length) {
    for (let i = 0; i < rows.length; i += 500) {
      const res = await db.collection('media').bulkWrite(rows.slice(i, i + 500), { ordered: false });
      indexed += res.upsertedCount;
    }
  }
  await mongoose.disconnect();

  writeJson(PLAN, { at: new Date().toISOString(), dry, documents: plan, misses });
  console.log(`\n${urls} Cloudinary URLs in ${plan.length} documents ${dry ? 'would be' : 'were'} pointed at R2.`);
  if (!dry) {
    console.log(`  ${applied} documents updated, ${indexed} pictures added to the media index (${rows.length} on R2).`);
    console.log(`  Old values saved to ${SNAPSHOT}`);
  } else {
    console.log(`  ${rows.length} pictures would be added to the media index.`);
  }
  if (conflicts.length) {
    console.log(`\n! ${conflicts.length} documents changed while this ran and were left alone — run again:`);
    conflicts.slice(0, 20).forEach((c) => console.log(`  ${c.collection} ${c._id}`));
    process.exitCode = 1;
  }
  if (misses.length) {
    console.log(`\n! ${misses.length} URLs were left on Cloudinary:`);
    misses.slice(0, 20).forEach((m) => console.log(`  ${m.collection} ${m._id} ${m.field}: ${m.why}`));
  }
  console.log(`\n  plan: ${PLAN}`);
};

/**
 * Prove it: every original and rendition the ledger promises is in the
 * bucket (one listing, not 40,000 HEADs), and every R2 address MongoDB now
 * holds names one of them. Cloudinary URLs still left are counted.
 */
const runVerify = async () => {
  const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const mv = require('../src/services/mediaVariants');
  const s3 = r2Client();
  const Bucket = process.env.R2_BUCKET;

  const inBucket = new Set();
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket, ContinuationToken: token, MaxKeys: 1000 }));
    for (const o of res.Contents || []) inBucket.add(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
    process.stdout.write(`\r  listed ${inBucket.size} objects…`);
  } while (token);
  process.stdout.write('\n');

  const ledger = readJson(LEDGER);
  const missing = [];
  for (const [publicId, e] of Object.entries(ledger)) {
    for (const key of [e.key, ...(e.variants || [])]) if (!inBucket.has(key)) missing.push(`${publicId}: ${key}`);
  }
  console.log(`${Object.keys(ledger).length} pictures in the ledger; ${missing.length} expected objects missing from the bucket.`);
  missing.slice(0, 20).forEach((m) => console.log(`  ✗ ${m}`));

  await mongoose.connect(config.mongodb.uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const base = `${mv.mediaBase()}/`;
  const ownUrl = new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\s"'<>()\\\\]+`, 'g');
  let r2Refs = 0;
  let leftOnCloudinary = 0;
  const broken = [];
  for (const name of REWRITE_COLLECTIONS) {
    for await (const doc of db.collection(name).find({})) {
      walk(doc, [], (value, keyPath) => {
        leftOnCloudinary += (value.match(CLOUDINARY_REF) || []).length;
        for (const u of value.match(ownUrl) || []) {
          r2Refs += 1;
          const key = safeDecode(u.slice(base.length).replace(/[.,;:!?]+$/, ''));
          if (!inBucket.has(key)) broken.push(`${name} ${doc._id} ${keyPath.join('.')}: ${key}`);
        }
      });
    }
  }
  await mongoose.disconnect();
  console.log(`${r2Refs} R2 addresses in MongoDB; ${broken.length} point at nothing. ${leftOnCloudinary} Cloudinary URLs left.`);
  broken.slice(0, 20).forEach((b) => console.log(`  ✗ ${b}`));
  if (missing.length || broken.length) process.exitCode = 1;
  else console.log('✓ Everything the ledger promises is in the bucket, and every R2 address in the database resolves.');
};

/** Put back what rewrite changed — only where nothing has changed it since. */
const runRollback = async () => {
  if (!fs.existsSync(SNAPSHOT)) throw new Error('No rewrite snapshot — nothing to roll back.');
  const entries = fs.readFileSync(SNAPSHOT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  await mongoose.connect(config.mongodb.uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  let restored = 0;
  const skipped = [];
  for (const e of entries.reverse()) {
    const filter = { _id: new mongoose.Types.ObjectId(e._id) };
    const set = {};
    for (const f of e.fields) {
      filter[f.path] = f.new;
      set[f.path] = f.old;
    }
    const res = await db.collection(e.collection).updateOne(filter, { $set: set });
    if (res.matchedCount === 1) restored += 1;
    else skipped.push(`${e.collection} ${e._id}`);
  }
  await mongoose.disconnect();
  console.log(`Restored ${restored} documents to their Cloudinary URLs.`);
  if (skipped.length) {
    console.log(`${skipped.length} were edited after the rewrite and left as they are:`);
    skipped.slice(0, 20).forEach((s) => console.log(`  ${s}`));
  }
};

// ── reports ─────────────────────────────────────────────────────────────────

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * One row per placement. A cover stored as url + publicId is one placement, so
 * the pair collapses to a single row; inventory.json keeps both, because the
 * rewrite has to change both.
 */
const writeCsv = (inv, index) => {
  const header = ['picture', 'where it appears', 'on', 'status', 'page', 'collection', 'document id', 'field', 'size KB', 'dimensions', 'current URL', 'problem'];
  const rows = [];
  const seen = new Set();
  const order = { articles: 0, users: 1, categories: 2, siteconfigs: 3, notifications: 4 };
  const refs = [...inv.references].sort((a, b) => (order[a.collection] ?? 9) - (order[b.collection] ?? 9)
    || a.collection.localeCompare(b.collection) || a.docId.localeCompare(b.docId)
    // url before publicId, so the merged row shows the URL
    || a.field.replace(/publicId$/, '~').localeCompare(b.field.replace(/publicId$/, '~')));

  for (const r of refs) {
    const parent = r.field.replace(/\.(url|publicId|public_id)$/, '');
    const k = `${r.collection}|${r.docId}|${parent}|${r.assetKey || r.value}|${r.context || ''}`;
    if (r.field !== 'content' && seen.has(k)) continue;
    seen.add(k);
    const a = r.assetKey ? index.get(r.assetKey) : null;
    rows.push([
      a ? fileNameOf(a) : r.guess || r.value,
      r.where,
      r.label,
      r.status,
      r.link,
      r.collection,
      r.docId,
      r.field,
      a ? Math.round(a.bytes / 1024) : '',
      a && a.width ? `${a.width}×${a.height}` : '',
      r.kind === 'url' ? r.value : a ? a.secure_url : '',
      r.problem || '',
    ]);
  }
  for (const key of inv.orphans) {
    const a = index.get(key);
    rows.push([
      fileNameOf(a),
      a.demo ? 'Cloudinary demo sample — not used on the site' : 'not used anywhere on the site (media library only)',
      '', '', '', '', '', '',
      Math.round(a.bytes / 1024),
      a.width ? `${a.width}×${a.height}` : '',
      a.secure_url,
      '',
    ]);
  }
  // BOM so Excel opens the Arabic titles as UTF-8.
  writeFileAtomic(CSV, `﻿${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`);
};

const writeSummary = (inv, index, broken) => {
  const lines = [];
  const total = inv.assets.reduce((s, a) => s + a.bytes, 0);
  const usedAssets = inv.assets.filter((a) => a.refs > 0);
  const orphanAssets = inv.assets.filter((a) => a.refs === 0);
  const demo = orphanAssets.filter((a) => a.demo);

  lines.push(`Inventory of ${inv.mongo}, Cloudinary account ${inv.cloudName}, ${inv.generatedAt}`);
  lines.push('');
  lines.push(`Known files (${inv.listing}): ${inv.assets.length} (${mb(total)}).`);
  lines.push(`  in use somewhere on the site:     ${String(usedAssets.length).padStart(6)}  ${mb(usedAssets.reduce((s, a) => s + a.bytes, 0))}`);
  lines.push(`  not used anywhere:                ${String(orphanAssets.length - demo.length).padStart(6)}  ${mb(orphanAssets.filter((a) => !a.demo).reduce((s, a) => s + a.bytes, 0))}`);
  lines.push(`  Cloudinary demo samples, unused:  ${String(demo.length).padStart(6)}`);
  lines.push('');

  const where = new Map();
  for (const r of inv.references) {
    const k = `${r.collection.padEnd(14)} ${r.where.replace(/ #\d+/, '').replace(/ \(.*\)$/, '').padEnd(36)} ${r.kind}`;
    where.set(k, (where.get(k) || 0) + 1);
  }
  lines.push(`${inv.references.length} references found:`);
  for (const [k, n] of [...where].sort((a, b) => b[1] - a[1])) lines.push(`  ${k.padEnd(60)} ${String(n).padStart(6)}`);
  lines.push('');

  const published = new Set(inv.references.filter((r) => r.collection === 'articles' && r.status === 'published').map((r) => r.docId));
  const articleDocs = new Set(inv.references.filter((r) => r.collection === 'articles').map((r) => r.docId));
  lines.push(`Articles with at least one picture: ${articleDocs.size} (${published.size} published).`);
  const transforms = new Map();
  for (const r of inv.references) if (r.transformation) transforms.set(r.transformation, (transforms.get(r.transformation) || 0) + 1);
  if (transforms.size) {
    lines.push('Transformations baked into stored URLs:');
    for (const [t, n] of [...transforms].sort((a, b) => b[1] - a[1])) lines.push(`  ${t.padEnd(48)} ${String(n).padStart(6)}`);
  }
  lines.push('');
  lines.push(`Collections scanned: ${Object.entries(inv.scanned).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  lines.push('');
  if (broken.length) {
    lines.push(`✗ ${broken.length} references point at something that is not a file in this account:`);
    for (const r of broken.slice(0, 40)) lines.push(`  ${r.collection} ${r.docId} ${r.field}: ${r.problem} — ${r.value}`);
    if (broken.length > 40) lines.push(`  … and ${broken.length - 40} more (see inventory.json)`);
  } else {
    lines.push('✓ Every reference resolves to a file Cloudinary holds.');
  }
  writeFileAtomic(SUMMARY, `${lines.join('\n')}\n`);
};

// ── entry ───────────────────────────────────────────────────────────────────

const COMMANDS = {
  assets: runAssets,
  backup: runBackup,
  inventory: runInventory,
  rescue: runRescue,
  upload: runUpload,
  rewrite: runRewrite,
  verify: runVerify,
  rollback: runRollback,
};

(async () => {
  const cmd = process.argv[2];
  if (!COMMANDS[cmd]) {
    console.log(`Usage:
  node scripts/media-migrate.js assets      list every file the Cloudinary account holds
  node scripts/media-migrate.js backup      download every original into backup/r2-migration/originals, verified
  railway run --service backend node scripts/media-migrate.js inventory
                                            find where each picture is used, write the CSV

Nothing here writes to Cloudinary or MongoDB.`);
    return;
  }
  await COMMANDS[cmd]();
})().catch(async (err) => {
  console.error(`\n${err.stack || err.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
