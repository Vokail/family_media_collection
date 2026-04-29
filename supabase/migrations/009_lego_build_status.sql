ALTER TABLE items
  ADD COLUMN IF NOT EXISTS lego_status TEXT
    CHECK (lego_status IN ('built', 'in_box', 'disassembled'))
    DEFAULT NULL;
