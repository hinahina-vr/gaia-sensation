PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'google'),
  provider_subject TEXT NOT NULL,
  email TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL CHECK (length(csrf_hash) = 64),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS oauth_flows (
  id TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE CHECK (length(state_hash) = 64),
  nonce_hash TEXT NOT NULL UNIQUE CHECK (length(nonce_hash) = 64),
  browser_binding_hash TEXT NOT NULL CHECK (length(browser_binding_hash) = 64),
  verifier_ciphertext TEXT NOT NULL,
  return_path TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY CHECK (length(code) = 2 AND code = upper(code)),
  name_en TEXT NOT NULL,
  name_local TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS device_pairing_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE CHECK (length(code_hash) = 64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL CHECK (length(device_name) BETWEEN 1 AND 80),
  country_code TEXT NOT NULL REFERENCES countries(code),
  admin1_code TEXT,
  locality_name TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  consumed_by_device_id TEXT UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pairing_user ON device_pairing_codes(user_id, expires_at);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  token_hash TEXT NOT NULL CHECK (length(token_hash) = 64),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  country_code TEXT NOT NULL REFERENCES countries(code),
  admin1_code TEXT,
  locality_name TEXT,
  location_source TEXT NOT NULL DEFAULT 'USER_DECLARED' CHECK (location_source = 'USER_DECLARED'),
  location_precision TEXT NOT NULL CHECK (location_precision IN ('COUNTRY', 'ADMIN1', 'LOCALITY')),
  last_seq INTEGER CHECK (last_seq IS NULL OR (last_seq >= 0 AND last_seq <= 9007199254740991)),
  last_payload_hash TEXT CHECK (last_payload_hash IS NULL OR length(last_payload_hash) = 64),
  last_seen_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_user_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_token_hash ON devices(token_hash);

CREATE TABLE IF NOT EXISTS telemetry (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq >= 0 AND seq <= 9007199254740991),
  observed_at TEXT,
  received_at TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  payload_json TEXT NOT NULL CHECK (length(payload_json) <= 8192),
  created_at TEXT NOT NULL,
  UNIQUE(device_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_received ON telemetry(device_id, received_at DESC);

INSERT OR IGNORE INTO countries (code, name_en, name_local) VALUES
  ('AU', 'Australia', 'オーストラリア'),
  ('BR', 'Brazil', 'ブラジル'),
  ('CA', 'Canada', 'カナダ'),
  ('CN', 'China', '中国'),
  ('DE', 'Germany', 'ドイツ'),
  ('FR', 'France', 'フランス'),
  ('GB', 'United Kingdom', 'イギリス'),
  ('ID', 'Indonesia', 'インドネシア'),
  ('IN', 'India', 'インド'),
  ('JP', 'Japan', '日本'),
  ('KR', 'South Korea', '韓国'),
  ('MX', 'Mexico', 'メキシコ'),
  ('NZ', 'New Zealand', 'ニュージーランド'),
  ('SG', 'Singapore', 'シンガポール'),
  ('TH', 'Thailand', 'タイ'),
  ('TW', 'Taiwan', '台湾'),
  ('US', 'United States', 'アメリカ合衆国'),
  ('VN', 'Vietnam', 'ベトナム'),
  ('ZA', 'South Africa', '南アフリカ');
