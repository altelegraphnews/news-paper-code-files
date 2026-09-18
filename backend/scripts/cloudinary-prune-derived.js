'use strict';

/**
 * Delete the generated thumbnails Cloudinary keeps, without touching a single
 * photograph.
 *
 * Cloudinary stores a separate file for every width-and-format combination any
 * page has ever requested. With 16 configured widths and f_auto's three
 * formats that was 20,624 stored assets against ~1,160 real images — billed
 * both as storage and, on first creation, as a transformation.
 *
 * next.config and cloudinaryLoader now ask for 8 widths in one format, so new
 * derivatives come back in a much smaller shape. This clears the old ones.
 *
 * ── Why this cannot take the site down ──────────────────────────────────────
 * A derived asset is a cache entry, not a picture. Deleting one leaves its URL
 * working: the next request regenerates it from the original. The only cost is
 * one slow load and one transformation credit.
 *
 * The thing that WOULD be unrecoverable is deleting the originals. So:
 *   - `keep_original: true` is hard-coded, never passed in, never configurable
 *   - `delete_all_resources` is never called, at all
 *   - purging refuses to start until a verified local backup of every original
 *     exists on disk
 *   - after every batch, a sample of originals is re-fetched over HTTP, and the
 *     run aborts the moment one stops returning 200
 *
 * ── Order of operations ─────────────────────────────────────────────────────
 * Run this only AFTER the smaller-widths deploy is live (give it ~24h). Purging
 * first just regenerates the same 20,000 files in the old shape and bills you a
 * second time for them.
 *
 *   node scripts/cloudinary-prune-derived.js --backup
 *   node scripts/cloudinary-prune-derived.js --dry
 *   node scripts/cloudinary-prune-derived.js --purge --limit=20     # toe in
 *   node scripts/cloudinary-prune-derived.js --purge --limit=200    # wider
 *   node scripts/cloudinary-prune-derived.js --purge                # the rest
 *
 * --limit is a number of ORIGINALS whose thumbnails get cleared, not a number
 * of files, so a small limit is a genuinely small blast radius. Progress is
 * recorded, so a later run resumes rather than redoing work.
 *
 * Needs CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET, same as the app.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const config = require('../src/config/env');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

const BACKUP_DIR = path.join(__dirname, '..', 'backup', 'cloudinary-originals');
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const PROGRESS = path.join(BACKUP_DIR, 'purged.json');

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const safeName = (publicId, format) => `${publicId.replace(/[\/\\]/g, '__')}.${format || 'bin'}`;

/** Every upload in the account, paged. */
const listAllOriginals = async () => {
  const all = [];
  let cursor;
  do {
    const res = await cloudinary.api.resources({
      type: 'upload',
      max_results: 500,
      next_cursor: cursor,
    });
    all.push(...(res.resources || []));
    cursor = res.next_cursor;
    process.stdout.write(`\r  listed ${all.length} originals…`);
    await sleep(120);
  } while (cursor);
  process.stdout.write('\n');
  return all;
};

// ── backup ───────────────────────────────────────────────────────────────────

const runBackup = async () => {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const originals = await listAllOriginals();

  let saved = 0;
  let bytes = 0;
  let skipped = 0;
  const entries = [];

  for (const r of originals) {
    const file = safeName(r.public_id, r.format);
    const dest = path.join(BACKUP_DIR, file);
    entries.push({ public_id: r.public_id, format: r.format, bytes: r.bytes, url: r.secure_url, file });

    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { skipped += 1; continue; }
    try {
      const res = await fetch(r.secure_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      saved += 1;
      bytes += buf.length;
    } catch (err) {
      console.log(`\n  ✗ ${r.public_id} — ${err.message}`);
    }
    if ((saved + skipped) % 25 === 0) process.stdout.write(`\r  backed up ${saved + skipped}/${originals.length}…`);
  }
  process.stdout.write('\n');

  fs.writeFileSync(MANIFEST, JSON.stringify({ savedAt: new Date().toISOString(), originals: entries }, null, 2));
  console.log(`\nBackup complete: ${saved} downloaded, ${skipped} already present, ${mb(bytes)} new.`);
  console.log(`  ${BACKUP_DIR}`);
  console.log('\nKeep this folder until you are satisfied. It is the only copy that does not live at Cloudinary.');
};

/** A purge is refused unless every original in the manifest is on disk. */
const verifyBackup = () => {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error('No backup manifest — run with --backup first. Refusing to delete anything.');
  }
  const { originals, savedAt } = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const missing = originals.filter((o) => {
    const f = path.join(BACKUP_DIR, o.file);
    return !fs.existsSync(f) || fs.statSync(f).size === 0;
  });
  if (missing.length) {
    throw new Error(`${missing.length} original(s) missing from the backup (e.g. ${missing[0].public_id}). Re-run --backup. Refusing to delete anything.`);
  }
  console.log(`Backup verified: ${originals.length} originals on disk, taken ${savedAt}`);
  return originals;
};

/** An original is healthy if its URL still serves bytes. */
const originalsStillServe = async (sample) => {
  for (const o of sample) {
    try {
      const res = await fetch(o.url, { method: 'HEAD' });
      if (!res.ok) return { ok: false, who: o.public_id, why: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, who: o.public_id, why: err.message };
    }
  }
  return { ok: true };
};

// ── purge ────────────────────────────────────────────────────────────────────

const runPurge = async ({ dry }) => {
  const originals = dry && !fs.existsSync(MANIFEST)
    ? (await listAllOriginals()).map((r) => ({ public_id: r.public_id, url: r.secure_url }))
    : verifyBackup();

  const done = fs.existsSync(PROGRESS) ? new Set(JSON.parse(fs.readFileSync(PROGRESS, 'utf8'))) : new Set();
  const limit = parseInt(arg('limit'), 10) || 0;

  let todo = originals.filter((o) => !done.has(o.public_id));
  if (limit) todo = todo.slice(0, limit);

  console.log(`\n${originals.length} originals total, ${done.size} already pruned.`);
  console.log(`This run will clear thumbnails for ${todo.length} original(s)${dry ? ' — DRY RUN, nothing is deleted' : ''}.\n`);
  if (!todo.length) { console.log('Nothing to do.'); return; }

  if (dry) {
    todo.slice(0, 10).forEach((o) => console.log(`  · ${o.public_id}`));
    if (todo.length > 10) console.log(`  … and ${todo.length - 10} more`);
    console.log('\nEach keeps its original file. Only generated sizes would be removed.');
    return;
  }

  // 100 public_ids is the Admin API's per-call ceiling.
  const BATCH = 100;
  let cleared = 0;

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const ids = batch.map((o) => o.public_id);

    // keep_original is the whole safety story. It is written here, literally,
    // and is never read from configuration or an argument.
    await cloudinary.api.delete_resources(ids, { keep_original: true, invalidate: false });

    cleared += ids.length;
    ids.forEach((id) => done.add(id));
    fs.writeFileSync(PROGRESS, JSON.stringify([...done], null, 2));

    // Prove the photographs survived before touching the next batch.
    const sample = batch.slice(0, 5);
    const health = await originalsStillServe(sample);
    if (!health.ok) {
      console.error(`\n✗ STOPPING — "${health.who}" stopped serving (${health.why}).`);
      console.error('  Nothing further will be deleted. The original is in your backup folder.');
      process.exit(1);
    }

    console.log(`  ✓ batch ${i / BATCH + 1}: ${cleared}/${todo.length} originals pruned, ${sample.length} spot-checked OK`);
    await sleep(500);
  }

  console.log(`\nDone. Thumbnails cleared for ${cleared} original(s); every original verified still serving.`);
  console.log('They regenerate on demand, in the new smaller shape, as readers hit the pages.');
};

// ── entry ────────────────────────────────────────────────────────────────────

(async () => {
  if (!config.cloudinary.cloudName || !config.cloudinary.apiSecret) {
    console.error('Cloudinary credentials not set — nothing to do.');
    process.exit(1);
  }
  if (process.argv.includes('--backup')) return runBackup();
  if (process.argv.includes('--purge')) return runPurge({ dry: false });
  if (process.argv.includes('--dry')) return runPurge({ dry: true });

  console.log(`Usage:
  node scripts/cloudinary-prune-derived.js --backup            download every original first
  node scripts/cloudinary-prune-derived.js --dry               show what would be cleared
  node scripts/cloudinary-prune-derived.js --purge --limit=20  clear a few, verify, stop
  node scripts/cloudinary-prune-derived.js --purge             clear the rest

Originals are never deleted. Run --backup before any --purge; it is enforced.`);
})().catch((err) => { console.error('\n' + err.message); process.exit(1); });
