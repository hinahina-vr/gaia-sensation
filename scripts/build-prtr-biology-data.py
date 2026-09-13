"""Extract official PRTR and historical river surveys; never fill missing locations.

Requires Python + lxml and Windows bsdtar (reads the official LZH GIS archives).
Raw downloads remain untouched under artifacts/. Only aggregate public business
and survey attributes are published; individual representatives are not copied.
"""
import csv
import hashlib
import io
import json
import re
import struct
import subprocess
import sys
import zipfile
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
from lxml import etree
from annual_snapshot import publish_snapshot

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'artifacts/prtr-biology-sources'
OUT = ROOT / 'data'
RETRIEVED = '2026-09-09'
MOE = 'https://www.env.go.jp/chemi/prtr/kaiji/index.html'
NILIM = 'https://www.nilim.go.jp/lab/fbg/ksnkankyo/'
BIOLOGY_YEARS = range(1990, 2024)
PREFS = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split()
manifest = {'retrievedOn': RETRIEVED, 'sources': [], 'checks': {}}

def record_source(name, url):
    p = RAW / name
    manifest['sources'].append({'file': name, 'url': url, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})

def dbf_rows(blob, encoding):
    count, head, size = struct.unpack_from('<IHH', blob, 4)
    fields = [(blob[i:i+11].split(b'\0')[0].decode(encoding), blob[i+16]) for i in range(32, head-1, 32)]
    for i in range(count):
        offset, values = head+i*size+1, {}
        if blob[offset-1:offset] == b'*':
            yield None
            continue
        for name, width in fields:
            values[name] = blob[offset:offset+width].decode(encoding).strip()
            offset += width
        yield values

def measurement(value):
    text = format(Decimal(str(value)), ',f') if value is not None else '記録なし'
    if '.' in text: text = text.rstrip('0').rstrip('.')
    return {'value': value, 'text': text, 'quality': 'measured' if value is not None else 'missing'}

def save(name, data):
    data.update(schemaVersion=1, retrievedOn=RETRIEVED)
    print(name, [(p['year'], len(p['stations'])) for p in data['periods']], flush=True)
    publish_snapshot(name, data)

def prtr(year=2022, source_dir=RAW, publish=True):
    coords = {}
    era = f'H{year - 1988:02}' if year <= 2018 else f'R{year - 2018:02}'
    with zipfile.ZipFile(source_dir / f'office_{year}.zip') as z:
        filename = next(n for n in z.namelist() if n.endswith('.dbf'))
        assert b'WGS_1984' in z.read(filename[:-4] + '.prj')
        shape = z.read(filename[:-4] + '.shp')
        offset, coordinates = 100, []
        while offset < len(shape):
            words = struct.unpack_from('>I', shape, offset + 4)[0]
            record = shape[offset + 8:offset + 8 + words * 2]
            shape_type = struct.unpack_from('<I', record)[0]
            assert shape_type in [0, 1, 11, 21], (year, shape_type)
            coordinates.append(struct.unpack_from('<2d', record, 4) if shape_type else None)
            offset += 8 + words * 2
        encoding = z.read(filename[:-4] + '.cpg').decode().strip().lower()
        assert encoding in ['utf-8', 'shift_jis'], (year, encoding)
        attributes = list(dbf_rows(z.read(filename), 'utf-8' if encoding == 'utf-8' else 'cp932'))
        assert len(attributes) == len(coordinates)
        for row, location in zip(attributes, coordinates):
            if row:
                if not location: continue
                pair = [float(row['経度']), float(row['緯度'])] if '経度' in row else list(location)
                if 122 <= pair[0] <= 154 and 20 <= pair[1] <= 46:
                    key = row['整番号']
                    assert key not in coords or coords[key] == pair
                    coords[key] = pair
    stations, dictionary, excluded = {}, {}, Counter()
    with zipfile.ZipFile(source_dir / f'{era}PRTRdata.zip', metadata_encoding='cp932') as z:
        def rows(suffix):
            name = next(n for n in z.namelist() if Path(n).name == suffix)
            return csv.reader(io.StringIO(z.read(name).decode('cp932'), newline=None))
        for row in rows('本紙.txt'):
            if not row: continue
            assert int(row[1]) == year
            if row[0] not in coords:
                excluded['noMatchingCoordinate'] += 1
                continue
            lon, lat = coords[row[0]]
            stations[row[0]] = {'id': row[0], 'name': row[12], 'water': row[16],
                'prefCode': f'{PREFS.index(row[15])+1:02}', 'lon': round(lon, 7), 'lat': round(lat, 7),
                'substances': [], 'industry': row[19]}
        for row in rows('別紙.txt'):
            if not row: continue
            if row[4] != '1':
                assert row[4] == '2'
                excluded['mgTEQSubstanceRows'] += 1
                continue
            if row[0] not in stations: continue
            code = row[3]
            dictionary[code] = row[2]
            # Keep six different channels. Sum transfers only after preserving sewer/waste.
            values = [Decimal(row[i]) if row[i] else None for i in [5, 6, 8, 9, 13, 15]]
            assert all(v is None or v >= 0 for v in values)
            stations[row[0]]['substances'].append([code, *[float(v) if v is not None else None for v in values]])
    for point in stations.values():
        sums = []
        for i in range(1, 7):
            values = [r[i] for r in point['substances']]
            sums.append(float(sum((Decimal(str(v)) for v in values), Decimal(0))) if values and all(v is not None for v in values) else None)
        transfer = None if any(v is None for v in sums[4:]) else float(Decimal(str(sums[4]))+Decimal(str(sums[5])))
        point['metrics'] = dict(zip(['air', 'water', 'transfer'], map(measurement, [sums[0], sums[1], transfer])))
        point['totals'] = sums
    # Same-year official reporting ID joins only; no unsupported cross-year ID matching.
    payload = {'periods': [{'year': year, 'stations': list(stations.values()),
        'counts': {'measured': sum(p['metrics']['air']['value'] is not None for p in stations.values()), 'missing': sum(p['metrics']['air']['value'] is None for p in stations.values())}}],
        'substanceNames': dictionary, 'attribution': '環境省・経済産業省の2022年度PRTR届出（2026年2月修正）とNITE公式GISをGAIA SENSEWAREが整理番号で照合・加工',
        'coordinateNote': '座標はNITEの2022年度事業所GIS（WGS84）。同年度の整理番号が一致する事業所だけを掲載。代表者氏名・連絡先は収録しません。',
        'exclusions': dict(excluded)}
    if not publish: return payload
    save('japan-prtr-2022.json', payload)
    manifest['checks']['prtr'] = {'matchedFacilities': len(stations), **excluded}
    record_source('office_2022.zip', 'https://www.nite.go.jp/chem/prtr/mapdata/data/2022/data_3/office/office_2022.zip')
    record_source('R04PRTRdata.zip', 'https://www.env.go.jp/chemi/prtr/kaiji/data/R04PRTRdata.zip')

def survey_positions(region, kind):
    positions, ambiguous = {}, set()
    with zipfile.ZipFile(RAW / f'RG{region}_B{kind}.zip') as z:
        for name in z.namelist():
            leaf = Path(name).name
            match = re.match(r'R(\d{4})_.*_SHP.lzh$', leaf)
            if not match or int(match[1]) not in BIOLOGY_YEARS: continue
            target = RAW / 'gis' / leaf
            target.parent.mkdir(exist_ok=True)
            if not target.exists(): target.write_bytes(z.read(name))
            members = subprocess.check_output(['tar', '-tf', str(target)], encoding='utf-8').splitlines()
            dbf = next((n for n in members if re.search(r'm-[^-]+-chiku\.dbf$', n, re.I)), None)
            if not dbf: continue
            shape = subprocess.check_output(['tar', '-xOf', str(target), dbf[:-4]+'.shp'])
            attrs = list(dbf_rows(subprocess.check_output(['tar', '-xOf', str(target), dbf]), 'cp932'))
            offset, coordinates = 100, []
            while offset < len(shape):
                words = struct.unpack_from('>I', shape, offset+4)[0]
                rec = shape[offset+8:offset+8+words*2]
                shape_type = struct.unpack_from('<I', rec)[0]
                assert shape_type in [0, 1, 11, 21], (name, shape_type)
                coordinates.append(struct.unpack_from('<2d', rec, 4) if shape_type else None)
                offset += 8+words*2
            assert len(attrs) == len(coordinates)
            for row, pair in zip(attrs, coordinates):
                if not row or not pair: continue
                if not (122 <= pair[0] <= 154 and 20 <= pair[1] <= 46): continue
                survey = row.get('調査管理番')
                district = row.get('調査地区番')
                if not survey or not district: continue
                key = (survey, district)
                if key in ambiguous: continue
                if key in positions and positions[key]['pair'] != pair:
                    ambiguous.add(key)
                    del positions[key]
                    continue
                positions[key] = {'pair': pair, 'riverCode': row.get('河川コード', ''), 'gis': name}
    manifest['checks'][f'gis-{region}-{kind}'] = {'districts': len(positions), 'ambiguousDistrictsExcluded': len(ambiguous)}
    return positions

def recent_sheet_rows(workbook, ns):
    # These official XLSX tables put 調査年度 in G. Filter historical rows in
    # the XML stream before constructing cell objects; never alter the workbook.
    blob = workbook.read('xl/worksheets/sheet1.xml')
    declarations = b' '.join(re.findall(rb'xmlns(?::[A-Za-z0-9_]+)?="[^"]+"', blob[:5000]))
    year_cell = re.compile(rb'<c\b[^>]*\br="G\d+"[^>]*>\s*<v>(\d+)</v>')
    for match in re.finditer(rb'<row\b[^>]*>.*?</row>', blob, re.S):
        row = match[0]
        if not re.match(rb'<row\b[^>]*\br="1"(?:\s|>)', row):
            year = year_cell.search(row)
            if not year or int(year[1]) not in BIOLOGY_YEARS: continue
        yield etree.fromstring(b'<sheet '+declarations+b'>'+row+b'</sheet>')[0]

def biological(kind, label):
    periods = {year: {} for year in BIOLOGY_YEARS}
    dictionary, audit = {}, Counter()
    for region in range(81, 90):
        positions = survey_positions(region, kind)
        print('GIS', region, kind, len(positions), flush=True)
        name = f'RT{region}_B{kind}.zip'
        with zipfile.ZipFile(RAW / name) as z:
            workbook = next(n for n in z.namelist() if n.endswith('.xlsx'))
            with zipfile.ZipFile(io.BytesIO(z.read(workbook))) as x:
                ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
                ss = etree.fromstring(x.read('xl/sharedStrings.xml'))
                strings = [''.join(si.itertext()) for si in ss]
                del ss
                # Chunk by complete XML row; read only required cells, ignoring styles and formulas.
                for el in recent_sheet_rows(x, ns):
                    if el.get('r') == '1':
                        headers = {c.get('r').rstrip('0123456789'): strings[int(c.findtext(ns+'v'))] for c in el if c.findtext(ns+'v') is not None}
                        assert headers.get('G') == '調査年度'
                        wanted = {col: h for col, h in headers.items() if h in ['調査管理番号', '調査年度', '種コード', '種名', '個体数', '河川名', '水系', '地区番号', '地区名']}
                    else:
                        cells = {}
                        for c in el:
                            col = c.get('r').rstrip('0123456789')
                            if col not in wanted: continue
                            value = c.findtext(ns+'v')
                            if value is not None: cells[wanted[col]] = strings[int(value)] if c.get('t') == 's' else value
                        year = int(cells.get('調査年度', 0))
                        if year in periods:
                            audit['sourceRowsInPeriod'] += 1
                            key = (cells.get('調査管理番号'), cells.get('地区番号'))
                            location = positions.get(key)
                            if not location:
                                audit['rowsWithoutDistrictGIS'] += 1
                            elif not cells.get('種コード') or not cells.get('種名') or cells['種コード'] == '0':
                                audit['rowsWithoutTaxon'] += 1
                            else:
                                point_id = f'{region}:{location["riverCode"]}:{key[1]}'
                                point = periods[year].setdefault(point_id, {'id': point_id, 'name': cells.get('地区名') or key[1],
                                    'water': f'{cells.get("水系", "")}水系 / {cells.get("河川名", "")}', 'prefCode': str(region),
                                    'lon': round(location['pair'][0], 7), 'lat': round(location['pair'][1], 7),
                                    'surveyIds': set(), 'taxa': set(), 'taxonNames': {}, 'sourceRows': 0, 'sourceUrl': f'{NILIM}dl_{region}_index.html'})
                                point['surveyIds'].add(key[0])
                                point['sourceRows'] += 1
                                code = cells['種コード']
                                dictionary.setdefault(code, cells['種名'])
                                point['taxa'].add(code)
                                point['taxonNames'].setdefault(code, set()).add(cells['種名'])
                    el.clear()
                    while el.getprevious() is not None: del el.getparent()[0]
        for prefix, folder in [('RT', 'slist'), ('RG', 'shape')]:
            filename = f'{prefix}{region}_B{kind}.zip'
            record_source(filename, f'{NILIM}download/{folder}/{filename}')
        print('TABLE', region, kind, dict(audit), flush=True)
    for points in periods.values():
        for point in points.values():
            point['taxonNames'] = {code: sorted(names) for code, names in point['taxonNames'].items()}
            point['taxa'] = sorted(point['taxa'], key=lambda c: (point['taxonNames'][c][0], c))
            point['surveyIds'] = sorted(point['surveyIds'])
            point['measurement'] = measurement(len(point['taxa']))
            point['measurement']['coverageText'] = '確認分類群数（属・科等の同定を含む）。個体数・生息密度・水質等級ではありません。'
    save(f'japan-river-{label}.json', {'periods': [{'year': y, 'stations': list(p.values()), 'counts': {'measured': len(p), 'missing': 0}} for y, p in periods.items() if p],
        'taxonNames': dictionary, 'attribution': '国土交通省・国土技術政策総合研究所「河川水辺の国勢調査」確認リスト・GISをGAIA SENSEWAREが調査管理番号と地区番号で照合・集計',
        'coordinateNote': '北海道〜九州の9地方の河川調査。点は公開GISの調査地区代表点で、採集した個体の正確な位置や生息範囲ではありません。原GISの経緯度を保持（個別の測地系定義ファイルなし、独自の測地変換なし）。地点GISと照合できない確認行は除外。', 'exclusions': dict(audit)})
    manifest['checks'][label] = dict(audit)

if __name__ == '__main__':
    if '--biology-only' not in sys.argv: prtr()
    if '--prtr-only' not in sys.argv:
        biological('01', 'fish')
        biological('02', 'benthos')
    target = OUT / 'sources/prtr-biology'
    target.mkdir(parents=True, exist_ok=True)
    if (target/'manifest.json').exists():
        previous = json.loads((target/'manifest.json').read_text(encoding='utf-8'))
        manifest['sources'] = list({s['file']: s for s in previous['sources'] + manifest['sources']}.values())
        manifest['checks'] = previous['checks'] | manifest['checks']
    (target/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
