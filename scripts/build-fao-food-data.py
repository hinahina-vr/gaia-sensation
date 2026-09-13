"""Stream original FAOSTAT bulk CSVs into separate, deterministic exhibit snapshots.
Raw ZIPs remain immutable. No interpolation, invented zeros or country merging.
"""
import csv
from datetime import date
import hashlib
import io
import json
import math
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'artifacts/fao-food-sources-2026-09-09'
ITEMS = {'2905': '穀物（ビールを除く）', '2511': '小麦・製品', '2807': '米・製品',
         '2514': 'とうもろこし・製品', '2555': '大豆', '2531': 'じゃがいも・製品',
         '2943': '肉類', '2918': '野菜', '2919': '果実（ワインを除く）'}
INDICATORS = {'21035': '穀物輸入依存度', '21010': '平均食事エネルギー供給充足率'}
ELEMENTS = {'5511': 0, '5611': 1, '5911': 2}
manifest = json.loads((RAW / 'manifest.json').read_text(encoding='utf8'))
bulk_index = json.loads((RAW / 'datasets_E.json').read_text(encoding='utf8'))['Datasets']['Dataset']
geography = json.loads((ROOT / 'data/natural-earth-50m-countries.geojson').read_text(encoding='utf8'))
positions = {}
for feature in geography['features']:
    p = feature['properties']
    # The feature's OWN M49 only: never borrow an administering country's code.
    code = str(p['ISO_N3']).zfill(3)
    if code.isdigit() and code != '010' and p['ISO_A3'] != '-99':
        if code in positions:
            raise ValueError('Duplicate geographic M49 ' + code)
        positions[code] = dict(name=p['NAME_EN'], nameJa=p.get('NAME_JA') or p['NAME_EN'], lon=p['LABEL_X'], lat=p['LABEL_Y'])


def build(domain, basename, labels, url):
    source = next(s for s in manifest['sources'] if s['file'] == basename + '.zip')
    raw_path = RAW / source['file']
    assert hashlib.sha256(raw_path.read_bytes()).hexdigest() == source['sha256']
    tables = {key: {} for key in labels}
    countries = {code: dict(id=code, faoCode=None, **p) for code, p in positions.items()}
    excluded, originals, flags = {}, {}, {}
    with zipfile.ZipFile(raw_path) as archive:
        flag_name = next(n for n in archive.namelist() if n.endswith('_Flags.csv'))
        for row in csv.DictReader(io.TextIOWrapper(archive.open(flag_name), encoding='utf-8-sig')):
            row = {k.strip(): v for k, v in row.items()}
            flags[row['Flag']] = row['Description']
        name = next(n for n in archive.namelist() if '(Normalized)' in n)
        reader = csv.DictReader(io.TextIOWrapper(archive.open(name), encoding='utf-8-sig'))
        for raw in reader:
            item = raw['Item Code']
            if item not in labels:
                continue
            element = raw['Element Code']
            if domain == 'FBS' and element not in ELEMENTS:
                continue
            if domain == 'FS' and raw['Unit'] != '%':
                raise ValueError('Unexpected FS unit ' + raw['Unit'])
            key = raw['Year']
            if domain == 'FBS' and not 2010 <= int(key) <= 2023:
                continue
            if domain == 'FS' and (len(key) != 9 or key[4] != '-'):
                raise ValueError('Expected three-year period ' + key)
            code = raw['Area Code (M49)'].strip("'").zfill(3)
            if int(raw['Area Code']) >= 5000:
                excluded[code] = dict(name=raw['Area'], reason='FAO regional/world aggregate')
                continue
            countries[code] = dict(id=code, faoCode=raw['Area Code'], **(positions.get(code) or dict(name=raw['Area'], nameJa=raw['Area'], lon=None, lat=None)))
            countries[code]['name'] = raw['Area']
            originals[item] = raw['Item']
            try:
                value = float(raw['Value'])
                assert math.isfinite(value)
            except ValueError:
                value = None
            if domain == 'FBS':
                assert raw['Unit'] == '1000 t', raw['Unit']
                # Preserve negative published quantities; the UI reports them
                # but does not derive a physical balance/SSR from them.
                cells = tables[item].setdefault(key, {}).setdefault(code, [code, None, None, None, '', '', '', {}])
                index = ELEMENTS[element]
                if cells[4 + index]:
                    raise ValueError('Duplicate observation ' + str(raw))
                cells[1 + index], cells[4 + index] = value, raw['Flag']
                if raw['Note'] or (raw['Value'] and value is None):
                    cells[7][element] = dict(text=raw['Value'], note=raw['Note'])
            else:
                rows = tables[item].setdefault(key, {})
                if code in rows:
                    raise ValueError('Duplicate indicator ' + str(raw))
                rows[code] = [code, value, raw['Flag'], raw['Value'], raw['Note']]
    index_entry = next(entry for entry in bulk_index if entry['DatasetCode'] == domain)
    accessed = source['retrievedAt'][:10]
    citation_date = date.fromisoformat(accessed).strftime('%d %B %Y')
    citation = f"FAO. {index_entry['DateUpdate'][:4]}. FAOSTAT: {index_entry['DatasetName']}. [Accessed on {citation_date}]. https://www.fao.org/faostat/en/#data/{domain}. Licence: CC-BY-4.0."
    payload = dict(schemaVersion=1, domain=domain, retrievedAt=source['retrievedAt'], lastUpdated=index_entry['DateUpdate'][:10], citation=citation,
        source=dict(name='FAOSTAT ' + domain, catalogUrl=url, **source), flags=flags,
        attribution=citation + ' GAIA SENSEWARE が抽出・加工。FAOによる推奨を意味しません。',
        license='CC BY 4.0 (FAO database terms apply)', termsUrl='https://www.fao.org/contact-us/terms/db-terms-of-use/en/',
        positionNote='Natural Earth 50m 国・地域の代表位置。農地・港・実際の貿易経路ではありません。座標未収録の国・地域も一覧には保持。',
        columns=['country', 'production', 'imports', 'exports', 'productionFlag', 'importsFlag', 'exportsFlag', 'notes'] if domain == 'FBS' else ['country', 'value', 'flag', 'sourceText', 'note'],
        missingPolicy='欠測・数値以外・負の数量・分母0以下は自給率算出不可。0埋め・補間・旧国家の現国家への付替なし。',
        countries=sorted(countries.values(), key=lambda r: r['id']), excludedAggregates=excluded,
        series=[dict(id=item, label=labels[item], originalLabel=originals[item], periods=[
            dict(key=key, year=int(key) if domain == 'FBS' else int(key[:4]) + 1,
                 rows=[rows[code] for code in sorted(rows)]) for key, rows in sorted(tables[item].items())]) for item in labels])
    target = ROOT / ('data/fao-food-balances.json' if domain == 'FBS' else 'data/fao-food-security.json')
    content = json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n'
    target.write_text(content, encoding='utf8', newline='\n')
    print(target.name, len(content.encode()), 'bytes;', len(countries), 'countries/territories;', [(s['id'], len(s['periods']), len(s['periods'][-1]['rows'])) for s in payload['series']])
    assert '392' in countries, 'Japan must survive original-source extraction'


build('FBS', 'FoodBalanceSheets', ITEMS, 'https://data.fao.org/catalog/iso/2f264bb6-1238-459a-bf8b-0e2d0a16804a')
build('FS', 'Food_Security_Data', INDICATORS, 'https://data.fao.org/catalog/dataset/955d6564-40a9-48b4-b51b-f19d65bb3539')
