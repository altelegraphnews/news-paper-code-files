import Link from 'next/link';

/**
 * Newspaper masthead — sits between the fixed news ticker and the navbar.
 * It scrolls away with the page (the navbar then sticks just under the
 * ticker). Presented on a fixed parchment band in both light and dark themes
 * so it reads like a printed nameplate rather than a bright block in the dark.
 *
 * Uses a plain <img> on purpose: next/image is wired to a Cloudinary loader
 * for remote assets (see next.config.js), so local /public images go through
 * a bare tag — same as the navbar logo.
 */
export default function MastheadBanner() {
  return (
    <div
      className="masthead mt-[var(--ticker-height)] w-full border-b border-accent/40"
      style={{ backgroundColor: '#efe7d6' }}
    >
      <Link
        href="/"
        aria-label="التلغراف — الصفحة الرئيسية"
        className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      >
        <img
          src="/masthead.jpg"
          alt="التلغراف — مجلة أدبية وثقافية"
          width={1200}
          height={200}
          className="block w-full h-auto select-none"
          draggable={false}
        />
      </Link>
    </div>
  );
}
