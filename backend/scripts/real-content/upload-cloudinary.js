'use strict';

/*
 * Uploads every source image (content.js -> IMAGES) to Cloudinary and writes
 * image-urls.json  { key: { url, publicId, width, height } }.
 *
 * Reads credentials from backend/.env (CLOUDINARY_CLOUD_NAME / _API_KEY /
 * _API_SECRET) or from CLOUDINARY_URL. Re-running is safe (overwrite=true).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { IMAGES, imageAbsPath } = require('./content');

if (process.env.CLOUDINARY_URL) {
  // SDK auto-configures from CLOUDINARY_URL
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const cfg = cloudinary.config();
if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
  console.error('❌ Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in backend/.env');
  process.exit(1);
}
console.log('☁️  Cloudinary cloud:', cfg.cloud_name);

const FOLDER = 'altilgraf/content';
const OUT = path.join(__dirname, 'image-urls.json');

(async () => {
  const results = {};
  const keys = Object.keys(IMAGES);
  let i = 0;
  for (const key of keys) {
    i++;
    const abs = imageAbsPath(key);
    if (!fs.existsSync(abs)) {
      console.error(`  [${i}/${keys.length}] MISSING FILE for ${key}: ${abs}`);
      process.exit(1);
    }
    try {
      const res = await cloudinary.uploader.upload(abs, {
        folder: FOLDER,
        public_id: key,
        overwrite: true,
        resource_type: 'image',
        // strip metadata, sane transformations on delivery are handled by the URL
      });
      results[key] = {
        url: res.secure_url,
        publicId: res.public_id,
        width: res.width,
        height: res.height,
      };
      console.log(`  [${i}/${keys.length}] ✓ ${key}  (${res.width}x${res.height})`);
    } catch (err) {
      console.error(`  [${i}/${keys.length}] ✗ ${key}: ${err.message}`);
      process.exit(1);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n✅ Uploaded ${Object.keys(results).length} images -> ${OUT}`);
  process.exit(0);
})();
