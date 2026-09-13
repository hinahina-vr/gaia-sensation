"""Regression: shipped history, immutable old periods and honest food provenance."""
import csv
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import subprocess
import sys
from annual_snapshot import ROOT, DATA, read_part

sys.stdout.reconfigure(encoding='utf-8')
BASELINE = os.environ.get('GAIA_HISTORY_BASELINE', 'db63742')
report = {'baseline': BASELINE, 'checks': [], 'oldPeriods': 0, 'stationRecords': 0, 'status': 'running'}
for path in sorted(DATA.glob('japan-*.json')):
    data = json.loads(path.read_text(encoding='utf-8'))
    if data.get('schemaVersion') != 2: continue
    baseline = json.loads(subprocess.check_output(['git', 'show', f'{BASELINE}:data/{path.name}'], cwd=ROOT))
    original = {p['year']: p for p in baseline['periods']}
    years = [p['year'] for p in data['periods']]
    assert years == sorted(set(years)) and years[0] < min(original), path.name
    for meta in data['periods']:
        blob = (DATA / meta['file']).read_bytes()
        assert hashlib.sha256(blob).hexdigest() == meta['sha256']
        period = read_part(meta['file'])
        points = period['stations']
        assert period['year'] == meta['year'] and len(points) == meta['stationCount']
        assert len({p['id'] for p in points}) == len(points)
        counts = {'measured': 0, 'missing': 0, 'qualified': 0}
        for point in points:
            assert 122 <= point['lon'] <= 154 and 20 <= point['lat'] <= 46
            reading = point.get('cod') or point.get('measurement') or point['metrics']['air']
            counts[reading['quality']] += 1
            if reading['quality'] != 'measured': assert reading['value'] is None
            else: assert isinstance(reading['value'], (float, int)) and math.isfinite(reading['value'])
        for key, value in period['counts'].items(): assert counts[key] == value, (path.name, meta['year'], key)
        if meta['year'] in original:
            old = original[meta['year']]
            # Equal source names can have several taxon codes. Earlier builder
            # used a set's process-dependent tie order; order is not a datum.
            canonical = lambda rows: [{**p, 'taxa': sorted(p['taxa'])} if 'taxa' in p else p for p in rows]
            assert canonical(points) == canonical(old['stations']), (path.name, meta['year'], 'changed existing observation')
            assert period['counts'] == old['counts']
            report['oldPeriods'] += 1
        report['stationRecords'] += len(points)
    for part in data['historyShards']:
        blob = (DATA / part['file']).read_bytes()
        assert hashlib.sha256(blob).hexdigest() == part['sha256']
        history = read_part(part['file'])
        for ident, observations in history.items():
            assert all(int(y) in years and p['id'] == ident for y, p in observations.items())
    report['checks'].append({'file': path.name, 'first': years[0], 'last': years[-1], 'periods': len(years), 'missingYears': sorted(set(range(years[0], years[-1] + 1)) - set(years))})
    print('PASS annual', path.name, years[0], years[-1], flush=True)

for name in ['fao-food-balances.json', 'fao-food-security.json']:
    data = json.loads((DATA / name).read_text(encoding='utf-8'))
    baseline = json.loads(subprocess.check_output(['git', 'show', f'{BASELINE}:data/{name}'], cwd=ROOT))
    for old in baseline['series']:
        series = next(s for s in data['series'] if s['id'] == old['id'])
        periods = {p['key']: {r[0]: r for r in p['rows']} for p in series['periods']}
        for period in old['periods']:
            for row in period['rows']: assert periods[period['key']][row[0]] == row, (name, old['id'], period['key'], row[0])
        if old['id'] == '21010': assert series == old, 'Do not invent energy adequacy'
        elif name == 'fao-food-balances.json': assert series['periods'][0]['key'] == '1960'
    if name == 'fao-food-balances.json':
        for series in data['series']:
            row = next(r for r in series['periods'][-1]['rows'] if r[0] == '392')
            assert row[7]['source']['id'] == 'MAFF' and all(isinstance(n, (int, float)) for n in row[1:4]), (series['id'], row)
    else:
        dependency = next(s for s in data['series'] if s['id'] == '21035')
        for p in dependency['periods']:
            for row in p['rows']:
                if row[2] == 'MAFF_DERIVED':
                    a = row[5]['amounts']; production, imports, exports = [a[k] for k in ['production', 'imports', 'exports']]
                    assert abs(row[1] - 100 * (imports - exports) / (production + imports - exports)) < 1e-10
                    assert 'FAO公表' in row[4] and row[0] == '392'
    print('PASS preserved original FAO rows and labelled additions', name, flush=True)
report['status'] = 'passed'
target = ROOT / 'artifacts/map-history-20260912/data-report.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('PASS', report['oldPeriods'], 'unchanged old periods;', report['stationRecords'], 'station-year records')
