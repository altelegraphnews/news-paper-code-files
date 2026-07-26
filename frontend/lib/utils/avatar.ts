// Author avatars come from the API as { url, publicId } (the User.avatar
// subdocument), but older code/types treated avatar as a plain string URL.
// This normalizes either shape to a usable image URL string.
export type AvatarLike = string | { url?: string; publicId?: string } | null | undefined;

export function avatarUrl(avatar: AvatarLike): string | undefined {
  if (!avatar) return undefined;
  if (typeof avatar === 'string') return avatar || undefined;
  return avatar.url || undefined;
}

/**
 * Cloudinary URL for a circular portrait, cropped square around the face.
 *
 * The site-wide image loader asks for `c_limit,w_<width>`, which keeps the
 * original aspect ratio. Author photos are whatever shape they were uploaded in
 * — plenty are landscape — so a 96px-wide request comes back 96×54, and CSS
 * `object-cover` then stretches those 54 rows to fill a 96px-tall circle. That
 * upscale is why the byline portrait looked soft: a 596×335 original was being
 * delivered as 96×54 for a 48px circle that needs 96×96 on a retina screen.
 *
 * A square crop puts the full size×size into the circle with nothing to
 * upscale, and `g_face` centres it on the face instead of trusting a centre
 * crop of a full-body shot. Cloudinary falls back to a centre crop when it
 * finds no face, so logos and illustrations still work.
 *
 * `size` is the CSS size of the circle; the request is doubled for retina.
 * Render with `unoptimized` so the global loader does not chain a second
 * transform on top — `c_limit` running first would squash the image back down
 * and reintroduce exactly the blur this avoids.
 */
export function avatarSrc(avatar: AvatarLike, size: number): string | undefined {
  const url = avatarUrl(avatar);
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  const px = Math.round(size * 2);
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_fill,g_face,w_${px},h_${px}/`);
}
