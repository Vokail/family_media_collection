-- Public buckets serve files via direct URL — a broad SELECT policy is unnecessary
-- and allows clients to list all files in the bucket, which is more exposure than needed.
drop policy if exists "Public read covers" on storage.objects;
