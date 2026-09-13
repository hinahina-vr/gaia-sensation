PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (id, public_id, display_name, created_at, updated_at)
VALUES ('user_test_owner', 'usr_testowner', 'テスト参加者', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z');

INSERT OR IGNORE INTO users (id, public_id, display_name, created_at, updated_at)
VALUES ('user_test_other', 'usr_testother', '別の参加者', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z');

INSERT OR IGNORE INTO region_office_locations
  (region_key, country_code, subdivision_code, municipality_code, latitude, longitude, precision, source, updated_at)
VALUES
  ('JP:PREFECTURE:JP-47', 'JP', 'JP-47', NULL, 26.2124, 127.6809, 'PREFECTURAL_GOVERNMENT_OFFICE', 'GSI_ADDRESS_SEARCH', '2026-08-12T00:00:00.000Z'),
  ('JP:MUNICIPALITY:142085', 'JP', 'JP-14', '142085', 35.2956, 139.5803, 'MUNICIPAL_MAIN_OFFICE', 'GSI_ADDRESS_SEARCH', '2026-08-12T00:00:00.000Z');
