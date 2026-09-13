"""Retain FAO modern rows, append older methodology and labelled Japan references.

MAFF fiscal-year records are explicitly NOT represented as FAO observations.
Missing nonnumeric table cells stay missing, even in a calculated reference.
"""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import zipfile

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
RAW = ROOT / 'artifacts/fao-food-sources-2026-09-09'
JAPAN = DATA / 'sources/japan-history'
MAFF_URL = 'https://www.maff.go.jp/j/tokei/kouhyou/zyukyu/gaiyou/'
MAPPING = {'2905': '穀類', '2511': '穀類_小麦', '2807': '穀類_米', '2514': '穀類_とうもろこし',
    '2555': '豆類_大豆', '2531': 'いも類_ばれいしょ', '2943': '肉類', '2918': '野菜', '2919': '果実'}
ELEMENTS = {'5511': 1, '5611': 2, '5911': 3}
HISTORY_NOTE = '世界はFAOSTAT旧方式FBSH（1961〜2009年）と新方式FBS（2010年以降）。旧方式と新方式は方法・人口系列等が異なり、境目の増減を実際の変化と断定しません。新方式に記録がない国の2010〜2013年は旧方式を明記。日本の不足年は農水省の年度統計を参照値として別出典で追加。米の玄米換算等の品目・換算基準がFAOと異なるため、他国との厳密比較・順位付けには不適。'


def write(name, data):
    (DATA / name).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')
    print(name, [(s['id'], s['periods'][0]['key'], s['periods'][-1]['key'], len(s['periods'])) for s in data['series']])


def maff_tables():
    manifest = json.loads((JAPAN / 'food_japan-manifest.json').read_text(encoding='utf-8'))
    tables = {}
    for source in manifest['sources']:
        path = JAPAN / source['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']
        rows = list(csv.reader(io.StringIO(path.read_text(encoding='cp932'))))
        header = next(r for r in rows if r[:2] == ['食料需給_項目', '類別・品目別'])
        years = [int(v[:4]) for v in header[2:]]
        assert years == list(range(1960, 2025))
        key = path.stem.removeprefix('maff-')
        tables[key] = {}
        for row in rows:
            if not row or '1,000トン' not in row[0]: continue
            assert row[1] not in tables[key] and len(row) == len(header)
            tables[key][row[1]] = {year: float(raw.replace(',', '')) if raw.replace(',', '').replace('.', '', 1).isdigit() else None for year, raw in zip(years, row[2:])}
    return tables, manifest


def build():
    balance = json.loads((DATA / 'fao-food-balances.json').read_text(encoding='utf-8'))
    security = json.loads((DATA / 'fao-food-security.json').read_text(encoding='utf-8'))
    manifest = json.loads((RAW / 'manifest.json').read_text(encoding='utf-8'))
    source = next(s for s in manifest['sources'] if s['file'] == 'FoodBalanceSheetsHistoric.zip')
    assert hashlib.sha256((RAW / source['file']).read_bytes()).hexdigest() == source['sha256']
    countries = {c['id']: c for c in balance['countries']}
    historical = {key: {} for key in MAPPING}
    with zipfile.ZipFile(RAW / source['file']) as archive:
        flags = csv.DictReader(io.TextIOWrapper(archive.open(next(n for n in archive.namelist() if n.endswith('_Flags.csv'))), encoding='utf-8-sig'))
        balance['historicFlags'] = {r['Flag'].strip(): r['Description'].strip() for r in flags}
        reader = csv.DictReader(io.TextIOWrapper(archive.open(next(n for n in archive.namelist() if '(Normalized)' in n)), encoding='latin-1'))
        for raw in reader:
            # Old 2805 is explicitly milled-equivalent rice, retained in notes.
            item = '2807' if raw['Item Code'] == '2805' else raw['Item Code']
            if item not in MAPPING or raw['Element Code'] not in ELEMENTS or int(raw['Area Code']) >= 5000: continue
            year = raw['Year']; code = raw['Area Code (M49)'].strip("'").zfill(3)
            assert 1961 <= int(year) <= 2013 and raw['Unit'] == '1000 t'
            try: value = float(raw['Value'])
            except ValueError: value = None
            assert value is None or math.isfinite(value)
            countries.setdefault(code, dict(id=code, faoCode=raw['Area Code'], name=raw['Area'], nameJa=raw['Area'], lon=None, lat=None))
            row = historical[item].setdefault(year, {}).setdefault(code, [code, None, None, None, '', '', '',
                {'source': dict(id='FBSH', label='FAO旧方式（1961–2013）', url='https://www.fao.org/faostat/en/#data/FBSH', periodUnit='年', originalItem=raw['Item'])}])
            index = ELEMENTS[raw['Element Code']]
            assert not row[index + 3], (item, year, code, index)
            row[index], row[index + 3] = value, raw['Flag']
    tables, japan_manifest = maff_tables()
    for series in balance['series']:
        periods = historical[series['id']]
        # Idempotent: never use our previous additions as authoritative modern rows.
        for period in series['periods']:
            for row in period['rows']:
                if int(period['key']) >= 2010 and not row[7].get('source'):
                    periods.setdefault(period['key'], {})[row[0]] = row
        for year in range(1960, 2024):
            rows = periods.setdefault(str(year), {})
            if '392' in rows: continue
            item = MAPPING[series['id']]
            amounts = [tables[k][item][year] for k in ['production', 'imports', 'exports']]
            rows['392'] = ['392', *amounts, *['MAFF' if n is not None else '' for n in amounts],
                {'source': dict(id='MAFF', label='農水省・日本の年度統計（参照値）', url=MAFF_URL, periodUnit='年度', originalItem=item,
                    note='FAO公表値ではありません。年度・品目区分・米の玄米換算等が異なるため厳密な国際比較には不適。')}]
        series['periods'] = [dict(key=year, year=int(year), rows=[rows[c] for c in sorted(rows)]) for year, rows in sorted(periods.items())]
    balance.update(countries=sorted(countries.values(), key=lambda c: c['id']), historyNote=HISTORY_NOTE,
        additionalSources=[dict(id='FBSH', **source), dict(id='MAFF', **japan_manifest)], historicRetrievedAt=source['retrievedAt'])
    balance['flags']['MAFF'] = '農水省公表数量（FAO値ではない年度参照値）'
    balance['attribution'] = balance['citation'] + ' FAO FBSH, 2023, Food Balances (-2013, old methodology and population), CC-BY-4.0. 農林水産省「令和6年度食料需給表」項目別累年表。GAIA SENSEWAREが抽出・加工。'
    write('fao-food-balances.json', balance)
    # Do not manufacture Japan's energy-adequacy indicator: MAFF has no matching
    # average dietary energy requirement series. Fiscal cereal reference is
    # separately flagged and keeps every original FAO observation untouched.
    dependency = next(s for s in security['series'] if s['id'] == '21035')
    periods = {p['key']: {r[0]: r for r in p['rows'] if r[2] != 'MAFF_DERIVED'} for p in dependency['periods']}
    for first in range(1960, 2022):
        period_key = f'{first}-{first + 2}'
        rows = periods.setdefault(period_key, {})
        if '392' in rows: continue
        groups = [[tables[k]['穀類'][y] for y in range(first, first + 3)] for k in ['production', 'imports', 'exports']]
        if any(n is None or n < 0 for group in groups for n in group): continue
        p, m, x = map(sum, groups)
        if p + m - x <= 0: continue
        value = (m - x) / (p + m - x) * 100
        note = '農水省の穀類P・M・Xを3年度で合計し (M−X)/(P＋M−X)×100 を独自算出した日本の参照値。FAO公表の3年平均とは別系列・年度基準。順位付けや連続的な同一系列としての比較は不可。'
        rows['392'] = ['392', value, 'MAFF_DERIVED', str(value), note,
            dict(sourceUrl=MAFF_URL, source='MAFF', periodUnit='年度', amounts=dict(production=p, imports=m, exports=x))]
    dependency['periods'] = [dict(key=key, year=int(key[:4]) + 1, rows=[rows[c] for c in sorted(rows)]) for key, rows in sorted(periods.items()) if rows]
    security['flags']['MAFF_DERIVED'] = '農水省の3年度数量から独自算出した参照値（FAO公表値ではありません）'
    security.update(additionalSources=[dict(id='MAFF', **japan_manifest)], historyNote='FAOの対象指標は2000年開始の3年平均から。日本の穀物輸入依存度には農水省の1960年度以降の数量から算出した別系列の参照値を追加。日本の平均食事エネルギー供給充足率は、比較可能な必要量資料がないため未補完。')
    security['attribution'] = security['citation'] + ' 日本の穀物輸入依存度の参照値：農林水産省「令和6年度食料需給表」の数量からGAIA SENSEWAREが独自算出。'
    write('fao-food-security.json', security)


if __name__ == '__main__': build()
