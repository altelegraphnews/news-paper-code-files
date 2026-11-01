'use strict';

/**
 * The fixed set of sizes every picture is stored in, and how each one is made.
 *
 * Cloudinary resized on request. R2 only stores files, so every size the site
 * asks for is made once, when the picture arrives, and stored beside the
 * original as r/<variant>/<publicId>.<ext>. The upload route and
 * scripts/media-migrate.js both render through this module, so a migrated
 * photograph and a freshly uploaded one come out alike.
 *
 * Who asks for what:
 *   w64 … w1920   next/image srcset (frontend next.config deviceSizes + imageSizes)
 *   w1200, w2000  gallery <img src> and data-full, written into article HTML
 *   og            the 1200×630 JPEG share card (og:image, and Buffer → Instagram)
 *   sq72 … sq256  round author photos (avatarSrc, at 2× the CSS size)
 *   pt192x256     the 3:4 byline portrait (avatarPortraitSrc)
 *
 * Changing this table means re-rendering every picture already stored, or
 * the new size will 404 for all of them: add a size here and backfill it with
 * the migration script before any page asks for it.
 */

const sharp = require('sharp');

const WIDTHS = [64, 128, 256, 384, 640, 828, 1200, 1920, 2000];
const SQUARES = [72, 128, 192, 256];

const VARIANTS = [
  ...WIDTHS.map((w) => ({ name: `w${w}`, ext: 'webp', width: w })),
  { name: 'og', ext: 'jpg', width: 1200, height: 630, crop: true },
  ...SQUARES.map((px) => ({ name: `sq${px}`, ext: 'webp', width: px, height: px, crop: true })),
  { name: 'pt192x256', ext: 'webp', width: 192, height: 256, crop: true },
];

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  tif: 'image/tiff',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

// What sharp calls a format → the extension the stored file gets.
const EXT_OF_FORMAT = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', tiff: 'tif' };

const variantKey = (publicId, name) => `r/${name}/${publicId}.${name === 'og' ? 'jpg' : 'webp'}`;

class UnsupportedImageError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

/**
 * What the bytes really are — never what the uploader's browser claimed.
 * SVG is refused because it can carry script and would be served from our own
 * domain; HEIC because the prebuilt sharp cannot decode HEVC and browsers
 * cannot show it either (Cloudinary used to convert it on delivery).
 */
const inspect = async (buffer) => {
  let meta;
  try {
    meta = await sharp(buffer, { failOn: 'truncated', animated: true }).metadata();
  } catch {
    throw new UnsupportedImageError('تعذّرت قراءة الصورة — الملف تالف أو ليس صورة');
  }
  if (meta.format === 'svg') throw new UnsupportedImageError('صور SVG غير مسموح بها — ارفع الصورة بصيغة JPG أو PNG');
  if (meta.format === 'heif') {
    if (meta.compression !== 'av1') {
      throw new UnsupportedImageError('صيغة HEIC (صور آيفون) غير مدعومة — حوّل الصورة إلى JPG ثم ارفعها');
    }
    return { ext: 'avif', width: meta.width, height: meta.height, animated: false };
  }
  const ext = EXT_OF_FORMAT[meta.format];
  if (!ext) throw new UnsupportedImageError(`صيغة الصورة (${meta.format}) غير مدعومة — ارفعها بصيغة JPG أو PNG أو WebP`);
  // Report the size a reader sees: a portrait phone photo is stored landscape
  // with an EXIF note to turn it, and every rendition is turned.
  const turned = meta.orientation >= 5 && meta.orientation <= 8;
  const height = meta.pageHeight || meta.height;
  return {
    ext,
    width: turned ? height : meta.width,
    height: turned ? meta.width : height,
    animated: (meta.pages || 1) > 1,
  };
};

const encode = (img, ext) => (ext === 'jpg'
  ? img.flatten({ background: '#ffffff' }).jpeg({ quality: 80, mozjpeg: true })
  : img.webp({ quality: 80 }));

/**
 * Every rendition of one picture. Decoding a large JPEG fourteen times is
 * most of the cost, so a still image is decoded and turned once into a raw
 * working copy (capped at the widest rendition) and every size is cut from
 * that. Animated pictures keep their frames in the width renditions; the
 * crops (share card, avatars) use the first frame.
 */
const renderVariants = async (buffer) => {
  const info = await inspect(buffer);

  let work = null;
  if (!info.animated) {
    work = await sharp(buffer, { failOn: 'truncated' })
      .autoOrient()
      .resize({ width: WIDTHS[WIDTHS.length - 1], withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
  }
  const source = (animated) => (work
    ? sharp(work.data, { raw: { width: work.info.width, height: work.info.height, channels: work.info.channels } })
    : sharp(buffer, { failOn: 'truncated', animated }).autoOrient());

  const rawOf = async (img) => {
    const { data, info: i } = await img.raw().toBuffer({ resolveWithObject: true });
    return { data, raw: { width: i.width, height: i.height, channels: i.channels } };
  };

  // sharp's attention strategy looks for detail, saturation and skin tones,
  // not faces, and on a head-and-shoulders portrait it settles on a patterned
  // tie as readily as on the face above it. In an upright picture the face is
  // near the top, so crops of those keep the top.
  const upright = info.height > info.width;
  const position = upright ? 'north' : sharp.strategy.attention;

  const outputs = [];
  for (const v of VARIANTS) {
    let img;
    if (v.name === 'og' && info.width / info.height < 1.5) {
      // Cutting an upright or square picture down to 1.91:1 throws half of it
      // away — usually the face. So the share card shows all of it, centred on
      // a blurred, darkened copy of itself that fills the frame.
      const back = await rawOf(source(false).resize(v.width, v.height, { fit: 'cover' }).blur(40).modulate({ brightness: 0.7 }));
      const front = await rawOf(source(false).resize(v.width, v.height, { fit: 'inside' }));
      img = sharp(back.data, { raw: back.raw }).composite([{ input: front.data, raw: front.raw, gravity: 'centre' }]);
    } else if (v.crop) {
      // A share card or an avatar must fill its frame exactly, so small
      // pictures are scaled up here, as Cloudinary's c_fill did.
      img = source(false).resize(v.width, v.height, { fit: 'cover', position });
    } else {
      img = source(info.animated).resize({ width: v.width, withoutEnlargement: true });
    }
    const ext = v.name === 'og' ? 'jpg' : 'webp';
    outputs.push({ name: v.name, contentType: CONTENT_TYPES[ext], buffer: await encode(img, ext).toBuffer() });
  }
  return { info, outputs };
};

// ── URLs ─────────────────────────────────────────────────────────────────────

const mediaBase = () => (process.env.R2_PUBLIC_URL || 'https://media.al-telegraph.com').replace(/\/+$/, '');
const cloudName = () => process.env.CLOUDINARY_CLOUD_NAME || 'nz1gfsdt';

const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const encodePath = (key) => key.split('/').map(encodeURIComponent).join('/');
const isTransformSegment = (s) => s.split(',').every((p) => /^[a-z]{1,4}_[^,]+$/.test(p));

/**
 * The publicId a URL points at — ours on R2, or a legacy Cloudinary one — or
 * null when it is somebody else's picture (picsum, a pasted link, a data: URI).
 */
const publicIdOf = (url) => {
  if (typeof url !== 'string') return null;
  const bare = url.split(/[?#]/)[0];
  const base = mediaBase();
  let path;
  if (bare.startsWith(`${base}/`)) {
    path = bare.slice(base.length + 1);
    const rendition = path.match(/^r\/[a-z0-9]+\/(.+)$/);
    if (rendition) path = rendition[1];
  } else {
    const prefix = new RegExp(`^https?://res(?:-\\d+)?\\.cloudinary\\.com/${cloudName()}/image/upload/(.+)$`);
    const m = bare.match(prefix);
    if (!m) return null;
    const segs = m[1].split('/');
    let i = 0;
    while (i < segs.length - 1 && (/^v\d+$/.test(segs[i]) || isTransformSegment(segs[i]))) i += 1;
    path = segs.slice(i).join('/');
  }
  return safeDecode(path).replace(/\.[a-z0-9]{2,5}$/i, '') || null;
};

const variantUrl = (url, name) => {
  const id = publicIdOf(url);
  return id ? `${mediaBase()}/${encodePath(variantKey(id, name))}` : url;
};

module.exports = {
  VARIANTS,
  WIDTHS,
  CONTENT_TYPES,
  UnsupportedImageError,
  inspect,
  renderVariants,
  variantKey,
  mediaBase,
  encodePath,
  publicIdOf,
  variantUrl,
};
