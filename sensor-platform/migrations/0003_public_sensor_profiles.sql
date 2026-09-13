ALTER TABLE users ADD COLUMN public_id TEXT;
ALTER TABLE users ADD COLUMN avatar_key TEXT;
ALTER TABLE users ADD COLUMN avatar_updated_at TEXT;
ALTER TABLE users ADD COLUMN x_url TEXT;
ALTER TABLE users ADD COLUMN github_url TEXT;
ALTER TABLE users ADD COLUMN instagram_url TEXT;

UPDATE users
SET public_id = 'usr_' || lower(hex(randomblob(12)))
WHERE public_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);

ALTER TABLE device_pairing_codes ADD COLUMN public_latitude REAL;
ALTER TABLE device_pairing_codes ADD COLUMN public_longitude REAL;
ALTER TABLE device_pairing_codes ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1));

ALTER TABLE devices ADD COLUMN public_id TEXT;
ALTER TABLE devices ADD COLUMN public_latitude REAL;
ALTER TABLE devices ADD COLUMN public_longitude REAL;
ALTER TABLE devices ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1));

UPDATE devices
SET public_id = 'sensor_' || lower(hex(randomblob(12)))
WHERE public_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_public_id ON devices(public_id);
CREATE INDEX IF NOT EXISTS idx_devices_public_map
  ON devices(is_public, status, deleted_at, public_latitude, public_longitude);
