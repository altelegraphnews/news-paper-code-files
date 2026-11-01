/**
 * Where pictures live, and how to ask for a size of one.
 *
 * Every picture is on Cloudflare R2 at MEDIA_BASE/<publicId>.<ext>, with a
 * fixed set of renditions beside it at MEDIA_BASE/r/<variant>/<publicId>.webp
 * (the share card: .jpg), cut once at upload by the backend. R2 cannot resize
 * on request, so a size that is not in that set simply does not exist — ask
 * only for the names below, and keep them in step with
 * backend/src/services/mediaVariants.js.
 *
 * Articles saved before the move from Cloudinary may still hold Cloudinary
 * URLs until the database is rewritten. Every R2 key kept its Cloudinary
 * public_id, so those URLs map to the same files here.
 */

export const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_URL || 'https://media.al-telegraph.com').replace(/\/+$/, '');

const CLOUDINARY = /^https?:\/\/res(?:-\d+)?\.cloudinary\.com\/nz1gfsdt\/image\/upload\/(.+)$/;

/** The widths next/image asks for (next.config deviceSizes + imageSizes). */
const LOADER_WIDTHS = [64, 128, 256, 384, 640, 828, 1200, 1920];
/** Round author photos, cut square at 2× their CSS size. */
const SQUARES = [72, 128, 192, 256];

export interface MediaRef {
  /** The publicId, e.g. alwid/articles/ut5sskac5gwkndnw4st7 */
  id: string;
  ext: string | null;
  /** Set when the URL already names a rendition (r/<variant>/…). */
  variant: string | null;
  /** The w_ a legacy Cloudinary URL was baked at, if any. */
  width: number | null;
}

const isTransform = (s: string) => s.split(',').every((p) => /^[a-z]{1,4}_[^,]+$/.test(p));
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const encodePath = (key: string) => key.split('/').map(encodeURIComponent).join('/');

/** The picture a URL points at — ours or a legacy Cloudinary one — or null. */
export function parseMedia(url?: string | null): MediaRef | null {
  if (!url || typeof url !== 'string') return null;
  const bare = url.split(/[?#]/)[0];
  let path: string;
  let variant: string | null = null;
  let width: number | null = null;

  if (bare.startsWith(`${MEDIA_BASE}/`)) {
    path = bare.slice(MEDIA_BASE.length + 1);
    const r = path.match(/^r\/([a-z0-9]+)\/(.+)$/);
    if (r) {
      variant = r[1];
      path = r[2];
    }
  } else {
    const m = bare.match(CLOUDINARY);
    if (!m) return null;
    const segs = m[1].split('/');
    let i = 0;
    while (i < segs.length - 1 && (/^v\d+$/.test(segs[i]) || isTransform(segs[i]))) {
      const w = segs[i].match(/(?:^|,)w_(\d+)/);
      if (w) width = Number(w[1]);
      i += 1;
    }
    path = segs.slice(i).join('/');
  }

  const decoded = decode(path);
  const ext = decoded.match(/\.([a-z0-9]{2,5})$/i);
  const id = ext ? decoded.slice(0, -ext[0].length) : decoded;
  return id ? { id, ext: ext ? ext[1].toLowerCase() : null, variant, width } : null;
}

/** True when the picture is ours, so its renditions — share card included — exist. */
export const isOwnMedia = (url?: string | null) => parseMedia(url) !== null;

const renditionOf = (ref: MediaRef, name: string) =>
  `${MEDIA_BASE}/${encodePath(`r/${name}/${ref.id}.${name === 'og' ? 'jpg' : 'webp'}`)}`;

/** A stored rendition of the picture; any other URL comes back unchanged. */
export function variantUrl(url: string, name: string): string {
  const ref = parseMedia(url);
  return ref ? renditionOf(ref, name) : url;
}

/** The original file, for search engines and links; any other URL unchanged. */
export function originalUrl(url: string): string {
  const ref = parseMedia(url);
  if (!ref) return url;
  return ref.ext ? `${MEDIA_BASE}/${encodePath(`${ref.id}.${ref.ext}`)}` : renditionOf(ref, 'w1920');
}

/** The rendition for a next/image width: the smallest stored one at least that wide. */
export const loaderVariant = (width: number) => `w${LOADER_WIDTHS.find((w) => w >= width) ?? 1920}`;

/** The square author photo for a circle `px` device pixels across. */
export const squareVariant = (px: number) => `sq${SQUARES.find((s) => s >= px) ?? 256}`;

/**
 * Article HTML with every picture of ours sized for reading. Body pictures
 * are raw <img> tags — they never pass through next/image — so this is where
 * they get a size: an <img src> the 1920px rendition (or the width a gallery
 * picture was baked at), data-full (the lightbox) the 2000px one, and a link
 * to a picture the original file.
 */
export function mediaHtml(html: string): string {
  if (!html || (!html.includes('cloudinary.com') && !html.includes(MEDIA_BASE))) return html;
  return html.replace(/(\s(src|data-full|href)=")([^"]+)(")/g, (all, pre, attr, url, post) => {
    const ref = parseMedia(url);
    if (!ref || ref.variant) return all;
    if (attr === 'href') return `${pre}${originalUrl(url)}${post}`;
    const name = attr === 'data-full' || (ref.width ?? 0) >= 2000 ? 'w2000' : ref.width === 1200 ? 'w1200' : 'w1920';
    return `${pre}${renditionOf(ref, name)}${post}`;
  });
}
