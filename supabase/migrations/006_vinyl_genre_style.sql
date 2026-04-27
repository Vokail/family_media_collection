-- Add genre and style columns for vinyl items (stored as comma-separated text)
ALTER TABLE items ADD COLUMN IF NOT EXISTS genres TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS styles TEXT;
