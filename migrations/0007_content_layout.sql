ALTER TABLE site_settings
  ADD COLUMN content_layout_json TEXT NOT NULL DEFAULT '{}';
