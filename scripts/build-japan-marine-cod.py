"""Build the coastal COD exhibit from unchanged MOE annual marine CSV ZIPs.

Coordinates remain JGD2000; no interpolation, imputation or compliance scoring.
The annual system ID is NOT a stable station ID: use pref/suiiki/chiten codes.
"""
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile
from annual_snapshot import publish_snapshot

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/sources/japan-marine-cod"
TARGET = ROOT / "data/japan-marine-cod.json"


def measurement(row, key):
    raw = row[key + "3"].strip()
    numeric = row[key].strip()
    # Qualifiers belong to the measurement. Never display their numeric helper
    # column as an exact observation (particularly the value 0 used for ND).
    if raw.upper() == "ND" or any(sign in raw for sign in "<>"):
        return {"value": None, "text": raw, "quality": "qualified"}
    if numeric in ("", "99999"):
        return {"value": None, "text": "欠測", "quality": "missing"}
    value = float(numeric)
    if not 0 <= value < 1000:
        raise ValueError(f"Unexpected {key}: {numeric}")
    return {"value": value, "text": raw or numeric, "quality": "measured"}


def build():
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    periods = []
    for source in manifest["sources"]:
        archive = SOURCE / source["file"]
        assert hashlib.sha256(archive.read_bytes()).hexdigest() == source["sha256"]
        with zipfile.ZipFile(archive) as z:
            text = z.read("output.csv").decode("cp932")
        stations, ids = [], set()
        for row in csv.DictReader(io.StringIO(text, newline=None)):
            assert row["rlscode"] == "3" and int(row["nendo"]) == source["year"]
            station_id = row["prefcode"].zfill(2) + row["suiikicode"].zfill(3) + row["chitencode"].zfill(2)
            assert station_id not in ids, (source["year"], station_id)
            ids.add(station_id)
            lon, lat = float(row["X"]), float(row["Y"])
            assert 122 <= lon <= 154 and 20 <= lat <= 46, (station_id, lon, lat)
            assert abs(lon - float(row["longitude"])) < 1e-6
            assert abs(lat - float(row["latitude"])) < 1e-6
            stations.append({"id": station_id, "sourceId": row["zettaicode"],
                             "name": row["locationname"].strip(), "water": row["water"].strip(),
                             "prefCode": row["prefcode"].zfill(2), "lon": lon, "lat": lat,
                             "cod": measurement(row, "cod"), "cod75": measurement(row, "cod75")})
        stations.sort(key=lambda item: item["id"])
        counts = {quality: sum(s["cod"]["quality"] == quality for s in stations)
                  for quality in ("measured", "missing", "qualified")}
        values = [s["cod"]["value"] for s in stations if s["cod"]["value"] is not None]
        periods.append({"year": source["year"], "counts": counts, "stations": stations})
        print(source["year"], len(stations), counts, "range", min(values), max(values))
    return {"schemaVersion": 1, "title": "日本沿岸のCOD（年度平均値）", "unit": "mg/L",
            "source": manifest["source"], "sourceUrl": manifest["sourceUrl"],
            "manualUrl": manifest["manualUrl"], "licenseUrl": manifest["licenseUrl"],
            "sourceCrs": manifest["sourceCrs"], "retrievedOn": manifest["retrievedOn"],
            "attribution": "環境省 公共用水域水質測定データをGAIA SENSEWAREが抽出・加工",
            "note": "年度平均値。COD75は別指標。CODは化学的酸素要求量で、DO（溶存酸素量）ではありません。未測定海域の値を推定せず、欠測・定量限界の注記を保持しています。",
            "periods": periods}


if __name__ == "__main__":
    publish_snapshot(TARGET.name, build(), "--check" in sys.argv)
