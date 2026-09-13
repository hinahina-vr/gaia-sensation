-- Public map reads happen frequently, while telemetry and relationship writes
-- are comparatively rare. Keep exact display statistics at write time so the
-- public endpoint never has to scan the full telemetry/relationship history.

CREATE INDEX IF NOT EXISTS idx_telemetry_device_received_seq
  ON telemetry(device_id, received_at DESC, seq DESC);

CREATE INDEX IF NOT EXISTS idx_devices_public_created
  ON devices(is_public, status, deleted_at, created_at DESC)
  WHERE public_latitude IS NOT NULL
    AND public_longitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS device_telemetry_rollups (
  device_id TEXT PRIMARY KEY REFERENCES devices(device_id) ON DELETE CASCADE,
  observation_count INTEGER NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
  first_received_at TEXT,
  last_received_at TEXT,
  payload_bytes INTEGER NOT NULL DEFAULT 0 CHECK (payload_bytes >= 0),
  recent_payloads_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(recent_payloads_json) AND json_type(recent_payloads_json) = 'array'),
  updated_at TEXT NOT NULL
);

-- Telemetry is append-only in the application. Deleting a device cascades to
-- both telemetry and its rollup, so no expensive per-row DELETE recomputation
-- is needed during account cleanup.

INSERT INTO device_telemetry_rollups
  (device_id, observation_count, first_received_at, last_received_at, payload_bytes, updated_at)
SELECT device_id,
       COUNT(*),
       MIN(received_at),
       MAX(received_at),
       COALESCE(SUM(length(payload_json)), 0),
       MAX(received_at)
FROM telemetry
GROUP BY device_id
ON CONFLICT(device_id) DO UPDATE SET
  observation_count = excluded.observation_count,
  first_received_at = excluded.first_received_at,
  last_received_at = excluded.last_received_at,
  payload_bytes = excluded.payload_bytes,
  updated_at = excluded.updated_at;

UPDATE device_telemetry_rollups
SET recent_payloads_json = COALESCE((
  SELECT json_group_array(json(
    CASE WHEN json_valid(recent.payload_json) THEN recent.payload_json ELSE '{}' END
  ))
  FROM (
    SELECT t.payload_json
    FROM telemetry t
    WHERE t.device_id = device_telemetry_rollups.device_id
    ORDER BY t.received_at DESC, t.seq DESC
    LIMIT 12
  ) recent
), '[]');

CREATE TRIGGER IF NOT EXISTS telemetry_rollup_after_insert
AFTER INSERT ON telemetry
BEGIN
  INSERT INTO device_telemetry_rollups
    (device_id, observation_count, first_received_at, last_received_at, payload_bytes, recent_payloads_json, updated_at)
  VALUES
    (NEW.device_id, 1, NEW.received_at, NEW.received_at, length(NEW.payload_json),
     json_array(json(CASE WHEN json_valid(NEW.payload_json) THEN NEW.payload_json ELSE '{}' END)), NEW.received_at)
  ON CONFLICT(device_id) DO UPDATE SET
    observation_count = device_telemetry_rollups.observation_count + 1,
    first_received_at = CASE
      WHEN device_telemetry_rollups.first_received_at IS NULL
        OR NEW.received_at < device_telemetry_rollups.first_received_at THEN NEW.received_at
      ELSE device_telemetry_rollups.first_received_at
    END,
    last_received_at = CASE
      WHEN device_telemetry_rollups.last_received_at IS NULL
        OR NEW.received_at > device_telemetry_rollups.last_received_at THEN NEW.received_at
      ELSE device_telemetry_rollups.last_received_at
    END,
    payload_bytes = device_telemetry_rollups.payload_bytes + length(NEW.payload_json),
    recent_payloads_json = (
      SELECT json_group_array(json(
        CASE WHEN json_valid(candidate.payload_json) THEN candidate.payload_json ELSE '{}' END
      ))
      FROM (
        SELECT NEW.payload_json AS payload_json, -1 AS observation_order
        UNION ALL
        SELECT value AS payload_json, CAST(key AS INTEGER) AS observation_order
        FROM json_each(device_telemetry_rollups.recent_payloads_json)
        ORDER BY observation_order
        LIMIT 12
      ) candidate
    ),
    updated_at = NEW.received_at;
END;

CREATE TABLE IF NOT EXISTS device_social_rollups (
  device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  updated_at TEXT NOT NULL
);

INSERT INTO device_social_rollups (device_id, like_count, updated_at)
SELECT d.id,
       COUNT(r.user_id),
       COALESCE(MAX(r.created_at), d.updated_at)
FROM devices d
LEFT JOIN sensor_relationships r ON r.device_id = d.id AND r.kind = 'LIKE'
GROUP BY d.id
ON CONFLICT(device_id) DO UPDATE SET
  like_count = excluded.like_count,
  updated_at = excluded.updated_at;

CREATE TRIGGER IF NOT EXISTS social_rollup_after_like_insert
AFTER INSERT ON sensor_relationships
WHEN NEW.kind = 'LIKE'
BEGIN
  INSERT INTO device_social_rollups (device_id, like_count, updated_at)
  VALUES (NEW.device_id, 1, NEW.created_at)
  ON CONFLICT(device_id) DO UPDATE SET
    like_count = device_social_rollups.like_count + 1,
    updated_at = NEW.created_at;
END;

CREATE TRIGGER IF NOT EXISTS social_rollup_after_like_delete
AFTER DELETE ON sensor_relationships
WHEN OLD.kind = 'LIKE'
BEGIN
  UPDATE device_social_rollups
  SET like_count = MAX(0, like_count - 1),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE device_id = OLD.device_id;
END;
