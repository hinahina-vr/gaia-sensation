"""Read-only source-to-display regression checks; does not rebuild the fixture."""
import csv
import importlib.util
import io
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
data = json.loads((root / "data/japan-marine-cod.json").read_text(encoding="utf-8"))
assert data["unit"] == "mg/L" and data["sourceCrs"] == "JGD2000 (EPSG:4612)"
expected = [(2020, 2033, 1, 7.5), (2021, 2061, 1, 7.1), (2022, 2009, 1, 8.3), (2023, 2041, 4, 7.9), (2024, 2042, 1, 7.8)]
assert [p["year"] for p in data["periods"]] == [x[0] for x in expected]
checked = 0
for period, (year, count, missing, maximum) in zip(data["periods"], expected):
    assert len(period["stations"]) == count
    assert period["counts"] == {"measured": count - missing, "missing": missing, "qualified": 0}
    assert max(p["cod"]["value"] or 0 for p in period["stations"]) == maximum
    with zipfile.ZipFile(root / f"data/sources/japan-marine-cod/{year}.zip") as z:
        raw = list(csv.DictReader(io.StringIO(z.read("output.csv").decode("cp932"), newline=None)))
    # Independent join uses the year-local source ID; catches wrong stable IDs,
    # coordinates, annual/COD75 swaps, omissions and accidental added points.
    source_by_id = {row["zettaicode"]: row for row in raw}
    assert len(source_by_id) == count
    for point in period["stations"]:
        row = source_by_id.pop(point["sourceId"])
        assert point["id"] == f'{int(row["prefcode"]):02d}{int(row["suiikicode"]):03d}{int(row["chitencode"]):02d}'
        assert (point["lon"], point["lat"]) == (float(row["X"]), float(row["Y"]))
        assert point["name"] == row["locationname"].strip() and point["water"] == row["water"].strip()
        for key in ["cod", "cod75"]:
            measurement = point[key]
            if row[key + "3"].strip().upper() == "ND" or any(sign in row[key + "3"] for sign in "<>"):
                assert measurement["value"] is None and measurement["quality"] == "qualified"
                assert measurement["text"] == row[key + "3"].strip()
            elif row[key] in ["", "99999"]:
                assert measurement == {"value": None, "text": "欠測", "quality": "missing"}
            else:
                assert measurement["value"] == float(row[key])
                assert measurement["text"] == row[key + "3"].strip()
        checked += 1
    assert not source_by_id

spec = importlib.util.spec_from_file_location("build_cod", root / "scripts/build-japan-marine-cod.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
for numeric, text, quality, value in [("0", "ND", "qualified", None), ("0.2", "<0.2", "qualified", None),
                                      ("9", ">9", "qualified", None), ("99999", "", "missing", None),
                                      ("", "", "missing", None), ("0", "0", "measured", 0)]:
    result = builder.measurement({"cod": numeric, "cod3": text}, "cod")
    assert result["quality"] == quality and result["value"] == value
print(f"PASS: {checked:,} original coastal records matched exactly; missing, ND, limits and real zero stay distinct")
