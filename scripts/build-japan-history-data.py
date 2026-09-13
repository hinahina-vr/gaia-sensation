"""Extend existing annual snapshots from immutable historical official sources.

Recent observations are retained exactly. Missing historical observations are
not interpolated, old annual-only IDs never imply cross-year station identity.
"""
import argparse
from collections import Counter
import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import sys
import zipfile
from annual_snapshot import ROOT, DATA, read_snapshot, write_snapshot

sys.stdout.reconfigure(encoding='utf-8')
RAW = DATA / 'sources/japan-history'
LEGACY_URL = 'https://www.nies.go.jp/igreen/index_water.html'
MOE_URL = 'https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp'


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f'scripts/{name}.py')
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


pollution = module('build-japan-pollution-data')
sensor = module('build-japan-sensor-open-data')
cod = module('build-japan-marine-cod')


def verify(family):
    manifest = json.loads((RAW / f'{family}-manifest.json').read_text(encoding='utf-8'))
    for item in manifest['sources']:
        assert hashlib.sha256((RAW / item['file']).read_bytes()).hexdigest() == item['sha256'], item['file']
    return manifest


def rows(path):
    with zipfile.ZipFile(path) as z:
        members = [n for n in z.namelist() if n.lower().endswith(('.txt', '.csv'))]
        assert len(members) == 1, path
        reader = csv.DictReader(io.StringIO(z.read(members[0]).decode('cp932')))
        names = [n for n in reader.fieldnames if n and not n.startswith('同左_') and not re.search(r'_\d+[０-９]*月$', n)]
        assert len(names) == len(set(names)), path
        return list(reader)


def extend(name, earlier, note):
    result = read_snapshot(name)
    cutoff = 2019 if name.startswith('japan-air-') else 2020
    result['periods'] = earlier + [p for p in result['periods'] if p['year'] >= cutoff]
    result['historyNote'] = note
    result['historyRetrievedOn'] = '2026-09-12'
    write_snapshot(name, result)


def legacy_water(year, nutrients=False):
    info = {r['絶対番号']: r for r in rows(RAW / f'MM{year}0000.zip')}
    columns = {'ph_min': 'pH_最小値', 'ph_max': 'pH_最大値', 'do_': 'DO_日間平均値_平均値',
        'bod': 'BOD_日間平均値_平均値', 'cod': 'COD_日間平均値_平均値', 'cod75': 'COD_日間平均値_75%値',
        'ss': 'SS_日間平均値_平均値', 'hex': 'n-ヘキサン抽出物質(油分等)_日間平均値_平均値',
        'tn': '全窒素_日間平均値_平均値', 'tp': '全燐_日間平均値_平均値'}
    output, excluded, seen = [], [], set()
    for row in rows(RAW / f'MD{year}{"03" if nutrients else "02"}00_0.zip'):
        # Some retained source tables repeat identical complete rows (1980).
        fingerprint = tuple(row.items())
        if fingerprint in seen: continue
        seen.add(fingerprint)
        assert int(row['西暦年度']) == year
        if nutrients and row['採取位置'] != '1': continue
        ident = row['絶対番号']
        point = info.get(ident)
        try:
            assert point and int(point['西暦年度']) == year
            lat = sum(float(point[f'緯度_Ｎ({u})']) / d for u, d in [('度', 1), ('分', 60), ('秒', 3600)])
            lon = sum(float(point[f'経度_Ｅ（{u}）']) / d for u, d in [('度', 1), ('分', 60), ('秒', 3600)])
            assert 122 <= lon <= 154 and 20 <= lat <= 46
        except (ValueError, AssertionError):
            excluded.append(ident)
            continue
        parts = [row[k + '_地点統一番号'] for k in ['県コード', '水域コード', '地点コード']]
        stable_id = ''.join(v.zfill(w) for v, w in zip(parts, [2, 3, 2])) if all(parts) else f'legacy-{year}-{ident}'
        item = dict(nendo=str(year), rlscode=point['ＲＬＳ識別コード'], zettaicode=ident,
            prefcode=parts[0] or ident[:2], suiikicode=parts[1], chitencode=parts[2], id=stable_id,
            locationname=point['地点名称_漢字'] or point['地点名称_カタカナ'] or ident,
            water=point['水域名称_漢字'] or point['水域名称_カタカナ'], X=str(lon), Y=str(lat), sourceUrl=LEGACY_URL)
        for key in [*columns, 'allzn', 'las', 'nonylphenol']:
            field = columns.get(key, '')
            number, flag = row.get(field, '99999'), row.get('C_' + field, 'E')
            item[key] = number if flag == '#' else '99999' if flag == 'E' else number
            item[key + '3'] = number if flag == '#' else '' if flag == 'E' else flag + number
        output.append(item)
    repeated = {k for k, n in Counter(p['id'] for p in output).items() if n > 1}
    # Conflicting duplicate original annual records have no documented priority.
    excluded.extend('ambiguous:' + k for k in sorted(repeated))
    return [p for p in output if p['id'] not in repeated], excluded


def water():
    verify('water'); verify('legacy_water')
    series = {'japan-marine-cod.json': []}
    for water_kind in ['marine', 'river', 'lake']:
        for metric in ['ph', 'do']: series[f'japan-{water_kind}-{metric}.json'] = []
    for key, _, _ in pollution.WATER: series[f'japan-water-{key}.json'] = []
    for year in range(1971, 2020):
        source, excluded = legacy_water(year) if year < 1984 else (rows(RAW / f'water-y02-{year}.zip'), [])
        nutrients = [] if year < 1984 else legacy_water(year, True)[0] if year == 1984 else rows(RAW / f'water-y03-{year}.zip')
        for name in series:
            key = name.removeprefix('japan-').removesuffix('.json')
            is_cod = key == 'marine-cod'
            special = not key.startswith('water-')
            kind = {'marine': '3', 'river': '1', 'lake': '2'}.get(key.split('-')[0]) if special else None
            column = 'cod' if is_cod else 'ph_min' if key.endswith('-ph') else 'do_'
            if not special: _, column, kind = next(s for s in pollution.WATER if key == 'water-' + s[0])
            points = []
            for row in nutrients if column in ['tn', 'tp'] else source:
                assert int(row['nendo']) == year
                if kind and row['rlscode'] != kind: continue
                # Columns were introduced at different times; absence is not zero.
                if column not in row: continue
                lon, lat = float(row['X']), float(row['Y'])
                if not (122 <= lon <= 154 and 20 <= lat <= 46): continue
                ident = row.get('id') or row['prefcode'].zfill(2) + row['suiikicode'].zfill(3) + row['chitencode'].zfill(2)
                point = dict(id=ident, sourceId=row['zettaicode'], name=row['locationname'].strip(), water=row['water'].strip(),
                    prefCode=row['prefcode'].zfill(2), lon=lon, lat=lat, sourceUrl=row.get('sourceUrl', MOE_URL))
                if is_cod:
                    point.update(cod=cod.measurement(row, 'cod'), cod75=cod.measurement(row, 'cod75'))
                else:
                    point.update(measurement=sensor.measure(row[column + '3'], row[column]),
                        secondary=sensor.measure(row['ph_max3'], row['ph_max']) if column == 'ph_min' else None)
                    if not special:
                        point.update(waterKind=row['rlscode'], water={'1': '河川', '2': '湖沼', '3': '海域'}[row['rlscode']] + ' · ' + point['water'])
                points.append(point)
            counts = {q: sum(p['cod' if is_cod else 'measurement']['quality'] == q for p in points) for q in ['measured', 'missing', 'qualified']}
            if not counts['measured'] and not counts['qualified']: continue
            points.sort(key=lambda p: p['id'])
            series[name].append(dict(year=year, stations=points, counts=counts, coordinateExcluded=excluded))
        print('Water built', year, flush=True)
    note = '1971〜1983年度は国立環境研究所の旧公共用水域DB（当時の類型指定水域）。1984年度以降は環境省、1984年度の窒素・燐は旧DBの上層記録。観測網・測定条件の変更に注意。旧資料に統一地点番号がない記録は年度別IDとし、推定で地点を接続しません。空白・定量限界・欠測を0へ補完しません。'
    for name, earlier in series.items(): extend(name, earlier, note)


def air():
    manifest = verify('air')
    available = {s['file'] for s in manifest['sources']}
    series = {key: [] for _, key, _, _ in pollution.AIR}
    for year in range(1970, 2019):
        if f'TM{year}0000.zip' not in available: continue
        stations = {r['国環研局番']: r for r in rows(RAW / f'TM{year}0000.zip')}
        for code, key, column, _ in pollution.AIR:
            file = f'TD{year}{code}00.zip'
            if file not in available: continue
            points, excluded = [], []
            observations = rows(RAW / file)
            repeated = {k for k, n in Counter(p['測定局コード'] for p in observations).items() if n > 1}
            for row in observations:
                assert int(row['測定年度']) == year and row['項目コード_数字'].zfill(2) == code
                ident = row['測定局コード']; s = stations.get(ident)
                try:
                    assert s and int(s['年度']) == year
                    lat = sum(float(s['緯度_' + u]) / d for u, d in [('度', 1), ('分', 60), ('秒', 3600)])
                    lon = sum(float(s['経度_' + u]) / d for u, d in [('度', 1), ('分', 60), ('秒', 3600)])
                    assert 122 <= lon <= 154 and 20 <= lat <= 46
                except (ValueError, AssertionError): excluded.append(ident); continue
                value = pollution.measure(row[column])
                coverage = '有効測定日数(日)' if key == 'pm25' else '昼間測定時間(時間)' if key == 'ox' else '測定時間(時間)'
                value['coverageText'] = f'原資料の{coverage}: {row[coverage] or "記録なし"}'
                display_id = f'{year}-{ident}-{row["測定局区分コード"]}' if ident in repeated else ident
                points.append(dict(id=display_id, sourceId=ident, prefCode=row['都道府県コード'].zfill(2), name=s['測定局名'].strip() or row['測定局名'],
                    water={'1': '一般環境大気測定局', '2': '自動車排出ガス測定局'}.get(row['測定局区分コード'], '測定局区分' + row['測定局区分コード']),
                    stationType=row['測定局区分コード'], lon=round(lon, 8), lat=round(lat, 8), measurement=value, secondary=None))
            unique, ambiguous = {}, set()
            for point in points:
                if point['id'] in unique and unique[point['id']] != point: ambiguous.add(point['id'])
                unique[point['id']] = point
            excluded.extend('ambiguous:' + k for k in sorted(ambiguous))
            points = [p for k, p in unique.items() if k not in ambiguous]
            if any(p['measurement']['quality'] == 'measured' for p in points): series[key].append(pollution.period(year, points, excluded))
        print('Air built', year, flush=True)
    for key, earlier in series.items(): extend(f'japan-air-{key}.json', earlier, '公表されている年度と物質だけを収録。年度ごとの測定局情報の座標で照合し、位置不明局は除外。測定網・方法の変更に注意。未観測年度の補間なし。')


def pack():
    for path in sorted(DATA.glob('japan-weather-*.json')):
        write_snapshot(path.name, read_snapshot(path.name))
    for name in ['japan-river-fish.json', 'japan-river-benthos.json']:
        write_snapshot(name, read_snapshot(name))


def prtr():
    verify('prtr')
    builder = module('build-prtr-biology-data')
    result = read_snapshot('japan-prtr-2022.json')
    recent = next(p for p in result['periods'] if p['year'] == 2022)
    recent['substanceNames'] = result['substanceNames']
    periods = []
    for year in range(2018, 2022):
        data = builder.prtr(year, RAW, False)
        period = data['periods'][0]
        period['substanceNames'] = data['substanceNames']
        period['exclusions'] = data['exclusions']
        for point in period['stations']:
            point['sourceId'] = point['id']
            point['id'] = f'{year}-{point["id"]}'
        periods.append(period)
        print('PRTR built', year, len(period['stations']), data['exclusions'], flush=True)
    result.update(periods=periods + [recent], historyRetrievedOn='2026-09-12',
        attribution='環境省・経済産業省のPRTR個別届出とNITE公式GISを同年度の整理番号で照合・加工。',
        coordinateNote='各年度のNITE事業所GIS（WGS84）。同年度の整理番号が一致する事業所のみ。年度間の事業所の同一性を推定しません。',
        historyNote='2018〜2022年度の同年度座標を取得できた届出を収録。年度別IDのため事業所の年度間連結は行わず、選択年度の物質別分析を提供。1955年当時にはPRTR届出制度がなく、過去の排出量を捏造・補間しません。')
    write_snapshot('japan-prtr-2022.json', result)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('family', choices=['water', 'air', 'pack', 'prtr'])
    globals()[parser.parse_args().family]()
