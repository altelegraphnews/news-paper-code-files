// Custom next/image loader.
//
// Every picture is stored on R2 in a fixed set of widths, cut once at upload
// because R2 cannot resize on request (backend/src/services/mediaVariants.js).
// next/image only ever asks for the widths listed in next.config's
// deviceSizes and imageSizes, and each of those has a stored rendition, so
// the loader maps the width straight to its file. Covers still written as
// Cloudinary URLs map to the same files: every key kept its public_id.
//
// It also keeps the Next.js image optimizer out of the way, which on the
// resource-limited Railway container dropped bursts of concurrent lazy
// thumbnail requests (hero loaded, cards came up blank).
//
// Anything that is not ours (the local logo, icons) is returned unchanged.
// `quality` is ignored: renditions are encoded once, at a fixed quality.
import { loaderVariant, variantUrl } from './media';

export default function mediaLoader({ src, width }) {
  return variantUrl(src, loaderVariant(width));
}
