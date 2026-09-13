"""Reproducible MOE/JMA annual observation snapshots, never synthetic feeds.

Run --fetch once to retain public source responses, then run offline to build.
Raw responses are immutable. Qualified/missing values are never coerced to zero.
"""
import argparse
import csv
import hashlib
import io
import json
import re
import time
import urllib.request
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from annual_snapshot import publish_snapshot

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/sources/japan-sensor-open"
YEARS = list(range(2020, 2025))
WEATHER_YEARS = list(range(1955, 2025))
MOE = "https://water-pub.env.go.jp/water-pub/mizu-site/zip_create/"
MOE_URL = "https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp"
JMA_URL = "https://www.data.jma.go.jp/stats/etrn/"
STATIONS = [("札幌", "47412", "01"), ("旭川", "47407", "01"), ("青森", "47575", "02"),
    ("盛岡", "47584", "03"), ("仙台", "47590", "04"), ("秋田", "47582", "05"),
    ("福島", "47595", "07"), ("前橋", "47624", "10"), ("東京", "47662", "13"),
    ("新潟", "47604", "15"), ("金沢", "47605", "17"), ("福井", "47616", "18"),
    ("甲府", "47638", "19"), ("長野", "47610", "20"), ("岐阜", "47632", "21"),
    ("静岡", "47656", "22"), ("名古屋", "47636", "23"), ("京都", "47759", "26"),
    ("大阪", "47772", "27"), ("神戸", "47770", "28"), ("和歌山", "47777", "30"),
    ("鳥取", "47746", "31"), ("松江", "47741", "32"), ("岡山", "47768", "33"),
    ("広島", "47765", "34"), ("下関", "47762", "35"), ("高松", "47891", "37"),
    ("松山", "47887", "38"), ("高知", "47893", "39"), ("福岡", "47807", "40"),
    ("佐賀", "47813", "41"), ("長崎", "47817", "42"), ("熊本", "47819", "43"),
    ("大分", "47815", "44"), ("宮崎", "47830", "45"), ("鹿児島", "47827", "46"),
    ("那覇", "47936", "47"), ("石垣島", "47918", "47")]


def get(url, payload=None):
    request = urllib.request.Request(url, data=json.dumps(payload).encode() if payload else None,
        headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "GAIA-SENSEWARE-open-data-builder/1.0"})
    with urllib.request.urlopen(request, timeout=40) as response:
        return response.read()


def retain(name, url, payload=None):
    target = SOURCE / name
    if not target.exists():
        target.write_bytes(get(url, payload))
        time.sleep(.4)
    return target.read_bytes()


def fetch_sources():
    SOURCE.mkdir(parents=True, exist_ok=True)
    for year in YEARS:
        target = SOURCE / f"freshwater-{year}.zip"
        if not target.exists():
            query = {"featureClassName": "p_kosui_y02", "whereClause": f"nendo={year} and suiikicode < '600'", "extension": "csv"}
            token = json.loads(get(MOE + "WebService.asmx/StartCreation", query))["d"]
            assert token and token not in ("RecordNotFound", "BadRequest"), token
            for attempt in range(60):
                time.sleep(1.5)
                status = json.loads(get(MOE + "WebService.asmx/GetThreadStatus", {"resultFileName": token}))["d"]
                if status != "Running":
                    break
            assert status == "Stopped", status
            raw = get(MOE + "download.aspx?id=" + token)
            assert raw.startswith(b"PK\x03\x04") and len(raw) < 10_000_000
            target.write_bytes(raw)
        print(target.name, target.stat().st_size, flush=True)
    table = json.loads(retain("amedastable.json", "https://www.jma.go.jp/bosai/amedas/const/amedastable.json"))
    sources = []
    for name, block, pref in STATIONS:
        matches = [(key, row) for key, row in table.items() if row["kjName"] == name and row["type"] == "A"]
        assert len(matches) == 1, (name, matches)
        amedas, station = matches[0]
        # ETRN groups all Okinawa islands under 91, unlike AMeDAS prefixes.
        prec = "91" if pref == "47" else amedas[:2]
        filename = f"jma-{block}{'-91' if prec != amedas[:2] else ''}.html"
        url = JMA_URL + f"view/annually_s.php?prec_no={prec}&block_no={block}&year=&month=&day=&view="
        raw = retain(filename, url)
        assert f"{name}（" in raw.decode("utf-8"), (name, block)
        sources.append({"name": name, "block": block, "prefCode": pref, "amedasId": amedas, "url": url, "file": filename,
            "lat": station["lat"][0] + station["lat"][1] / 60, "lon": station["lon"][0] + station["lon"][1] / 60})
        print(name, block, len(raw), flush=True)
    manifest = {"retrievedOn": time.strftime("%Y-%m-%d"), "years": YEARS, "jmaStations": sources,
        "freshwaterQuery": "p_kosui_y02 / nendo=YEAR and suiikicode < '600' / csv",
        "files": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(SOURCE.iterdir()) if p.suffix in (".zip", ".html") or p.name == "amedastable.json"}}
    (SOURCE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def measure(raw, numeric=None, factor=1):
    raw = raw.strip()
    numeric = raw if numeric is None else numeric.strip()
    if raw.upper() == "ND" or "<" in raw or ">" in raw:
        return {"value": None, "text": raw, "quality": "qualified"}
    if numeric in ("", "99999", "×", "///", "--"):
        return {"value": None, "text": raw or "欠測", "quality": "missing"}
    if not re.fullmatch(r"-?\d+(\.\d+)?", raw or numeric):
        return {"value": None, "text": raw, "quality": "qualified"}
    value = float(numeric) * factor
    return {"value": value, "text": f"{value:.1f}" if factor != 1 else raw or numeric, "quality": "measured"}


class AnnualTable(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows = []; self.row = None; self.cell = None; self.inside = False
    def handle_starttag(self, tag, attrs):
        if tag == "table" and dict(attrs).get("id") == "tablefix1": self.inside = True
        if self.inside and tag == "tr": self.row = []
        if self.inside and tag in ("th", "td"): self.cell = ""
    def handle_data(self, value):
        if self.cell is not None: self.cell += value
    def handle_endtag(self, tag):
        if tag in ("th", "td") and self.cell is not None:
            if self.row is not None: self.row.append(self.cell.strip())
            self.cell = None
        if tag == "tr" and self.row is not None: self.rows.append(self.row); self.row = None
        if tag == "table": self.inside = False


def build():
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    marine_manifest = json.loads((ROOT / "data/sources/japan-marine-cod/manifest.json").read_text(encoding="utf-8"))
    for record in marine_manifest["sources"]:
        assert hashlib.sha256((ROOT / "data/sources/japan-marine-cod" / record["file"]).read_bytes()).hexdigest() == record["sha256"]
    for name, checksum in manifest["files"].items():
        assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == checksum, name
    series = {f"{water}-{metric}": [] for water in ("marine", "river", "lake") for metric in ("ph", "do")}
    for year in ([] if ARGS.weather_only else YEARS):
        groups = {"1": [], "2": [], "3": []}
        for file in (SOURCE / f"freshwater-{year}.zip", ROOT / f"data/sources/japan-marine-cod/{year}.zip"):
            with zipfile.ZipFile(file) as z:
                for row in csv.DictReader(io.StringIO(z.read("output.csv").decode("cp932"))):
                    assert int(row["nendo"]) == year and row["rlscode"] in groups
                    groups[row["rlscode"]].append(row)
        for kind, water in (("1", "river"), ("2", "lake"), ("3", "marine")):
            for metric in ("ph", "do"):
                points = []
                for row in groups[kind]:
                    lon, lat = float(row["X"]), float(row["Y"])
                    assert 122 <= lon <= 154 and 20 <= lat <= 46
                    key = "ph_min" if metric == "ph" else "do_"
                    value = measure(row[key + "3"], row[key])
                    assert value["value"] is None or 0 <= value["value"] <= (14 if metric == "ph" else 50)
                    points.append({"id": row["prefcode"].zfill(2) + row["suiikicode"].zfill(3) + row["chitencode"].zfill(2),
                        "sourceId": row["zettaicode"], "name": row["locationname"].strip(), "water": row["water"].strip(),
                        "prefCode": row["prefcode"].zfill(2), "lon": lon, "lat": lat, "measurement": value,
                        "secondary": measure(row["ph_max3"], row["ph_max"]) if metric == "ph" else None})
                append_period(series[f"{water}-{metric}"], year, points)
    # Zero-based source columns, including the year column. Source header is checked.
    metrics = {"temperature": (7, 1), "humidity": (12, 1), "pressure": (1, 1), "rainfall": (3, 1), "wind-speed": (14, 1), "solar-irradiance": (20, 1_000_000 / 86400)}
    for metric in metrics: series[f"weather-{metric}"] = [{"year": y, "stations": []} for y in WEATHER_YEARS]
    for station in manifest["jmaStations"]:
        html = (SOURCE / station["file"]).read_text(encoding="utf-8")
        assert "現地" in html and "全天日射量" in html and "日平均" in html
        table = AnnualTable(); table.feed(html)
        rows = {int(r[0]): r for r in table.rows if r and r[0].isdigit() and int(r[0]) in WEATHER_YEARS}
        assert set(YEARS).issubset(rows), station["name"]
        for year, row in rows.items():
            assert len(row) == 28, (station["name"], year, len(row))
            for metric, (column, factor) in metrics.items():
                value = measure(row[column], factor=factor)
                if factor != 1: value["sourceText"] = row[column]; value["sourceUnit"] = "MJ/m²/day"
                series[f"weather-{metric}"][year - WEATHER_YEARS[0]]["stations"].append({
                    "id": station["block"], "name": station["name"], "water": "気象官署", "prefCode": station["prefCode"],
                    "lon": station["lon"], "lat": station["lat"], "sourceUrl": station["url"], "measurement": value, "secondary": None})
    for key, periods in series.items():
        if not periods: continue
        for p in periods:
            p["stations"].sort(key=lambda r: r["id"])
            p["counts"] = {q: sum(r["measurement"]["quality"] == q for r in p["stations"]) for q in ("measured", "qualified", "missing")}
        # An instrument introduced later must not manufacture an empty early history.
        # Missing observations inside the available range remain explicit nulls.
        available = [i for i, p in enumerate(periods) if p["counts"]["measured"] + p["counts"]["qualified"] > 0]
        assert available, key
        periods = periods[available[0]:available[-1] + 1]
        weather_metric = key.removeprefix("weather-")
        metric = {"ph": ("ph", "pH", "年度最小値（secondaryは年度最大値）", ["ph_min3", "ph_max3"]),
            "do": ("dissolved_oxygen", "mg/L", "年度平均値", ["do_3"]),
            "temperature": ("temperature", "°C", "日平均気温の年平均", ["日平均気温・平均"]),
            "humidity": ("humidity", "%RH", "相対湿度の年平均", ["平均湿度"]),
            "pressure": ("pressure", "hPa", "現地気圧の年平均（海面更正なし）", ["現地気圧・平均"]),
            "rainfall": ("rainfall", "mm", "降水量の年合計", ["降水量・合計"]),
            "wind-speed": ("wind_speed", "m/s", "風速の年平均", ["平均風速"]),
            "solar-irradiance": ("solar_irradiance", "W/m²", "全天日射量の日積算量の年平均から24時間平均相当へ換算", ["全天日射量・平均"])}[weather_metric if key.startswith("weather") else key.split("-")[-1]]
        data = {"schemaVersion": 1, "id": "japan-" + key, "retrievedOn": marine_manifest["retrievedOn"] if key.startswith("marine") else manifest["retrievedOn"], "periods": periods,
            "measurementKey": metric[0], "unit": metric[1], "statistic": metric[2], "sourceFields": metric[3],
            "periodUnit": "年" if key.startswith("weather") else "年度", "realtime": False,
            "sourceUrl": JMA_URL if key.startswith("weather") else MOE_URL,
            "attribution": ("気象庁" if key.startswith("weather") else "環境省") + "の公開観測データをGAIA SENSEWAREが抽出・加工",
            "coordinateNote": "気象庁の取得時点の観測地点座標。過去の移転前の位置を復元したものではありません。" if key.startswith("weather") else "公開データの各年度のJGD2000座標。補間なし。"}
        publish_snapshot(f"japan-{key}.json", data, ARGS.check)
        print(key, periods[0]['year'], periods[-1]['year'], len(periods), 'periods', sum(p['counts']['measured'] for p in periods), 'measured', flush=True)


def append_period(periods, year, points):
    assert len({p["id"] for p in points}) == len(points), (year, "duplicate station IDs")
    periods.append({"year": year, "stations": points})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--fetch", action="store_true"); parser.add_argument("--check", action="store_true")
    parser.add_argument("--weather-only", action="store_true")
    ARGS = parser.parse_args()
    if ARGS.fetch: fetch_sources()
    build()
