"""Independent ordinal-column audit against retained official CSVs (no builder imports)."""
import csv
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/sources/japan-pollution"


def records(file):
    with zipfile.ZipFile(file) as archive:
        name, = [n for n in archive.namelist() if n.endswith((".txt", ".csv"))]
        return list(csv.reader(io.StringIO(archive.read(name).decode("cp932"))))


def compare(display, original, numeric=None):
    # Classify source notation directly and independently of the builder.
    if original == "ND" or "<" in original or ">" in original:
        assert display == {"quality": "qualified", "text": original, "value": None}
    elif (original in ("", "99999") or numeric == "99999"):
        assert display["quality"] == "missing" and display["value"] is None
    else:
        assert re.fullmatch(r"\d+(\.\d+)?", original), original
        assert display["quality"] == "measured" and display["value"] == float(original)
        assert display["text"] == original


checks = []
manifest = json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))
for source in manifest["sources"]:
    assert hashlib.sha256((RAW / source["file"]).read_bytes()).hexdigest() == source["sha256"]
for key, code in [("so2", "01"), ("no", "02"), ("no2", "03"), ("nox", "04"), ("co", "05"), ("ox", "06"),
                  ("nmhc", "07"), ("ch4", "08"), ("thc", "09"), ("spm", "10"), ("pm25", "12")]:
    data = json.loads((ROOT / f"data/japan-air-{key}.json").read_text(encoding="utf-8"))
    total = 0
    for period in data["periods"]:
        year = period["year"]
        rows = records(RAW / f"TD{year}{code}00.zip")
        # TD manual table A, one-based 21 for hydrocarbons/PM2.5, otherwise 22.
        column = 20 if code in ("07", "08", "09", "12") else 21
        assert "年平均値" in rows[0][column] and "月" not in rows[0][column]
        source = {r[11]: r for r in rows[1:]}
        tm = {r[1]: r for r in records(RAW / f"TM{year}0000.zip")[1:]}
        assert len(period["stations"]) + len(period["coordinateExcluded"]) == len(source)
        for point in period["stations"]:
            row = source[point["id"]]
            assert int(row[0]) == year and row[2] == code
            compare({k: v for k, v in point["measurement"].items() if k != "coverageText"}, row[column])
            station = tm[point["id"]]
            assert point["prefCode"] == row[5] == station[16]
            assert point["stationType"] == row[14]
            assert point["name"] == (station[5].strip() or row[12])
            assert abs(point["lat"] - (float(station[9]) + float(station[10]) / 60 + float(station[11]) / 3600)) < 6e-9
            assert abs(point["lon"] - (float(station[12]) + float(station[13]) / 60 + float(station[14]) / 3600)) < 6e-9
            total += 1
    checks.append({"dataset": data["id"], "records": total, "result": "passed"})
for key, field, kind in [("river-bod", "bod", "1"), ("river-cod", "cod", "1"), ("lake-cod", "cod", "2"), ("ss", "ss", None),
                         ("tn", "tn", None), ("tp", "tp", None), ("hex", "hex", None), ("zinc", "allzn", None), ("las", "las", None), ("nonylphenol", "nonylphenol", None)]:
    data = json.loads((ROOT / f"data/japan-water-{key}.json").read_text(encoding="utf-8"))
    total = 0
    for period in data["periods"]:
        year = period["year"]
        paths = [RAW / f"nutrients-{year}.zip"] if field in ("tn", "tp") else [ROOT / f"data/sources/japan-sensor-open/freshwater-{year}.zip", ROOT / f"data/sources/japan-marine-cod/{year}.zip"]
        source = {}
        for file in paths:
            rows = records(file)
            header = rows[0]
            value_column, display_column = header.index(field), header.index(field + "3")
            assert display_column == value_column + 2, "Do not use the environmental-standard comparison flag"
            for row in rows[1:]:
                if kind and row[10] != kind:
                    continue
                ident = row[4].zfill(2) + row[5].zfill(3) + row[6].zfill(2)
                assert ident not in source
                source[ident] = row, value_column, display_column
        assert len(source) == len(period["stations"])
        for point in period["stations"]:
            row, numeric, display = source[point["id"]]
            assert int(row[8]) == year and point["sourceId"] == row[2]
            compare(point["measurement"], row[display], row[numeric])
            assert point["waterKind"] == row[10]
            assert point["name"] == row[9].strip()
            assert point["lon"] == float(row[0]) and point["lat"] == float(row[1])
            total += 1
    checks.append({"dataset": data["id"], "records": total, "result": "passed"})
report = {"status": "passed", "checks": checks, "sourceFilesSha256Verified": len(manifest["sources"]), "records": sum(c["records"] for c in checks)}
target = ROOT / "artifacts/japan-pollution-2026-09-09/source-audit.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
