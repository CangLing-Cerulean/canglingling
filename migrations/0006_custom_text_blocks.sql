ALTER TABLE site_settings
  ADD COLUMN custom_blocks_json TEXT NOT NULL DEFAULT '[]';
