-- Add per-member PIN hashes for member-level edit access
ALTER TABLE members ADD COLUMN IF NOT EXISTS pin_hash TEXT;
