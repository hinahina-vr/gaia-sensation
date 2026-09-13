CREATE TABLE IF NOT EXISTS region_office_locations (
  region_key TEXT PRIMARY KEY,
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  subdivision_code TEXT NOT NULL,
  municipality_code TEXT,
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  precision TEXT NOT NULL CHECK (precision IN ('PREFECTURAL_GOVERNMENT_OFFICE', 'MUNICIPAL_MAIN_OFFICE')),
  source TEXT NOT NULL DEFAULT 'GSI_ADDRESS_SEARCH' CHECK (source = 'GSI_ADDRESS_SEARCH'),
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_region_office_municipality
  ON region_office_locations(municipality_code)
  WHERE municipality_code IS NOT NULL;
