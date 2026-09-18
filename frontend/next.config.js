/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    // Serve images straight from Cloudinary's CDN (f_auto,q_auto,w_) instead of
    // the Next optimizer, which was dropping concurrent lazy thumbnail requests
    // on the Railway container. See lib/cloudinaryLoader.js.
    loader: 'custom',
    loaderFile: './lib/cloudinaryLoader.js',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/**',
      },
    ],
    // Inert with loader: 'custom' — Next only reads this for its own optimizer.
    // The delivered format is decided in lib/cloudinaryLoader.js.
    formats: ['image/avif', 'image/webp'],
    // Every width listed here is a file Cloudinary generates, stores and bills
    // for, per image and per format. The defaults are 16 widths; at ~1,160
    // images that was 20,624 stored assets against 1,160 real photographs.
    //
    // These are the widths the layouts actually ask for. Nothing on the site
    // renders wider than 960 CSS px (the hero is 896), so 1920 covers every
    // case at 2x DPR and 2048/3840 only ever produced files no one displayed.
    deviceSizes: [640, 828, 1200, 1920],
    // Avatars: 36/64/72/96/128 CSS px, so these cover them at 1x and 2x.
    imageSizes: [64, 128, 256, 384],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@headlessui/react'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [];
  },
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
