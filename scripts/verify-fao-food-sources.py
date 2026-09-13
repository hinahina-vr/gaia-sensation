"""Independent cell-for-cell check of derived JSON against immutable bulk CSVs."""
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
checks = []
for name in ['balances', 'security']:
    data = json.loads((root / f'data/fao-food-{name}.json').read_text(encoding='utf8'))
    source = root / 'artifacts/fao-food-sources-2026-09-09' / data['source']['file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == data['source']['sha256']
    extracted, originals = {}, {}
    for s in data['series']:
        for p in s['periods']:
            for row in p['rows']:
                if name == 'balances':
                    for i, code in enumerate(['5511', '5611', '5911']):
                        if row[i + 4]:
                            extracted[(s['id'], p['key'], row[0], code)] = (row[i + 1], row[i + 4])
                else:
                    extracted[(s['id'], p['key'], row[0], '6121')] = (row[1], row[2])
    wanted = {s['id'] for s in data['series']}
    with zipfile.ZipFile(source) as z:
        reader = csv.DictReader(io.TextIOWrapper(z.open(next(n for n in z.namelist() if '(Normalized)' in n)), encoding='utf-8-sig'))
        for row in reader:
            if row['Item Code'] not in wanted or int(row['Area Code']) >= 5000:
                continue
            if name == 'balances' and (row['Element Code'] not in ['5511', '5611', '5911'] or not 2010 <= int(row['Year']) <= 2023):
                continue
            assert row['Unit'] == ('1000 t' if name == 'balances' else '%')
            key = (row['Item Code'], row['Year'], row['Area Code (M49)'].strip("'").zfill(3), row['Element Code'])
            assert key not in originals
            try:
                value = float(row['Value'])
            except ValueError:
                value = None
            originals[key] = (value, row['Flag'])
    assert originals == extracted, (name, len(originals), len(extracted))
    checks.append(dict(dataset=name, matchedSourceCells=len(originals), sourceSha256=data['source']['sha256'], dataSha256=hashlib.sha256((root / f'data/fao-food-{name}.json').read_bytes()).hexdigest()))
    print(name, 'PASS', len(originals), 'source cells, units, countries, periods and flags')
output = root / 'artifacts/fao-food-2026-09-09/source-verification.json'
output.parent.mkdir(exist_ok=True, parents=True)
output.write_text(json.dumps(dict(status='passed', checks=checks), indent=2), encoding='utf8')
