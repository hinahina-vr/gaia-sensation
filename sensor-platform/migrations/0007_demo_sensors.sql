ALTER TABLE devices ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0
  CHECK (is_demo IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_devices_public_demo
  ON devices(is_public, is_demo, status, deleted_at);

INSERT OR IGNORE INTO users
  (id, public_id, display_name, avatar_key, account_kind, created_at, updated_at)
VALUES
  ('user_demo_bluecat', 'usr_demo_bluecat', '青猫', 'campus-chat-bluecat', 'google', '2026-08-31T00:00:01.000Z', '2026-08-31T00:00:01.000Z'),
  ('user_demo_mizu', 'usr_demo_mizu', 'みず', 'campus-chat-mizu', 'google', '2026-08-31T00:00:02.000Z', '2026-08-31T00:00:02.000Z'),
  ('user_demo_saku', 'usr_demo_saku', 'saku', 'campus-chat-saku', 'google', '2026-08-31T00:00:03.000Z', '2026-08-31T00:00:03.000Z'),
  ('user_demo_ame', 'usr_demo_ame', 'あめ', 'campus-chat-ame', 'google', '2026-08-31T00:00:04.000Z', '2026-08-31T00:00:04.000Z');

INSERT OR IGNORE INTO devices
  (id, device_id, public_id, owner_user_id, name, token_hash, status,
   country_code, subdivision_code, municipality_code, admin1_code, locality_name,
   location_source, location_precision, public_latitude, public_longitude,
   is_public, is_demo, created_at, updated_at)
VALUES
  ('device_demo_bluecat', 'dev_demo_bluecat', 'sensor_demo_bluecat', 'user_demo_bluecat', '青猫センサー', lower(hex(randomblob(32))), 'ACTIVE',
   'JP', 'JP-13', '131016', NULL, '秋葉原', 'USER_DECLARED', 'LOCALITY', 35.7, 139.8,
   1, 1, '2026-08-31T00:00:01.000Z', '2026-08-31T00:00:01.000Z'),
  ('device_demo_mizu', 'dev_demo_mizu', 'sensor_demo_mizu', 'user_demo_mizu', 'みずセンサー', lower(hex(randomblob(32))), 'ACTIVE',
   'JP', 'JP-01', '014087', NULL, '余市町', 'USER_DECLARED', 'LOCALITY', 43.0, 140.8,
   1, 1, '2026-08-31T00:00:02.000Z', '2026-08-31T00:00:02.000Z'),
  ('device_demo_saku', 'dev_demo_saku', 'sensor_demo_saku', 'user_demo_saku', 'sakuセンサー', lower(hex(randomblob(32))), 'ACTIVE',
   'CN', 'CN-GD', NULL, NULL, '深セン', 'USER_DECLARED', 'LOCALITY', 22.5, 114.1,
   1, 1, '2026-08-31T00:00:03.000Z', '2026-08-31T00:00:03.000Z'),
  ('device_demo_ame', 'dev_demo_ame', 'sensor_demo_ame', 'user_demo_ame', 'あめセンサー', lower(hex(randomblob(32))), 'ACTIVE',
   'JP', 'JP-27', '273015', NULL, '島本町', 'USER_DECLARED', 'LOCALITY', 34.9, 135.7,
   1, 1, '2026-08-31T00:00:04.000Z', '2026-08-31T00:00:04.000Z');
