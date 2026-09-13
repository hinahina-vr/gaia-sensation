ALTER TABLE device_pairing_codes ADD COLUMN measurement_keys_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(measurement_keys_json) AND json_type(measurement_keys_json) = 'array');

ALTER TABLE devices ADD COLUMN measurement_keys_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(measurement_keys_json) AND json_type(measurement_keys_json) = 'array');
