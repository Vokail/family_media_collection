-- Vinyl condition grade (Discogs-compatible)
alter table items
  add column if not exists condition text
    check (condition in ('mint', 'near_mint', 'good', 'poor'));
