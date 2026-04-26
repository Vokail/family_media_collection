-- Adds extended item fields and Lego collection type for existing installations.
-- Safe to run on any database that was set up with 001_init.sql.
-- Fresh installations using the updated 001_init.sql do not need this migration.

alter table items
  add column if not exists tracklist   jsonb,
  add column if not exists sort_name   text,
  add column if not exists external_id text,
  add column if not exists isbn        text,
  add column if not exists description text;

-- Expand collection check to include 'lego'
alter table items drop constraint if exists items_collection_check;
alter table items add constraint items_collection_check
  check (collection in ('vinyl', 'book', 'comic', 'lego'));
