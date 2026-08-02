/**
 * Cloudinary transforms for pictures the editor writes into article HTML.
 *
 * Body images are raw <img> tags in a sanitised HTML string — they never pass
 * through next/image, so whatever size we want has to be baked into the `src`
 * at insert time. The transform string mirrors frontend/lib/cloudinaryLoader.js
 * so the whole site asks Cloudinary for bytes the same way.
 */

const TRANSFORM = 'f_auto,q_auto,c_limit'

/** A transform segment sits directly after /upload/ — `v1712…` is a version, not a transform. */
const isTransformSegment = (segment: string) =>
  /^[a-z]+_[^/]*$/.test(segment) && !/^v\d+$/.test(segment)

function withWidth(url: string, width: number): string {
  if (typeof url !== 'string') return url
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url

  const [head, ...rest] = url.split('/upload/')
  const tail = rest.join('/upload/')
  const segments = tail.split('/')

  // Re-inserting a picture that already carries a transform would otherwise
  // chain a second one, and the narrower width would win.
  const body = segments.length > 1 && isTransformSegment(segments[0])
    ? segments.slice(1).join('/')
    : tail

  return `${head}/upload/${TRANSFORM},w_${width}/${body}`
}

/** What a gallery <img src> points at — wide enough to fill the reading column on a retina screen. */
export const galleryImageUrl = (url: string) => withWidth(url, 1200)

/** What click-to-enlarge opens, carried in data-full. */
export const galleryFullUrl = (url: string) => withWidth(url, 2000)
