-- Run once on existing databases (new installs get this from schema.sql)
ALTER TABLE list_albums ADD COLUMN IF NOT EXISTS listened_at TIMESTAMPTZ;
