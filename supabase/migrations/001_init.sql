-- Members
create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

-- Add your family members here, e.g.:
-- insert into members (name, slug) values ('Alice', 'alice'), ('Bob', 'bob');

-- Items
create table items (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  collection  text not null check (collection in ('vinyl','book','comic')),
  title       text not null,
  creator     text not null default '',
  year        integer,
  cover_path  text,
  is_wishlist boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

create index on items(member_id, collection, is_wishlist);

-- Settings (bcrypt hashed credentials)
create table settings (
  key   text primary key,
  value text not null
);

-- Storage bucket for cover images
insert into storage.buckets (id, name, public) values ('covers', 'covers', true);

-- Allow public read of covers bucket
create policy "Public read covers"
  on storage.objects for select
  using (bucket_id = 'covers');

-- Allow service role to upload/delete covers
create policy "Service role manages covers"
  on storage.objects for all
  using (auth.role() = 'service_role');
