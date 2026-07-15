// Author avatars come from the API as { url, publicId } (the User.avatar
// subdocument), but older code/types treated avatar as a plain string URL.
// This normalizes either shape to a usable image URL string.
export type AvatarLike = string | { url?: string; publicId?: string } | null | undefined;

export function avatarUrl(avatar: AvatarLike): string | undefined {
  if (!avatar) return undefined;
  if (typeof avatar === 'string') return avatar || undefined;
  return avatar.url || undefined;
}
