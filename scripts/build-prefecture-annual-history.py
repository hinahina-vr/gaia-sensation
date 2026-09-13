"""Read official annual tables; never interpolate missing values or merge populations.

Use the bundled Python runtime with openpyxl; --xls-deps may point at an isolated
xlrd installation for legacy MLIT .xls files. Raw downloads are cached locally.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import html
import io
import json
from pathlib import Path
import re
import sys
import time
import unicodedata
import urllib.request
import warnings

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "artifacts" / "annual-history" / "sources"
SOURCES = {
    "migration": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040430818&fileKind=0",
    "housing": "https://www.mlit.go.jp/sogoseisaku/jouhouka/content/001979029.xls",
    "lodging": "https://www.mlit.go.jp/kankocho/content/002018997.xlsx",
}


def download(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / (hashlib.sha256(url.encode()).hexdigest()[:24] + ".bin")
    if not target.exists():
        request = urllib.request.Request(url, headers={"User-Agent": "GAIA-SENSEWARE-data-build/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            content = response.read()
        target.write_bytes(content)
    return target.read_bytes()


def workbook(url):
    content = download(url)
    if content.startswith(b"PK"):
        import openpyxl
        # Print-area metadata is irrelevant to value extraction.
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="Print area cannot be set")
            book = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        return {sheet.title: list(sheet.iter_rows(values_only=True)) for sheet in book}
    import xlrd
    book = xlrd.open_workbook(file_contents=content)
    return {sheet.name: [sheet.row_values(i) for i in range(sheet.nrows)] for sheet in book.sheets()}


def plain(value):
    return html.unescape(re.sub(r"<[^>]+>", " ", value)).strip()


def normalized(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(value or "")))


def era_year(value):
    match = re.search(r"(昭和|平成|令和)(元|\d+)年", normalized(value))
    if not match:
        return None
    return str({"昭和": 1925, "平成": 1988, "令和": 2018}[match[1]] + (1 if match[2] == "元" else int(match[2])))


def count_value(value):
    if isinstance(value, (int, float)):
        assert int(value) == value, f"Non-integer count: {value}"
        return int(value)
    assert normalized(value) in ["", "-", "―", "—", "…", "・・・", "－", "－", "ー"], f"Unexpected count cell: {value!r}"
    return None


def year_range(start, end=2025):
    return [str(year) for year in range(start, end + 1)]


def source_metadata(key, name, publisher, start, note, **extra):
    return {"name": name, "publisher": publisher, "coverage": f"{start}-2025 / 47都道府県",
            "frequency": "年次", "sourceUrl": SOURCES[key], "comparisonNote": note,
            "sha256": hashlib.sha256(download(SOURCES[key])).hexdigest(),
            "missingValuePolicy": "欠損補完なし", **extra}


def build_migration():
    rows = workbook(SOURCES["migration"])["総数"]
    assert rows[2][0] == "日本人移動者", "Do not splice total residents into the Japanese-only history"
    columns = {normalized(value): column for column, value in enumerate(rows[6]) if re.fullmatch(r"(?:19|20)\d{2}", normalized(value)) and 1954 <= int(value) <= 2025}
    assert list(columns) == year_range(1954)
    prefectures = {row[0]: row for row in rows if isinstance(row[0], str) and re.fullmatch(r"\d{2}", row[0]) and 1 <= int(row[0]) <= 47}
    assert len(prefectures) == 47
    values = {year: [count_value(prefectures[f"{code:02}"][column]) for code in range(1, 48)] for year, column in columns.items()}
    assert all(sum(v for v in row if v is not None) == 0 for row in values.values()), "Inter-prefecture net migration must balance"
    return values, source_metadata("migration", "住民基本台帳人口移動報告 長期時系列 第5表（総数・日本人移動者）", "総務省統計局", 1954,
        "全期間を日本人移動者に統一。外国人は含みません。沖縄県は1973年から収録。出生・死亡を含む人口増減ではありません。",
        population="日本人移動者・男女計", table="第5表／総数", okinawaStart="1973")


def build_housing(stations):
    rows = workbook(SOURCES["housing"])["年計"]
    index_by_name = {}
    for index, station in enumerate(stations):
        name = station["prefecture"]
        index_by_name[name] = index
        if name != "北海道":
            index_by_name[name[:-1]] = index
    values, national, columns = {}, {}, {}
    for row in rows:
        name = normalized(row[0])
        if name == "都道府県名":
            columns = {column: year for column, cell in enumerate(row) if (year := era_year(cell))}
            for year in columns.values():
                assert year not in values, f"Duplicate housing year {year}"
                values[year] = [None] * 47
        elif name == "合計":
            for column, year in columns.items():
                national[year] = count_value(row[column])
        elif name in index_by_name:
            for column, year in columns.items():
                values[year][index_by_name[name]] = count_value(row[column])
    assert list(values) == year_range(1951)
    assert all(sum(v for v in row if v is not None) == national[year] for year, row in values.items()), "Housing prefectures do not reconcile to the official national total"
    assert "沖縄県は昭和48年計から集計開始" in normalized(rows[-1][0])
    return values, source_metadata("housing", "建築着工統計調査 年計 都道府県別新設住宅戸数", "国土交通省", 1951,
        "暦年の着工戸数で、竣工戸数や住宅需要ではありません。沖縄県は1973年から収録。未収録年は欠測です。",
        table="年計／都道府県別戸数", okinawaStart="1973")


def build_lodging():
    rows = workbook(SOURCES["lodging"])["旧5-1"]
    assert "従業者数10人以上の施設" in rows[0][0] and "年計" in rows[0][0]
    columns = {year: column for column, cell in enumerate(rows[2]) if (year := era_year(cell))}
    assert list(columns) == year_range(2007)
    prefectures = {}
    for row in rows:
        match = re.match(r"^(\d{2})", normalized(row[0]))
        if match and 1 <= int(match[1]) <= 47:
            prefectures[match[1]] = row
    assert len(prefectures) == 47
    values = {year: [count_value(prefectures[f"{code:02}"][column]) for code in range(1, 48)] for year, column in columns.items()}
    assert all(all(v is not None and v > 0 for v in row) for row in values.values())
    # Published estimates are rounded to tens; their sum can differ from Japan.
    assert all(abs(sum(values[year]) - rows[4][column]) <= 47 * 10 for year, column in columns.items())
    return values, source_metadata("lodging", "宿泊旅行統計調査 推移表 旧5-1（年計・従業者10人以上）", "観光庁", 2007,
        "比較対象を全期間で従業者10人以上の施設に統一。小規模施設は含みません。2010年の対象拡大前後で全施設系列を接続していません。実人数ではなく人泊です。",
        population="従業者数10人以上の宿泊施設", table="旧5-1／年計", unit="人泊")


WEATHER_COLUMNS = {"a1": {"precipitation": 5, "rainyDays": 16}, "a2": {"relativeHumidity": 21}, "a4": {"sunshineHours": 1}}
WEATHER_LABELS = {"relativeHumidity": "年平均相対湿度", "sunshineHours": "年間日照時間", "precipitation": "年間降水量", "rainyDays": "年間降水日数（日降水量1.0mm以上）"}


def weather_number(cell):
    raw = plain(cell)
    # JMA ] denotes insufficient observations: do not treat the reference value
    # as a fully observed year. A ) value is usable with its quality flag retained.
    if not raw or raw in ["×", "///", "--"]:
        return None, "missing", raw
    if "]" in raw or "#" in raw:
        return None, "insufficient", raw
    match = re.fullmatch(r"(-?\d+(?:\.\d+)?)\s*(\))?", raw)
    assert match, f"Unrecognized JMA annual value {raw!r}"
    number = float(match[1])
    return int(number) if number.is_integer() else number, "quasi-normal" if match[2] else "normal", raw


def fetch_weather_station(station):
    values = {key: {} for key in WEATHER_LABELS}
    quality, urls = [], {}
    for view, columns in WEATHER_COLUMNS.items():
        url = f'https://www.data.jma.go.jp/stats/etrn/view/annually_s.php?prec_no={station["precNo"]}&block_no={station["blockNo"]}&year=&month=&day=&view={view}'
        urls[view] = url
        document = download(url).decode("utf-8")
        assert f'{station["station"]}（' in document, f"Wrong JMA station: {station}"
        seen = set()
        for row in re.findall(r'<tr class="mtx2"[^>]*>([\s\S]*?)</tr>', document):
            cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row)
            year = plain(cells[0]) if cells else ""
            if year not in year_range(1955):
                continue
            assert year not in seen
            seen.add(year)
            for key, column in columns.items():
                number, flag, raw = weather_number(cells[column])
                if number is not None:
                    assert 0 <= number <= (100 if key == "relativeHumidity" else 366 if key == "rainyDays" else 9000)
                values[key][year] = number
                if flag != "normal":
                    quality.append({"series": key, "year": year, "code": station["code"], "flag": flag, "sourceText": raw})
        assert seen == set(year_range(1955)), f"Missing JMA annual rows for {station['station']}/{view}"
        time.sleep(.12)
    return {"station": station, "values": values, "quality": quality, "urls": urls}


def build():
    target = ROOT / "data" / "estat-prefecture-series.json"
    data = json.loads(target.read_text(encoding="utf-8"))
    stations = data["temperatureHistorySource"]["stations"]
    metadata = {}
    for key, builder in [("migration", build_migration), ("housing", lambda: build_housing(stations)), ("lodging", build_lodging)]:
        values, source = builder()
        data[key] = values
        data["periodsBySeries"][key] = list(values)
        metadata[key] = source
        print(key, len(values), "years", flush=True)
    collected = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(fetch_weather_station, stations):
            collected.append(result)
            print(f'weather {len(collected):02}/47 {result["station"]["station"]}', flush=True)
    for key in WEATHER_LABELS:
        data[key] = {year: [result["values"][key][year] for result in collected] for year in year_range(1955)}
        data["periodsBySeries"][key] = year_range(1955)
        assert all(sum(v is not None for v in row) >= 40 for row in data[key].values()), f"Too few annual sites: {key}"
    data["annualHistorySources"] = metadata
    data["weatherHistorySource"] = {
        "publisher": "気象庁", "name": "過去の気象データ検索 年ごとの値（詳細）", "coverage": "1955-2025 / 47都道府県の代表気象台・測候所",
        "metrics": WEATHER_LABELS, "rainyDayThresholdMm": 1.0, "missingValuePolicy": "欠損補完なし。資料不足値（]）は欠測。準正常値（)）は品質情報を保持。",
        "comparisonNote": "県全域の平均ではありません。移転や測器変更により長期系列が均質でない場合があります。日照計は1986〜1990年に測器変更があり、補正せず掲載しています。",
        "stations": [{**result["station"], "urls": result["urls"]} for result in collected],
        "qualityFlags": [flag for result in collected for flag in result["quality"]],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    # Keep only annual periods in the active snapshot. The separate, legacy
    # monthly module is not used as fallback for these annual exhibits.
    data.pop("months", None)
    data.pop("ids", None)
    data.pop("naturalEnvironmentSource", None)
    data["generatedAt"] = datetime.now(timezone.utc).isoformat()
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "written", "periods": {key: len(years) for key, years in data["periodsBySeries"].items()},
                      "qualityFlags": len(data["weatherHistorySource"]["qualityFlags"])}, ensure_ascii=False))


def inspect(args):
    if args.source == "jma":
        for view in ["a1", "a2", "a4"]:
            url = f"https://www.data.jma.go.jp/stats/etrn/view/annually_s.php?prec_no=44&block_no=47662&year=&month=&day=&view={view}"
            document = download(url).decode("utf-8")
            rows = re.findall(r'<tr class="mtx2"[^>]*>([\s\S]*?)</tr>', document)
            row = next(row for row in rows if ">1955<" in row)
            print(view, [(i, plain(cell)) for i, cell in enumerate(re.findall(r"<td[^>]*>([\s\S]*?)</td>", row))])
        return
    sheets = workbook(SOURCES[args.source])
    print("sheets", len(sheets), [(name, len(rows), max(map(len, rows))) for name, rows in list(sheets.items())[:20]])
    names = args.sheets.split(",") if args.sheets else list(sheets)[:1]
    for name in names:
        print("SHEET", name)
        for index, row in enumerate(sheets[name][:args.rows], 1):
            print(index, row[:args.columns])


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xls-deps")
    parser.add_argument("--inspect", dest="source", choices=[*SOURCES, "jma"])
    parser.add_argument("--sheets", default="")
    parser.add_argument("--rows", type=int, default=12)
    parser.add_argument("--columns", type=int, default=12)
    parser.add_argument("--build", action="store_true")
    args = parser.parse_args()
    if args.xls_deps:
        sys.path.insert(0, args.xls_deps)
    if args.source:
        inspect(args)
    elif args.build:
        build()
