"""Read-only independent source join, plus parsing boundary regressions."""
import csv
import importlib.util
import io
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checked = 0
for year in range(2020, 2025):
    raw = []
    for filename in (f"data/sources/japan-marine-cod/{year}.zip", f"data/sources/japan-sensor-open/freshwater-{year}.zip"):
        with zipfile.ZipFile(ROOT / filename) as archive:
            raw.extend(csv.DictReader(io.StringIO(archive.read("output.csv").decode("cp932"))))
    for kind, area in (("1", "river"), ("2", "lake"), ("3", "marine")):
        for metric, fields in (("ph", [("measurement", "ph_min"), ("secondary", "ph_max")]), ("do", [("measurement", "do_")])):
            data = json.loads((ROOT / f"data/japan-{area}-{metric}.json").read_text(encoding="utf-8"))
            points = next(period["stations"] for period in data["periods"] if period["year"] == year)
            # Join using the independent, year-local source ID, not the builder's stable-key lookup.
            original = {r["zettaicode"]: r for r in raw if r["rlscode"] == kind}
            assert len(points) == len(original)
            for point in points:
                row = original.pop(point["sourceId"])
                assert point["id"] == f'{int(row["prefcode"]):02d}{int(row["suiikicode"]):03d}{int(row["chitencode"]):02d}'
                assert point["name"] == row["locationname"].strip() and point["water"] == row["water"].strip()
                assert (point["lon"], point["lat"]) == (float(row["longitude"]), float(row["latitude"]))
                for field, column in fields:
                    value, text, numeric = point[field], row[column + "3"].strip(), row[column].strip()
                    if text.upper() == "ND" or "<" in text or ">" in text: assert value["quality"] == "qualified"
                    if value["quality"] == "measured":
                        assert re.fullmatch(r"-?\d+(\.\d+)?", text or numeric)
                        assert value["value"] == float(numeric) and value["text"] == (text or numeric)
                    else:
                        assert value["value"] is None and value["text"] == (text or "欠測")
                        if value["quality"] == "missing": assert numeric in ("", "99999")
                        else: assert not re.fullmatch(r"-?\d+(\.\d+)?", text)
                checked += 1
            assert not original

# JMA source HTML: a different extraction path from the builder's HTMLParser.
source = ROOT / "data/sources/japan-sensor-open"
manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
weather_count = 0
for record in manifest["jmaStations"]:
    source_html = (source / record["file"]).read_text(encoding="utf-8")
    for raw_row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", source_html, re.S):
        cells = [re.sub(r"<[^>]+>", "", cell).replace("&nbsp;", " ").strip()
            for cell in re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", raw_row, re.S)]
        if not cells or cells[0] not in {str(year) for year in range(2020, 2025)}: continue
        for metric, column, multiplier in [("temperature", 7, 1), ("humidity", 12, 1), ("pressure", 1, 1),
                ("rainfall", 3, 1), ("wind-speed", 14, 1), ("solar-irradiance", 20, 1_000_000 / 86400)]:
            data = json.loads((ROOT / f"data/japan-weather-{metric}.json").read_text(encoding="utf-8"))
            period = next(p for p in data["periods"] if p["year"] == int(cells[0]))
            row = next(p for p in period["stations"] if p["id"] == record["block"])
            assert row["name"] == record["name"] and row["sourceUrl"] == record["url"]
            station_table = json.loads((source / "amedastable.json").read_text(encoding="utf-8"))[record["amedasId"]]
            assert row["lon"] == station_table["lon"][0] + station_table["lon"][1] / 60
            assert row["lat"] == station_table["lat"][0] + station_table["lat"][1] / 60
            value = row["measurement"]
            if value["quality"] == "measured": assert abs(value["value"] - float(cells[column]) * multiplier) < 1e-9
            else: assert value["value"] is None and value["text"] == (cells[column] or "欠測")
            weather_count += 1
assert checked == 83044 and weather_count == 1140

spec = importlib.util.spec_from_file_location("builder", ROOT / "scripts/build-japan-sensor-open-data.py")
builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
for raw, numeric, quality, expected in [("0", "0", "measured", 0), ("", "", "missing", None), ("", "99999", "missing", None),
        ("ND", "0", "qualified", None), ("ND", "99999", "qualified", None), ("<0.2", "0.2", "qualified", None),
        (">9", "9", "qualified", None), ("68 )", None, "qualified", None), ("20.1 ]", None, "qualified", None),
        ("-1.5", None, "measured", -1.5)]:
    actual = builder.measure(raw, numeric)
    assert actual["quality"] == quality and actual["value"] == expected, (raw, actual)
print(f"PASS independent sources: {checked:,} MOE records + {weather_count:,} JMA station-year-metrics; names, IDs, source coordinates, units, values and quality boundaries")
