"""Independent provenance checks against retained official downloads."""
import csv
import hashlib
import importlib.util
import io
import json
import zipfile
import re
import struct
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
import unicodedata

spec = importlib.util.spec_from_file_location('builder', Path(__file__).with_name('build-prtr-biology-data.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
raw = builder.RAW
output = builder.ROOT / 'artifacts/prtr-biology-2026-09-09'
output.mkdir(exist_ok=True, parents=True)
normalize = lambda s: ''.join(unicodedata.normalize('NFKC', s).split())
with zipfile.ZipFile(raw/'office_2022.zip') as z:
    locations = {r['整番号']: (r['県'], r['市区'], float(r['経度']), float(r['緯度'])) for r in builder.dbf_rows(z.read('office_2022/office_2022.dbf'), 'utf-8') if r}
with zipfile.ZipFile(raw/'R04PRTRdata.zip') as z:
    rows = csv.reader(io.StringIO(z.read(next(n for n in z.namelist() if n.endswith('/本紙.txt'))).decode('cp932'), newline=None))
    businesses = {r[0]: (r[15], r[16], r[12]) for r in rows if r}
data = json.loads((builder.OUT/'japan-prtr-2022.json').read_text(encoding='utf-8'))
mismatches = []
for row in data['periods'][0]['stations']:
    source, position = businesses[row['id']], locations[row['id']]
    if normalize(source[0]) != normalize(position[0]) or normalize(source[1]) != normalize(position[1]):
        mismatches.append(row['id'])
    assert row['name'] == source[2]
    assert abs(row['lon']-position[2]) <= 1e-7 and abs(row['lat']-position[3]) <= 1e-7
report = {'sameYearIdAndBusinessName': len(data['periods'][0]['stations']), 'municipalityMismatchIds': mismatches,
          'coordinateToleranceDegrees': 1e-7, 'status': 'fail' if mismatches else 'pass'}
report['biologicalRawSamples'] = []
for kind, label in [('01', 'fish'), ('02', 'benthos')]:
    dataset = json.loads((builder.OUT/f'japan-river-{label}.json').read_text(encoding='utf-8'))
    point = max((s for p in dataset['periods'] for s in p['stations'] if s['prefCode'] == '85'), key=lambda s: s['measurement']['value'])
    survey = point['surveyIds'][0]
    district = point['id'].split(':')[-1]
    with zipfile.ZipFile(raw/f'RT85_B{kind}.zip') as z:
        workbook = z.read(next(n for n in z.namelist() if n.endswith('.xlsx')))
    with zipfile.ZipFile(io.BytesIO(workbook)) as x:
        ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        strings = [''.join(t.text or '' for t in item.iter(ns+'t')) for item in ET.fromstring(x.read('xl/sharedStrings.xml'))]
        survey_index = strings.index(survey)
        needle = f'<v>{survey_index}</v>'.encode()
        species, count = {}, 0
        sheet_xml = x.read('xl/worksheets/sheet1.xml')
        namespace_declarations = b' '.join(re.findall(rb'xmlns:[A-Za-z0-9_]+="[^"]+"', sheet_xml[:5000]))
        for match in re.finditer(rb'<row\b[^>]*>.*?</row>', sheet_xml, re.S):
            blob = match[0]
            if needle not in blob: continue
            cells = {}
            for c in ET.fromstring(b'<sample '+namespace_declarations+b'>'+blob+b'</sample>')[0]:
                value = c.findtext('v')
                if value is not None: cells[re.sub(r'\d+$', '', c.get('r'))] = strings[int(value)] if c.get('t') == 's' else value
            if cells.get('B') != survey or cells.get('O') != district: continue
            count += 1
            species.setdefault(cells['I'], set()).add(cells['J'])
        assert count == point['sourceRows'], (label, count, point['sourceRows'])
        assert set(species) == set(point['taxa'])
        differences = [(code, point['taxonNames'][code], sorted(names)) for code, names in species.items() if set(point['taxonNames'][code]) != names]
        assert not differences, (label, differences)
    gis_name = f'{survey}_SHP.lzh'
    gis = raw/'gis'/gis_name
    files = subprocess.check_output(['tar', '-tf', str(gis)], encoding='utf-8').splitlines()
    dbf = next(f for f in files if f.endswith('-chiku.dbf'))
    attrs = list(builder.dbf_rows(subprocess.check_output(['tar', '-xOf', str(gis), dbf]), 'cp932'))
    index = next(i for i, r in enumerate(attrs) if r and r['調査地区番'] == district and r['調査管理番'] == survey)
    shapes = subprocess.check_output(['tar', '-xOf', str(gis), dbf[:-4]+'.shp'])
    offset = 100
    for i in range(index): offset += 8+struct.unpack_from('>I', shapes, offset+4)[0]*2
    lon, lat = struct.unpack_from('<2d', shapes, offset+12)
    assert abs(lon-point['lon']) <= 1e-7 and abs(lat-point['lat']) <= 1e-7
    report['biologicalRawSamples'].append({'dataset': label, 'districtId': point['id'], 'surveyId': survey, 'sourceRows': count, 'classificationCount': len(species), 'namesAndCoordinates': 'exact source match (coordinates rounded to 7 decimals)'})
(output/'source-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
assert not mismatches, 'Do not silently join same IDs with a different prefecture/municipality'
