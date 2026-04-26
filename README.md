# Our Collection

A private family web app for tracking vinyl records, books, and comics — with cover art, barcode scanning, wishlists, and two-tier access.

## Features

- **4 family members** — Alice, Bob, Carol, Dave, each with their own collection
- **3 collection types** — Vinyl, Books, Comics
- **Cover art** — auto-fetched from Discogs, OpenLibrary, and ComicVine, resized and stored in Supabase Storage
- **Barcode scanning** — scan ISBN or vinyl barcodes with your phone camera to add items instantly
- **Vinyl tracklist** — automatically fetched from Discogs when adding a record
- **Wishlist** — toggle items between owned and wishlist; counts shown on each tab
- **Sorting** — by artist/author (with A–Z index sidebar), title, year (with decade grouping), or date added
- **Language filter** — book searches default to Dutch, with English, French, and German options
- **Two-tier access** — view PIN for read-only browsing, family password for full edit access
- **PWA** — installable on iPhone via Safari → Add to Home Screen
- **Dark mode** — automatic, follows OS setting
- **Keep-alive cron** — pings Supabase every 5 days to prevent cold starts

## Tech Stack

- [Next.js 14](https://nextjs.org) App Router, TypeScript, Tailwind CSS
- [Supabase](https://supabase.com) — PostgreSQL + file storage
- [iron-session](https://github.com/vvo/iron-session) — encrypted HTTP-only session cookies
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — hashed credentials stored in DB
- [ZXing](https://github.com/zxing-js/browser) — barcode scanning via camera
- [sharp](https://sharp.pixelplumbing.com) — image resize before upload
- External APIs: [OpenLibrary](https://openlibrary.org/developers/api), [Discogs](https://www.discogs.com/developers), [ComicVine](https://comicvine.gamespot.com/api/)

## Deployment

Hosted on [Vercel](https://vercel.com) (free Hobby plan) with [Supabase](https://supabase.com) free tier.

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `SESSION_SECRET` | Random 32+ char string for cookie encryption |
| `INITIAL_VIEW_PIN` | PIN for read-only access (seeded on first login) |
| `INITIAL_FAMILY_PASSWORD` | Password for editor access (seeded on first login) |
| `DISCOGS_API_KEY` | Discogs API token |
| `COMICVINE_API_KEY` | ComicVine API key |

## Database

Run `supabase/migrations/001_init.sql` in the Supabase SQL Editor to create the schema and seed the four family members. Also run `ALTER TABLE items ADD COLUMN tracklist jsonb;` if upgrading from an earlier version.

## Local Development

```bash
npm install
cp .env.local.example .env.local  # fill in your credentials
npm run dev
```

## Tests

```bash
npm test
```
