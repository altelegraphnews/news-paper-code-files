// Author avatars come from the API as { url, publicId } (the User.avatar
// subdocument), but older code/types treated avatar as a plain string URL.
// This normalizes either shape to a usable image URL string.
import { squareVariant, variantUrl } from '@/lib/media';

export type AvatarLike = string | { url?: string; publicId?: string } | null | undefined;

export function avatarUrl(avatar: AvatarLike): string | undefined {
  if (!avatar) return undefined;
  if (typeof avatar === 'string') return avatar || undefined;
  return avatar.url || undefined;
}

/**
 * A circular portrait: the square rendition cut at upload.
 *
 * The site-wide image loader keeps a picture's aspect ratio. Author photos
 * are whatever shape they were uploaded in — plenty are landscape — so a
 * width-only request for a 96px circle comes back 96×54, and CSS
 * `object-cover` then stretches those 54 rows to fill the circle. That
 * upscale is why the byline portrait once looked soft.
 *
 * So every picture is also stored as squares (sq72…sq256), cropped to keep
 * the head in an upright photo and the most detailed region otherwise
 * (backend mediaVariants.js); this picks the smallest one that fills the
 * circle on a retina screen. `size` is the CSS size of the circle. Render
 * with `unoptimized`, so the global loader does not swap the square back for
 * a width rendition.
 */
export function avatarSrc(avatar: AvatarLike, size: number): string | undefined {
  const url = avatarUrl(avatar);
  if (!url) return undefined;
  return variantUrl(url, squareVariant(Math.round(size * 2)));
}

/**
 * Like avatarSrc but for the 3:4 byline plate: the pt192x256 rendition, cut
 * for that shape at upload, so the head is framed for the tall frame rather
 * than for a square that CSS crops again. It suits plates up to 96 CSS px
 * wide; `width` and `ratio` say what the caller draws, and a different shape
 * would need its own rendition in mediaVariants.js first.
 */
export function avatarPortraitSrc(
  avatar: AvatarLike,
  width: number,
  ratio = 4 / 3,
): string | undefined {
  const url = avatarUrl(avatar);
  if (!url) return undefined;
  if (width > 96 || Math.abs(ratio - 4 / 3) > 0.01) {
    // eslint-disable-next-line no-console
    console.warn(`avatarPortraitSrc: no rendition for ${width}px at ${ratio}; serving pt192x256`);
  }
  return variantUrl(url, 'pt192x256');
}
