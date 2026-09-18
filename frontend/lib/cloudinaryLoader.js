// Custom next/image loader.
//
// Cloudinary already sits in front of our media as an optimizing CDN, so we let
// it do the resizing and format conversion (f_webp,q_auto:eco,w_<width>) and serve
// the bytes directly. This bypasses the Next.js image optimizer entirely, which
// on the resource-limited Railway container was failing under the burst of
// concurrent lazy-loaded thumbnail requests (hero loaded, cards came up blank).
//
// Non-Cloudinary sources (local logo/icons, etc.) are returned unchanged so they
// keep working as plain static assets.
// f_webp, not f_auto: f_auto negotiates on the caller's Accept header, so the
// SAME url is a separate stored, billed file in AVIF, in WebP and in JPEG —
// three derivatives per width instead of one. AVIF is roughly 10-20% smaller
// than WebP, which is worth a little bandwidth but not triple the
// transformations and triple the storage. WebP is supported by every browser
// since 2020.
//
// The social card is deliberately NOT built here — it needs real JPEG, because
// Facebook will not render WebP. See ogImageSrc in lib/utils/seoUtils.ts.
export default function cloudinaryLoader({ src, width, quality }) {
  if (typeof src === 'string' && src.includes('res.cloudinary.com') && src.includes('/upload/')) {
    const q = quality ? `q_${quality}` : 'q_auto:eco';
    const transform = `f_webp,${q},c_limit,w_${width}`;
    return src.replace('/upload/', `/upload/${transform}/`);
  }
  return src;
}
