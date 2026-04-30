# Our Collection

A private family web app for tracking vinyl records, books, and comics — with cover art, barcode scanning, wishlists, and two-tier access.

## Features

- **Per-member collections** — each family member has their own collection
- **4 collection types** — Vinyl, Books, Comics, Lego
- **Cover art** — auto-fetched from Discogs, OpenLibrary, and ComicVine, resized and stored in Supabase Storage
- **Barcode scanning** — scan ISBN or vinyl barcodes with your phone camera to add items instantly; manga/graphic novel ISBN barcodes work for comics too
- **Cover scan OCR** — photograph a book, record, or comic cover to auto-identify title and creator using OpenRouter (Llama 3.2 Vision); falls back to manual form if the key is not configured
- **Descriptions** — books and comics get descriptions auto-fetched on add; language-aware for Dutch/French/German books (Google Books preferred, OpenLibrary fallback)
- **Vinyl tracklist** — automatically fetched from Discogs when adding a record; search cards show format (LP/7"), label, country, catalogue number to distinguish editions; tap "Details & tracklist" on any search result for a full preview before adding
- **Wishlist** — toggle items between owned and wishlist; counts shown on each tab; family-wide wishlist view at `/wishlist`
- **Sorting** — by artist/author (with A–Z index sidebar), title, year (with decade grouping), or date added
- **Language filter** — controls which description language is fetched (Dutch default); does not restrict search results
- **Three-tier access** — view PIN for read-only browsing, per-member PIN for editing your own collection only, family password for full admin access; members can change their own PIN from `/profile`
- **Per-member collection visibility** — each member can hide collections they don't use (e.g. disable Lego); toggled from their profile page via the 👤 icon in the collection header; data is never deleted, just hidden
- **Read/Listened status** — mark items as read or listened; filter your collection by All / Unread / Read (or Unlistened / Listened for vinyl)
- **Ratings** — 1–5 star rating per item shown as an overlay on cover art
- **Activity feed** — recent additions across all members shown on the members home screen
- **Add-more flow** — after adding an item the search page stays open ready for the next one; a "View collection" action in the success toast navigates back when done
- **Pull-to-refresh** — drag down on any page (collection, wishlist, members) to reload fresh data
- **PWA** — installable on iPhone via Safari → Add to Home Screen; cover images cached locally for offline browsing
- **Dark mode** — automatic, follows OS setting
- **Keep-alive cron** — pings Supabase every 5 days to prevent cold starts

## Tech Stack

- [Next.js 14](https://nextjs.org) App Router, TypeScript, Tailwind CSS
- [Supabase](https://supabase.com) — PostgreSQL + file storage
- [iron-session](https://github.com/vvo/iron-session) — encrypted HTTP-only session cookies
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — hashed credentials stored in DB
- [ZXing](https://github.com/zxing-js/browser) — barcode scanning via camera
- [sharp](https://sharp.pixelplumbing.com) — image resize before upload
- [OpenRouter](https://openrouter.ai) — vision model API for cover scan OCR (Llama 3.2 Vision, free tier)
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
| `OPENROUTER_API_KEY` | OpenRouter API key for cover scan OCR (free tier — [get one here](https://openrouter.ai)) |

## Database Setup

All migrations live in `supabase/migrations/`. Run them in the Supabase SQL Editor in order.

### Fresh installation

Run all migrations in sequence:

| File | What it does |
|---|---|
| `001_init.sql` | Full schema: members, items, settings, storage bucket + policy |
| `002_drop_broad_storage_select_policy.sql` | Security: removes unnecessary broad SELECT policy on covers bucket |
| `003_items_extended_fields.sql` | No-op on fresh install (columns already in 001); safe to run anyway. Adds: tracklist, sort_name, external_id, isbn, description, rating |
| `004_items_rating.sql` | No-op on fresh install; adds rating column for installations that ran 003 before rating was introduced |
| `005_member_pins.sql` | Adds `pin_hash` column to members table for per-member PIN login |
| `006_vinyl_genre_style.sql` | Adds `genres` and `styles` columns to items for Discogs genre/style tags |
| `007_item_status.sql` | Adds `status` column to items for read/listened tracking |
| `008_member_enabled_collections.sql` | Adds `enabled_collections` array to members for per-member collection visibility |
| `009_lego_build_status.sql` | Adds `lego_status` column to items (`built` / `in_box` / `disassembled`) |
| `010_locked_fields.sql` | Adds `locked_fields` text array to items — tracks manually-edited fields so backfill won't overwrite them |
| `011_item_counts_fn.sql` | Adds `get_member_item_counts()` DB function — returns owned-item counts grouped by member + collection (replaces full table scan) |

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
004_items_rating.sql                      — adds rating column (if not already present from 003)
005_member_pins.sql                       — adds pin_hash column to members for per-member PIN login
006_vinyl_genre_style.sql                 — adds genres and styles columns to items
007_item_status.sql                       — adds status column to items (read/listened tracking)
008_member_enabled_collections.sql        — adds enabled_collections array to members
009_lego_build_status.sql                 — adds lego_status column (built / in_box / disassembled)
010_locked_fields.sql                     — adds locked_fields text array to protect manually-edited fields from backfill
011_item_counts_fn.sql                    — adds get_member_item_counts() DB function for efficient member stats counts
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
