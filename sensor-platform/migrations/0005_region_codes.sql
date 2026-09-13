-- Add canonical region identifiers without removing the legacy location fields.
-- subdivision_code is a full ISO 3166-2 code. municipality_code is the
-- six-digit Japanese national local public body code (including check digit).
ALTER TABLE device_pairing_codes ADD COLUMN subdivision_code TEXT;
ALTER TABLE device_pairing_codes ADD COLUMN municipality_code TEXT;

ALTER TABLE devices ADD COLUMN subdivision_code TEXT;
ALTER TABLE devices ADD COLUMN municipality_code TEXT;

CREATE INDEX IF NOT EXISTS idx_devices_country_subdivision
  ON devices(country_code, subdivision_code);
