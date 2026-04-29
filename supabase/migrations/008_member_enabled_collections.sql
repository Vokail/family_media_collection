ALTER TABLE members
  ADD COLUMN IF NOT EXISTS enabled_collections TEXT[] NOT NULL DEFAULT ARRAY['vinyl','book','comic','lego'];
