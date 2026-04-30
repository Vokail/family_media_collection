-- Track which fields were manually edited so backfill doesn't overwrite them
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS locked_fields TEXT[] DEFAULT NULL;
