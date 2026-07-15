import type { Metadata, Viewport } from 'next';
import { Amiri, Aref_Ruqaa, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import NewsTicker from '@/components/layout/NewsTicker';
import Footer from '@/components/layout/Footer';
import ScrollToTop from '@/components/ui/ScrollToTop';
import { API_URL } from '@/lib/api';
import './globals.css';

// Nav categories rarely change — fetch via the Next Data Cache (revalidate)
// instead of an uncached axios call, so every page render reuses the cached
// result instead of re-hitting the backend.
async function getNavCategoriesCached() {
  try {
    const res = await fetch(`${API_URL}/categories/nav`, { next: { revalidate: 600 } });
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://altilgraf.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'التلغراف - مجلة أدبية وثقافية',
    template: '%s | التلغراف',
  },
  description:
    'التلغراف — مجلة ثقافية وأدبية تُعنى بالشعر والسرد والقراءات النقدية والفكر والحوار والترجمة',
  keywords: ['أدب', 'شعر', 'سرد', 'ثقافة', 'نقد', 'ترجمة', 'التلغراف'],
  authors: [{ name: 'التلغراف' }],
  creator: 'التلغراف',
  publisher: 'التلغراف',
  applicationName: 'التلغراف',
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
    siteName: 'التلغراف',
    title: 'التلغراف - مجلة أدبية وثقافية',
    description:
      'التلغراف — مجلة ثقافية وأدبية تُعنى بالشعر والسرد والقراءات النقدية والفكر والحوار والترجمة',
    images: [
      {
        url: `${SITE_URL}/og-default.jpg`,
        width: 1200,
        height: 630,
        alt: 'التلغراف - مجلة أدبية وثقافية',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@altilgraf',
    creator: '@altilgraf',
    title: 'التلغراف - مجلة أدبية وثقافية',
    description: 'التلغراف — مجلة ثقافية وأدبية',
    images: [`${SITE_URL}/og-default.jpg`],
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      'ar': SITE_URL,
    },
  },
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
            <Navbar categories={navCategories} />
            <main id="main-content" className="flex-1 mt-[calc(var(--navbar-height)+var(--ticker-height))]">
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
