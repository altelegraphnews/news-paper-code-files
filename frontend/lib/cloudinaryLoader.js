// Custom next/image loader.
//
// Cloudinary already sits in front of our media as an optimizing CDN, so we let
// it do the format negotiation + resizing (f_auto,q_auto,w_<width>) and serve
// the bytes directly. This bypasses the Next.js image optimizer entirely, which
// on the resource-limited Railway container was failing under the burst of
// concurrent lazy-loaded thumbnail requests (hero loaded, cards came up blank).
//
// Non-Cloudinary sources (local logo/icons, etc.) are returned unchanged so they
// keep working as plain static assets.
export default function cloudinaryLoader({ src, width, quality }) {
  if (typeof src === 'string' && src.includes('res.cloudinary.com') && src.includes('/upload/')) {
    const q = quality ? `q_${quality}` : 'q_auto';
    const transform = `f_auto,${q},c_limit,w_${width}`;
    return src.replace('/upload/', `/upload/${transform}/`);
  }
  return src;
}
