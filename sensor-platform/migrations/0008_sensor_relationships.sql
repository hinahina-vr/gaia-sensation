CREATE TABLE IF NOT EXISTS sensor_relationships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('FAVORITE', 'LIKE')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, device_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_sensor_relationships_device_kind
  ON sensor_relationships(device_id, kind, created_at);
