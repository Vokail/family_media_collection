# Our Collection

A private family web app for tracking vinyl records, books, and comics — with cover art, barcode scanning, wishlists, and two-tier access.

## Features

- **Per-member collections** — each family member has their own collection
- **4 collection types** — Vinyl, Books, Comics, Lego
- **Cover art** — auto-fetched from Discogs, OpenLibrary, and ComicVine, resized and stored in Supabase Storage
- **Barcode scanning** — scan ISBN or vinyl barcodes with your phone camera to add items instantly; manga/graphic novel ISBN barcodes work for comics too
- **Descriptions** — books and comics get descriptions auto-fetched on add; language-aware for Dutch/French/German books (Google Books preferred, OpenLibrary fallback)
- **Vinyl tracklist** — automatically fetched from Discogs when adding a record
- **Wishlist** — toggle items between owned and wishlist; counts shown on each tab
- **Sorting** — by artist/author (with A–Z index sidebar), title, year (with decade grouping), or date added
- **Language filter** — controls which description language is fetched (Dutch default); does not restrict search results
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
- External APIs: [OpenLibrary](https://openlibrary.org/developers/api), [Discogs](https://www.discogs.com/developers), [ComicVine](https://comicvine.gamespot.com/api/), [Rebrickable](https://rebrickable.com/api/) (Lego)

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
| `REBRICKABLE_API_KEY` | Rebrickable API key (for Lego sets) |

## Database Setup

All migrations live in `supabase/migrations/`. Run them in the Supabase SQL Editor in order.

### Fresh installation

Run all migrations in sequence:

| File | What it does |
|---|---|
| `001_init.sql` | Full schema: members, items, settings, storage bucket + policy |
| `002_drop_broad_storage_select_policy.sql` | Security: removes unnecessary broad SELECT policy on covers bucket |
| `003_items_extended_fields.sql` | No-op on fresh install (columns already in 001); safe to run anyway. Adds: tracklist, sort_name, external_id, isbn, description, rating |

Then add your family members (edit names/slugs to match your family):

```sql
insert into members (name, slug) values
  ('Alice',   'alice'),
  ('Bob', 'bob'),
  ('Carol',   'carol'),
  ('Dave',    'dave');
```

### Upgrading an existing installation

Run only the migrations you haven't applied yet, in order:

```
002_drop_broad_storage_select_policy.sql  — if you haven't run it
003_items_extended_fields.sql             — adds tracklist, sort_name, external_id, isbn, description; expands collection check to include 'lego'
```

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
