"""Build 21 pollution exhibits from retained official responses, entirely offline.

First run fetch-japan-pollution-sources.ps1. --check compares source-year records.
Missing/censored values remain null. Never fill station locations or yearly gaps.
"""
import argparse
import csv
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path
from annual_snapshot import publish_snapshot

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/sources/japan-pollution"
AIR_URL = "https://tenbou.nies.go.jp/download/"
WATER_URL = "https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp"
# TD specification table A: most means are column 22, HC/PM2.5 column 21 (1-based).
# Use exact original headers so a changed schema cannot silently shift the values.
AIR = [
    ("01", "so2", "年平均値(ppm)", "ppm"), ("02", "no", "年平均値(ppm)", "ppm"),
    ("03", "no2", "年平均値(ppm)", "ppm"), ("04", "nox", "年平均値(ppm)", "ppm"),
    ("05", "co", "年平均値(ppm)", "ppm"), ("06", "ox", "昼間の１時間値の年平均値(ppm)", "ppm"),
    ("07", "nmhc", "年平均値(ppmC)", "ppmC"), ("08", "ch4", "年平均値(ppmC)", "ppmC"),
    ("09", "thc", "年平均値(ppmC)", "ppmC"), ("10", "spm", "年平均値(mg/m3)", "mg/m³"),
    ("12", "pm25", "年平均値(μg/m3)", "μg/m³"),
]
WATER = [("river-bod", "bod", "1"), ("river-cod", "cod", "1"), ("lake-cod", "cod", "2"),
    ("ss", "ss", None), ("tn", "tn", None), ("tp", "tp", None), ("hex", "hex", None),
    ("zinc", "allzn", None), ("las", "las", None), ("nonylphenol", "nonylphenol", None)]


def read_zip(path):
    with zipfile.ZipFile(path) as archive:
        names = [n for n in archive.namelist() if n.endswith((".csv", ".txt"))]
        assert len(names) == 1, path
        reader = csv.DictReader(io.StringIO(archive.read(names[0]).decode("cp932")))
        assert len(reader.fieldnames) == len(set(reader.fieldnames)), path
        return list(reader)


def measure(raw, numeric=None):
    text = raw.strip()
    number = (numeric if numeric is not None else text).strip()
    if text.upper() == "ND" or any(symbol in text for symbol in "<>"):
        return {"value": None, "text": text, "quality": "qualified"}
    if number in ("", "99999", "-9999", "-999", "***", "---"):
        return {"value": None, "text": "欠測", "quality": "missing"}
    if not re.fullmatch(r"\d+(\.\d+)?", text):
        return {"value": None, "text": text or "欠測", "quality": "qualified"}
    assert float(text) == float(number), (text, number)
    return {"value": float(number), "text": text, "quality": "measured"}


def period(year, points, excluded=None):
    points.sort(key=lambda r: r["id"])
    assert len(points) == len({p["id"] for p in points}), (year, "duplicate IDs")
    for p in points:
        assert 122 <= p["lon"] <= 154 and 20 <= p["lat"] <= 46, p
    counts = {q: sum(p["measurement"]["quality"] == q for p in points) for q in ("measured", "qualified", "missing")}
    assert counts["measured"] > 0, (year, counts)
    return {"year": year, "stations": points, "counts": counts, "coordinateExcluded": excluded or []}


def main(check=False):
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest["sources"]:
        assert hashlib.sha256((SOURCE / item["file"]).read_bytes()).hexdigest() == item["sha256"], item["file"]
    # Existing source archives are shared, not refetched or changed.
    old = ROOT / "data/sources/japan-sensor-open"
    old_manifest = json.loads((old / "manifest.json").read_text(encoding="utf-8"))
    sea = ROOT / "data/sources/japan-marine-cod"
    sea_manifest = json.loads((sea / "manifest.json").read_text(encoding="utf-8"))
    for year in range(2020, 2025):
        assert hashlib.sha256((old / f"freshwater-{year}.zip").read_bytes()).hexdigest() == old_manifest["files"][f"freshwater-{year}.zip"]
    for item in sea_manifest["sources"]:
        assert hashlib.sha256((sea / item["file"]).read_bytes()).hexdigest() == item["sha256"]
    series = {}
    for year in range(2019, 2024):
        stations = {r["国環研局番"]: r for r in read_zip(SOURCE / f"TM{year}0000.zip")}
        for code, key, column, unit in AIR:
            points, excluded = [], []
            for row in read_zip(SOURCE / f"TD{year}{code}00.zip"):
                assert int(row["測定年度"]) == year and row["項目コード_数字"] == code
                ident = row["測定局コード"]
                station = stations.get(ident)
                if not station or any(not re.fullmatch(r"\d+(\.\d+)?", station[k]) for k in ("緯度_度", "緯度_分", "緯度_秒", "経度_度", "経度_分", "経度_秒")):
                    excluded.append(ident)
                    continue
                assert int(station["年度"]) == year and station["都道府県コード"] == row["都道府県コード"]
                lat = sum(float(station[k]) / divisor for k, divisor in [("緯度_度", 1), ("緯度_分", 60), ("緯度_秒", 3600)])
                lon = sum(float(station[k]) / divisor for k, divisor in [("経度_度", 1), ("経度_分", 60), ("経度_秒", 3600)])
                if not (122 <= lon <= 154 and 20 <= lat <= 46):
                    excluded.append(ident)
                    continue
                value = measure(row[column])
                coverage = "有効測定日数(日)" if key == "pm25" else "昼間測定時間(時間)" if key == "ox" else "測定時間(時間)"
                assert coverage in row, (year, key, row.keys())
                value["coverageText"] = f"原資料の{coverage}: {row[coverage] or '記録なし'}"
                points.append({"id": ident, "sourceId": ident, "prefCode": row["都道府県コード"],
                    "name": station["測定局名"].strip() or row["測定局名"],
                    "water": {"1": "一般環境大気測定局", "2": "自動車排出ガス測定局"}.get(row["測定局区分コード"], "測定局区分" + row["測定局区分コード"]),
                    "stationType": row["測定局区分コード"], "lon": round(lon, 8), "lat": round(lat, 8), "measurement": value, "secondary": None})
            series.setdefault("air-" + key, []).append(period(year, points, excluded))
    for year in range(2020, 2025):
        water = read_zip(old / f"freshwater-{year}.zip") + read_zip(sea / f"{year}.zip")
        nutrients = read_zip(SOURCE / f"nutrients-{year}.zip")
        for key, column, kind in WATER:
            points = []
            for row in nutrients if key in ("tn", "tp") else water:
                assert int(row["nendo"]) == year
                if kind and row["rlscode"] != kind:
                    continue
                points.append({"id": row["prefcode"].zfill(2) + row["suiikicode"].zfill(3) + row["chitencode"].zfill(2),
                    "sourceId": row["zettaicode"], "name": row["locationname"].strip(),
                    "water": {"1": "河川", "2": "湖沼", "3": "海域"}[row["rlscode"]] + " · " + row["water"].strip(),
                    "waterKind": row["rlscode"], "prefCode": row["prefcode"].zfill(2), "lon": float(row["X"]), "lat": float(row["Y"]),
                    "measurement": measure(row[column + "3"], row[column]), "secondary": None})
            series.setdefault("water-" + key, []).append(period(year, points))
    for key, periods in series.items():
        air = key.startswith("air-")
        source_fields = [next(item[2] for item in AIR if key == "air-" + item[1])] if air else [next(item[1] for item in WATER if key == "water-" + item[0]) + "3"]
        unit = next(item[3] for item in AIR if key == "air-" + item[1]) if air else "mg/L"
        attribution = ("国立環境研究所 環境展望台 大気汚染常時監視データファイル（" + AIR_URL + "、参照日 " + manifest["retrievedOn"] + "）" if air else "環境省 公共用水域水質測定データ") + "をGAIA SENSEWAREが抽出・加工"
        result = {"schemaVersion": 1, "id": "japan-" + key, "periods": periods, "retrievedOn": manifest["retrievedOn"],
            "measurementKey": key.replace("-", "_"), "unit": unit, "periodUnit": "年度", "realtime": False,
            "statistic": "昼間の1時間値の年度平均" if key == "air-ox" else "日平均値の年度平均" if key == "air-pm25" else "年度平均値",
            "sourceFields": source_fields, "sourceUrl": AIR_URL if air else WATER_URL, "attribution": attribution,
            "coordinateNote": "各年度の公開測定局情報の世界測地系座標。座標不明局は除外し件数を記録。位置の補間なし。" if air else "各年度の公開JGD2000座標。位置の補間なし。",
            "sourceRetrievalDates": [manifest["retrievedOn"]] if air or key in ("water-tn", "water-tp") else sorted({old_manifest["retrievedOn"], sea_manifest["retrievedOn"]})}
        publish_snapshot(f"japan-{key}.json", result, check)
        print(key, [p["counts"] for p in periods], "coordinateExcluded", [len(p["coordinateExcluded"]) for p in periods], flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    main(parser.parse_args().check)
