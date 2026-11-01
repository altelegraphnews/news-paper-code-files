/**
 * Picture URLs for what the editor writes into articles and shows in pickers.
 *
 * Every picture is on Cloudflare R2 with a fixed set of renditions cut at
 * upload (backend/src/services/mediaVariants.js), e.g.
 * r/w1200/<publicId>.webp. R2 cannot resize on request, so only those names
 * exist — keep them in step with that file.
 *
 * Body images are raw <img> tags in a sanitised HTML string — they never pass
 * through next/image, so whatever size we want has to be baked into the `src`
 * at insert time. Pictures saved before the move may still carry Cloudinary
 * URLs; they map to the same files, since every R2 key kept its public_id.
 */

const MEDIA_BASE = (import.meta.env.VITE_MEDIA_URL || 'https://media.al-telegraph.com').replace(/\/+$/, '')

const CLOUDINARY = /^https?:\/\/res(?:-\d+)?\.cloudinary\.com\/nz1gfsdt\/image\/upload\/(.+)$/

/** A transform segment sits directly after /upload/ — `v1712…` is a version, not a transform. */
const isTransformSegment = (segment: string) => segment.split(',').every((p) => /^[a-z]{1,4}_[^,]+$/.test(p))

/** The publicId a URL points at — ours or a legacy Cloudinary one — or null. */
export function publicIdOf(url: string): string | null {
  if (typeof url !== 'string') return null
  const bare = url.split(/[?#]/)[0]
  let path: string
  if (bare.startsWith(`${MEDIA_BASE}/`)) {
    // Re-inserting a picture that already names a rendition must swap it,
    // not nest a second one inside it.
    path = bare.slice(MEDIA_BASE.length + 1).replace(/^r\/[a-z0-9]+\//, '')
  } else {
    const m = bare.match(CLOUDINARY)
    if (!m) return null
    const segs = m[1].split('/')
    let i = 0
    while (i < segs.length - 1 && (/^v\d+$/.test(segs[i]) || isTransformSegment(segs[i]))) i += 1
    path = segs.slice(i).join('/')
  }
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    // keep it as written
  }
  return decoded.replace(/\.[a-z0-9]{2,5}$/i, '') || null
}

/** A stored rendition of the picture; any other URL comes back unchanged. */
export function variantUrl(url: string, name: string): string {
  const id = publicIdOf(url)
  if (!id) return url
  const key = `r/${name}/${id}.${name === 'og' ? 'jpg' : 'webp'}`
  return `${MEDIA_BASE}/${key.split('/').map(encodeURIComponent).join('/')}`
}

/** What a gallery <img src> points at — wide enough to fill the reading column on a retina screen. */
export const galleryImageUrl = (url: string) => variantUrl(url, 'w1200')

/** What click-to-enlarge opens, carried in data-full. */
export const galleryFullUrl = (url: string) => variantUrl(url, 'w2000')
