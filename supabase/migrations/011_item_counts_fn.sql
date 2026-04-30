-- Aggregate item counts server-side to avoid pulling all rows into JS.
-- Returns one row per (member_id, collection) pair with the owned-item count.
create or replace function get_member_item_counts()
returns table(member_id uuid, collection text, count bigint)
language sql
security definer
as $$
  select member_id, collection, count(*) as count
  from items
  where is_wishlist = false
  group by member_id, collection
$$;
