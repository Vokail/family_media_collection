import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { version } = require('./package.json')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables Next 14's instrumentation.ts hook (becomes stable in Next 15).
  // The hook is a no-op outside Playwright test mode — see ./instrumentation.ts.
  experimental: {
    instrumentationHook: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hkbqrbgqytvgpftydapc.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
      },
      {
        protocol: 'https',
        hostname: '*.discogs.com',
      },
      {
        protocol: 'https',
        hostname: 'comicvine.gamespot.com',
      },
      {
        protocol: 'https',
        hostname: 'books.google.com',
      },
    ],
  },
}

export default nextConfig
