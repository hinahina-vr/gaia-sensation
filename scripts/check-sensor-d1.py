import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = sorted((ROOT / "sensor-platform" / "migrations").glob("*.sql"))

database = sqlite3.connect(":memory:")
database.execute("PRAGMA foreign_keys = ON")
for migration in MIGRATIONS:
    database.executescript(migration.read_text(encoding="utf-8"))
codes = [row[0] for row in database.execute("SELECT code FROM countries ORDER BY code")]
foreign_keys = database.execute("PRAGMA foreign_key_list(devices)").fetchall()
device_columns = {row[1] for row in database.execute("PRAGMA table_info(devices)")}
pairing_columns = {row[1] for row in database.execute("PRAGMA table_info(device_pairing_codes)")}
assert len(MIGRATIONS) == 11
assert len(codes) == 249 and len(set(codes)) == 249
assert all(len(code) == 2 and code.isascii() and code.isupper() for code in codes)
assert {"JP", "US", "DE", "BR", "AQ"}.issubset(codes)
assert any(row[2] == "countries" and row[3] == "country_code" and row[4] == "code" for row in foreign_keys)
assert {"subdivision_code", "municipality_code", "admin1_code", "locality_name", "location_precision"}.issubset(device_columns)
assert {"subdivision_code", "municipality_code", "admin1_code", "locality_name"}.issubset(pairing_columns)
assert database.execute("SELECT COUNT(*) FROM pragma_table_info('device_telemetry_rollups')").fetchone()[0] == 7
assert database.execute("SELECT COUNT(*) FROM pragma_table_info('device_social_rollups')").fetchone()[0] == 3
assert database.execute(
    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name IN "
    "('telemetry_rollup_after_insert','social_rollup_after_like_insert','social_rollup_after_like_delete')"
).fetchone()[0] == 3

database.execute(
    "INSERT INTO telemetry "
    "(id, device_id, seq, observed_at, received_at, payload_hash, payload_json, created_at) "
    "VALUES ('telemetry_audit', 'dev_demo_bluecat', 1, NULL, "
    "'2026-09-02T00:00:00.000Z', printf('%064x', 1), '{\"temperature\":21}', "
    "'2026-09-02T00:00:00.000Z')"
)
assert database.execute(
    "SELECT observation_count FROM device_telemetry_rollups WHERE device_id = 'dev_demo_bluecat'"
).fetchone()[0] == 1
assert database.execute(
    "SELECT json_array_length(recent_payloads_json) FROM device_telemetry_rollups "
    "WHERE device_id = 'dev_demo_bluecat'"
).fetchone()[0] == 1
database.executemany(
    "INSERT INTO telemetry "
    "(id, device_id, seq, observed_at, received_at, payload_hash, payload_json, created_at) "
    "VALUES (?, 'dev_demo_bluecat', ?, NULL, ?, ?, ?, ?)",
    [
        (
            f"telemetry_audit_{seq}",
            seq,
            f"2026-09-02T00:00:{seq:02d}.000Z",
            f"{seq:064x}",
            json.dumps({"temperature": seq}, separators=(",", ":")),
            f"2026-09-02T00:00:{seq:02d}.000Z",
        )
        for seq in range(2, 21)
    ],
)
telemetry_rollup = database.execute(
    "SELECT observation_count, json_array_length(recent_payloads_json), "
    "json_extract(recent_payloads_json, '$[0].temperature') "
    "FROM device_telemetry_rollups WHERE device_id = 'dev_demo_bluecat'"
).fetchone()
assert telemetry_rollup == (20, 12, 20)
database.execute(
    "INSERT INTO sensor_relationships (user_id, device_id, kind, created_at) "
    "VALUES ('user_demo_mizu', 'device_demo_bluecat', 'LIKE', '2026-09-02T00:00:00.000Z')"
)
assert database.execute(
    "SELECT like_count FROM device_social_rollups WHERE device_id = 'device_demo_bluecat'"
).fetchone()[0] == 1
database.execute(
    "DELETE FROM sensor_relationships "
    "WHERE user_id = 'user_demo_mizu' AND device_id = 'device_demo_bluecat' AND kind = 'LIKE'"
)
assert database.execute(
    "SELECT like_count FROM device_social_rollups WHERE device_id = 'device_demo_bluecat'"
).fetchone()[0] == 0

latest_plan = "\n".join(row[3] for row in database.execute(
    "EXPLAIN QUERY PLAN SELECT payload_json FROM telemetry "
    "WHERE device_id = 'dev_demo_bluecat' ORDER BY received_at DESC, seq DESC LIMIT 12"
))
public_plan = "\n".join(row[3] for row in database.execute(
    "EXPLAIN QUERY PLAN SELECT public_id FROM devices "
    "WHERE is_public = 1 AND status = 'ACTIVE' AND deleted_at IS NULL "
    "AND public_latitude IS NOT NULL AND public_longitude IS NOT NULL "
    "ORDER BY created_at DESC LIMIT 500"
))
assert "idx_telemetry_device_received_seq" in latest_plan
assert "idx_devices_public_created" in public_plan

print(json.dumps({
    "status": "passed",
    "migrations": [migration.name for migration in MIGRATIONS],
    "application": "passed",
    "countryCount": len(codes),
    "countryFormatErrors": 0,
    "foreignKey": "devices.country_code -> countries.code",
    "latestPlan": latest_plan,
    "publicPlan": public_plan,
}, ensure_ascii=False, indent=2))
