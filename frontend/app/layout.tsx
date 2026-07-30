import type { Metadata, Viewport } from 'next';
import { Amiri, Aref_Ruqaa, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import NewsTicker from '@/components/layout/NewsTicker';
import MastheadBanner from '@/components/layout/MastheadBanner';
import Footer from '@/components/layout/Footer';
import ScrollToTop from '@/components/ui/ScrollToTop';
import { API_URL } from '@/lib/api';
import {
  SITE_URL,
  SITE_NAME,
  SITE_NAME_EN,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  TWITTER_HANDLE,
  buildOrganizationSchema,
  buildWebsiteSchema,
  jsonLdScript,
} from '@/lib/utils/seoUtils';
import './globals.css';

// Nav categories rarely change — fetch via the Next Data Cache (revalidate)
// instead of an uncached axios call, so every page render reuses the cached
// result instead of re-hitting the backend.
async function getSiteSettingsCached() {
  try {
    const res = await fetch(`${API_URL}/homepage/settings`, { next: { revalidate: 600, tags: ['site-settings'] } });
    if (!res.ok) return null;
    return (await res.json()).data || null;
  } catch {
    return null;
  }
}

async function getNavCategoriesCached() {
  try {
    const res = await fetch(`${API_URL}/categories/nav`, { next: { revalidate: 600, tags: ['nav'] } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
  preload: true,
});

const arefRuqaa = Aref_Ruqaa({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-aref-ruqaa',
  display: 'swap',
  preload: true,
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // The Latin brand rides along on the homepage title so "Al-Telegraph"
    // queries have something to match; inner pages stay Arabic-only.
    default: `التلغراف — مجلة أدبية وثقافية | ${SITE_NAME_EN}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  applicationName: SITE_NAME,
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ar_IQ',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `التلغراف — مجلة أدبية وثقافية | ${SITE_NAME_EN}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-default.jpg`,
        width: 1200,
        height: 630,
        alt: `التلغراف — مجلة أدبية وثقافية | ${SITE_NAME_EN}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: `التلغراف — مجلة أدبية وثقافية | ${SITE_NAME_EN}`,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-default.jpg`],
  },
  // NOTE: no `alternates.canonical` here on purpose. A canonical set in the
  // root layout is inherited by every page that doesn't override it, which
  // previously pointed the category, tag and author pages at the homepage and
  // told Google not to index them. Each page declares its own.
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  category: 'literature',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#10151f' },
    { media: '(prefers-color-scheme: dark)', color: '#0c111a' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch nav categories server-side so Navbar/MobileMenu render identical
  // markup on server and client (avoids hydration mismatch). Falls back to
  // static-only links if the backend is unreachable.
  const navCategories = await getNavCategoriesCached();
  const siteSettings = await getSiteSettingsCached();

  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${amiri.variable} ${arefRuqaa.variable} ${plexArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
        {/* Facebook's Sharing Debugger flags a missing fb:app_id, and the Share
            Dialog requires one. Written by hand rather than through Next's
            `other` metadata field because that emits <meta name>, while
            Facebook's parser looks for <meta property>. Rendered only when the
            id is configured — an empty fb:app_id is worse than none. */}
        {process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ? (
          <meta property="fb:app_id" content={process.env.NEXT_PUBLIC_FACEBOOK_APP_ID} />
        ) : null}
        {/* Who the publisher is, and how to search the site — this is what
            Google reads for the brand panel and the sitelinks search box. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(buildOrganizationSchema())}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(buildWebsiteSchema())}
        />
        {/* Marks JS availability so scroll-reveal styles only hide content when they can be revealed */}
        <script
          dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.add('js')` }}
        />
      </head>
      <body className="font-arabic bg-background text-gray-900 dark:bg-background-dark dark:text-gray-100 antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange={false}
        >
          <div id="root-layout" className="flex flex-col min-h-screen">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-50 bg-accent text-white px-4 py-2 rounded-md font-heading"
            >
              انتقل إلى المحتوى الرئيسي
            </a>
            <NewsTicker />
            <MastheadBanner imageUrl={siteSettings?.masthead?.imageUrl} enabled={siteSettings?.masthead?.enabled !== false} />
            <Navbar categories={navCategories} />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <ScrollToTop />
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: 'var(--font-plex-arabic)',
                direction: 'rtl',
                textAlign: 'right',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
