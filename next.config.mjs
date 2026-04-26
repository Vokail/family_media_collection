/** @type {import('next').NextConfig} */
const nextConfig = {
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
