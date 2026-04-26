# Our Collection — Design Spec
_2026-04-25_

## Overview

A private family web app for tracking vinyl records, books, and comic books — one collection area per family member. Cover art is fetched automatically from public APIs and stored locally. Hosted for free with no credit card required.

---

## Family Members

- Ewart
- Marieke
- Lotte
- Noud

---

## Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend + API routes | Next.js 14 (App Router) | free |
| Hosting | Vercel (Hobby free tier) | free |
| Database | Supabase PostgreSQL (free tier) | free |
| File storage | Supabase Storage (1 GB free) | free |
| Keep-alive | Vercel Cron (1 free per project) | free |
| Auth | HTTP-only encrypted cookie (`iron-session`) | free |

**Total cost: $0. No credit card required.**

**Prerequisites (all free, sign up with existing GitHub account):**
- github.com — already have this ✓ — repo: `Vokail/family_media_collection`
- vercel.com — "Continue with GitHub"
- supabase.com — "Continue with GitHub"

---

## Authentication

Two access levels stored in a `settings` table in Supabase as **bcrypt hashes** (never plain text):

| Level | DB key | What it allows |
|-------|--------|----------------|
| Viewer | `view_pin_hash` | Browse all collections (read-only) |
| Editor | `family_password_hash` | Browse + add, edit, delete items + access Settings |

**Login page (`/`)** shows a single password/PIN field. The app uses `bcryptjs` to compare the input against both stored hashes:
- Matches `view_pin_hash` → sets a `role=viewer` cookie (7-day expiry). Read-only.
- Matches `family_password_hash` → sets a `role=editor` cookie (7-day expiry). Full access.
- Matches neither → error message.

**Security:** Plain text passwords are never stored or logged anywhere. The hash is a one-way transformation — even with direct database access, the real PIN/password cannot be recovered.

**Initial setup:** On first deploy, the app checks whether `settings` rows exist. If not, it seeds them from `INITIAL_VIEW_PIN` and `INITIAL_FAMILY_PASSWORD` env vars (set once in Vercel, then can be changed from the Settings screen inside the app).

Next.js middleware protects all routes except `/`:
- No cookie → redirect to `/`.
- `viewer` cookie → read-only access; `+` button, edit controls, and delete buttons are hidden.
- `editor` cookie → full access.

No per-user accounts. After login, the user picks whose collection to view.

---

## Architecture

```
Browser
  └─ Next.js App Router (Vercel)
       ├─ Pages (RSC)         — login, member selector, collection grid, add-item
       ├─ API Routes          — auth, search, barcode, items CRUD, ping (cron)
       └─ Middleware          — cookie auth guard on all non-login routes

Supabase
  ├─ PostgreSQL               — members, items tables
  └─ Storage bucket: covers   — downloaded cover images

External APIs (server-side only, keys never exposed to browser)
  ├─ OpenLibrary.org          — book search + ISBN barcode lookup (no key)
  ├─ Discogs API              — vinyl search + barcode lookup (free API key)
  └─ ComicVine API            — comic search (free API key)

Vercel Cron
  └─ Every 5 days → GET /api/ping → SELECT 1 on Supabase (prevents 7-day pause)
```

---

## Database Schema

### `members`
| column | type | notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| name | text | not null — display name e.g. `Ewart` |
| slug | text | not null, unique — URL-safe lowercase e.g. `ewart` |

Seeded at deploy time with: Ewart (`ewart`), Marieke (`marieke`), Lotte (`lotte`), Noud (`noud`).

### `settings`
| column | type | notes |
|--------|------|-------|
| key | text | PK — `view_pin_hash` or `family_password_hash` |
| value | text | bcrypt hash of the PIN or password |

Seeded on first deploy from `INITIAL_VIEW_PIN` and `INITIAL_FAMILY_PASSWORD` env vars.

### `items`
| column | type | notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| member_id | uuid | FK → members.id |
| collection | text | `vinyl` / `book` / `comic` |
| title | text | not null |
| creator | text | artist / author / writer |
| year | integer | nullable |
| cover_path | text | path in Supabase Storage, nullable |
| is_wishlist | boolean | false = owned, true = wishlist |
| notes | text | nullable |
| created_at | timestamptz | default now() |

Cover images stored as: `covers/{member_id}/{item_id}.jpg`

---

## Routing

| Route | Description |
|-------|-------------|
| `/` | Login — password entry |
| `/members` | Member selector — 4 cards (Ewart, Marieke, Lotte, Noud) |
| `/[member]` | Redirect → `/[member]/vinyl` — `[member]` is the lowercase name slug (e.g. `ewart`) |
| `/[member]/[collection]` | Collection grid (vinyl / book / comic) |
| `/[member]/[collection]/add` | Add item — search or barcode scan |
| `/settings` | Editor-only — change view PIN and family password |

---

## Screens

### Login (`/`)
- App name, single password input, submit button.
- On success: set encrypted cookie, redirect to `/members`.

### Member Selector (`/members`)
- 2×2 grid of member cards with name and avatar initial.
- Tap a card → navigate to that member's collection.

### Collection Grid (`/[member]/[collection]`)
- Header: member name + back to members link.
- Tab bar: Vinyl · Books · Comics.
- Toggle: Owned / Wishlist.
- Cover art grid (3 columns on mobile, 5+ on desktop).
- Floating `+` button → navigate to add-item screen.
- Tap a cover → item detail sheet (title, creator, year, notes, owned↔wishlist toggle, delete).

### Add Item (`/[member]/[collection]/add`)
- Search bar + camera icon (barcode).
- Results list: cover thumbnail, title, creator, year, "Add to Collection" / "Add to Wishlist" buttons.
- On add: cover fetched server-side from external API, saved to Supabase Storage, item row inserted.

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth` | POST | Verify password, set cookie |
| `/api/auth` | DELETE | Clear cookie (logout) |
| `/api/search` | GET | `?q=…&type=vinyl\|book\|comic` — proxy to external APIs |
| `/api/barcode` | GET | `?code=…&type=vinyl\|book\|comic` — barcode lookup |
| `/api/items` | GET | List items for a member+collection |
| `/api/items` | POST | Add item (triggers cover download) |
| `/api/items/[id]` | PATCH | Update item (notes, is_wishlist toggle) |
| `/api/items/[id]` | DELETE | Remove item + cover from storage |
| `/api/ping` | GET | Cron endpoint — lightweight Supabase query |
| `/api/settings` | PATCH | Update view PIN or family password (editor only) — bcrypt hashes new value before saving |

All routes except `/api/auth POST` verify the session cookie. Write routes (`POST`, `PATCH`, `DELETE` on `/api/items`, and `/api/items/[id]`) additionally require `role=editor` — a viewer cookie is rejected with 403.

---

## Image Lookup

All API calls to external services are made server-side (API routes), so keys are never exposed to the browser.

| Collection | API | Barcode support |
|-----------|-----|----------------|
| Books | OpenLibrary.org | Yes — ISBN-10/ISBN-13 |
| Vinyl | Discogs API | Yes — most barcodes |
| Comics | ComicVine API | Search only (no barcode standard) |

> **Comic barcode fallback:** Comics have no universal barcode standard. When a user scans a barcode on a comic, the app uses the decoded number as a text search query against ComicVine rather than a direct lookup.

> **Missing cover fallback:** If no cover image is available from the external API, `cover_path` remains null and the UI shows a styled placeholder tile (collection icon + title text).

**Cover download flow:**
1. User selects a result from the search/barcode screen.
2. `POST /api/items` receives the external cover URL.
3. API route fetches the image, resizes to max 600px wide (using `sharp`), uploads to Supabase Storage.
4. `cover_path` stored in DB. External URL discarded.

---

## Theme & Visual Style

**Direction: Warm & Cozy**

- Background: warm cream (`#f5ede0`) in light mode, dark brown (`#1c1510`) in dark mode
- Accent colour: amber/terracotta (`#c67c3c`)
- Typography: serif font (e.g. Georgia or Lora) for headings, system-ui for body text
- Cover cards: slightly rounded corners, soft drop shadow
- Buttons: pill-shaped with amber fill
- Tab bar: active tab uses amber pill, inactive tabs are muted
- Auto dark/light — follows the device/OS `prefers-color-scheme`. In dark mode the cream flips to dark brown; accent colour stays amber.

Design is mobile-first (large touch targets, 3-column cover grid on phone) with a wider grid on desktop.

---

## Keep-Alive Cron

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/ping", "schedule": "0 0 */5 * *" }
  ]
}
```

`/api/ping` runs a `SELECT 1` via the Supabase client. Supabase free tier pauses after 7 days of inactivity — this cron fires every 5 days, preventing the pause entirely.

---

## Verification Plan

1. **Auth** — visiting `/members` without a cookie redirects to `/`. VIEW_PIN grants read-only access (no `+` or edit controls visible). FAMILY_PASSWORD grants full access. Wrong input shows error.
2. **Member selector** — all 4 members appear. Tapping one navigates to their vinyl collection.
3. **Search** — searching "Dark Side of the Moon" on vinyl returns results with cover art.
4. **Barcode** — scanning an ISBN on a book cover returns the correct book.
5. **Add item** — adding a result saves it to the grid with the downloaded cover image.
6. **Wishlist** — toggling owned↔wishlist moves the item between tabs.
7. **Delete** — deleting an item removes it from the grid and its cover from Supabase Storage.
8. **Cron** — `/api/ping` returns 200 and Supabase connection is confirmed in logs.
9. **Theme** — switching OS to dark mode changes the app theme automatically.
10. **Responsive** — grid looks correct on 375px (iPhone SE) and 1280px (desktop).
