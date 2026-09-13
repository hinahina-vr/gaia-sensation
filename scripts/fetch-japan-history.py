"""Retain additional official annual observations, never replace existing sources.

Each family has its own manifest so independent downloads can be resumed safely.
Only annual files are requested (not the much larger hourly observations).
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/sources/japan-history'
AIR_API = 'https://tenbou.nies.go.jp/download/api/'
WATER_API = 'https://water-pub.env.go.jp/water-pub/mizu-site/zip_create/'


def request(url, payload=None, form=False):
    body = None if payload is None else (urllib.parse.urlencode(payload) if form else json.dumps(payload)).encode()
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, data=body, headers={
                'User-Agent': 'GAIA-SENSEWARE-annual-history/1.0',
                'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json; charset=utf-8'})
            with urllib.request.urlopen(req, timeout=45) as response:
                return response.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def retain(item):
    target = RAW / item['file']
    if target.exists():
        blob = target.read_bytes()
        if 'sha256' in item:
            assert hashlib.sha256(blob).hexdigest() == item['sha256'], item['file']
    else:
        time.sleep(.9)
        blob = request(item['url'], item.get('form') or item.get('query'), 'form' in item)
        if target.suffix == '.zip':
            with zipfile.ZipFile(io.BytesIO(blob)) as archive:
                assert archive.testzip() is None, item['file']
        assert len(blob) < 80_000_000, (item['file'], len(blob))
        with target.open('xb') as output:
            output.write(blob)
    if 'expectedBytes' in item:
        assert len(blob) == item['expectedBytes'], item['file']
    return dict(item, bytes=len(blob), sha256=hashlib.sha256(blob).hexdigest(),
        retrievedAt=item.get('retrievedAt') or datetime.now(timezone.utc).isoformat())


def save_manifest(family, manifest):
    path = RAW / f'{family}-manifest.json'
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def air():
    manifest = {'sources': [], 'queryYears': list(range(1970, 2019)), 'annualOnly': True}
    path = RAW / 'air-manifest.json'
    retained = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    previous = {s['file']: s for s in retained.get('sources', [])}
    jobs = []
    for kind in ['td', 'tm']:
        form = {'type': kind, 'prefs': '["00"]', 'years': json.dumps([str(y) for y in manifest['queryYears']]),
            'materials': '["01","02","03","04","05","06","07","08","09","10","12"]'}
        saved = retained.get(kind + 'Listing')
        listing = dict(status='', files=saved['files']) if saved and saved['form'] == form else json.loads(request(AIR_API + 'searchfile.php', form, True))
        assert listing['status'] == '' and listing['files'], listing.get('status')
        manifest[kind + 'Listing'] = {'url': AIR_API + 'searchfile.php', 'form': form, 'files': listing['files']}
        for item in listing['files']:
            assert re.fullmatch(r'(TD|TM)(19\d\d|20\d\d)\d{4}\.zip', item['name']), item
            jobs.append(previous.get(item['name']) or {'file': item['name'], 'url': AIR_API + 'archivedownload.php',
                'form': {'type': kind, 'file': item['name']}, 'expectedBytes': item['size']})
    print('Air annual downloads', len(jobs), 'bytes', sum(j.get('expectedBytes', 0) for j in jobs), flush=True)
    with ThreadPoolExecutor(max_workers=1) as pool:
        for index, result in enumerate(pool.map(retain, jobs)):
            manifest['sources'].append(result)
            save_manifest('air', manifest)
            if index % 20 == 0: print('Air', index + 1, '/', len(jobs), result['file'], flush=True)


def water():
    manifest = {'sources': [], 'unavailable': [], 'queryYears': list(range(1984, 2020))}
    path = RAW / 'water-manifest.json'
    previous = {s['file']: s for s in json.loads(path.read_text(encoding='utf-8'))['sources']} if path.exists() else {}
    for year in manifest['queryYears']:
        for group in ['y02', 'y03']:
            name = f'water-{group}-{year}.zip'
            query = {'featureClassName': f'p_kosui_{group}', 'whereClause': f'nendo={year}', 'extension': 'csv'}
            if name in previous:
                result = retain(previous[name])
            else:
                token = json.loads(request(WATER_API + 'WebService.asmx/StartCreation', query))['d']
                if token == 'RecordNotFound':
                    manifest['unavailable'].append({'year': year, 'query': query, 'response': token})
                    save_manifest('water', manifest)
                    continue
                assert token and token != 'BadRequest', token
                for attempt in range(60):
                    time.sleep(1.5)
                    state = json.loads(request(WATER_API + 'WebService.asmx/GetThreadStatus', {'resultFileName': token}))['d']
                    if state != 'Running': break
                assert state == 'Stopped', (year, group, state)
                result = retain({'file': name, 'url': WATER_API + 'download.aspx?id=' + token})
                result.update(exportUrl=WATER_API + 'WebService.asmx/StartCreation', query=query, year=year)
            manifest['sources'].append(result)
            save_manifest('water', manifest)
            print('Water', year, group, result['bytes'], flush=True)


def legacy_water():
    base = 'https://www.nies.go.jp/igreen/'
    manifest = {'sources': [], 'queryYears': list(range(1971, 1984)),
        'termsUrl': base + 'index_water.html',
        'note': 'Local historical extraction; old database republication terms require separate release review.'}
    path = RAW / 'legacy_water-manifest.json'
    previous = {s['file']: s for s in json.loads(path.read_text(encoding='utf-8'))['sources']} if path.exists() else {}
    jobs = []
    for year in manifest['queryYears']:
        for name, url in [(f'MD{year}0200_0.zip', f'md/{year}/sei/MD{year}0200_0.zip'),
                          (f'MM{year}0000.zip', f'mm/{year}/MM{year}0000.zip')]:
            jobs.append(previous.get(name) or {'file': name, 'url': base + url, 'year': year})
    # The modern MOE endpoint has no 1984 nutrient table; the original archive does.
    for name, url in [('MD19840300_0.zip', 'md/1984/np/MD19840300_0.zip'), ('MM19840000.zip', 'mm/1984/MM19840000.zip'),
                      ('MD_manu.pdf', 'manual/MD_manu.pdf'), ('MM_manu.pdf', 'manual/MM_manu.pdf')]:
        jobs.append(previous.get(name) or {'file': name, 'url': base + url})
    for job in jobs:
        result = retain(job)
        manifest['sources'].append(result)
        save_manifest('legacy_water', manifest)
        print('Legacy water', result['file'], result['bytes'], flush=True)


def prtr():
    base = 'https://www.nite.go.jp/chem/prtr/mapdata/'
    config = retain({'file': 'prtrdata.json', 'url': base + 'assets/config/prtrdata.json'})
    listing = json.loads((RAW / config['file']).read_text(encoding='utf-8'))
    manifest = {'sources': [config], 'sameYearCoordinatesOnly': True}
    path = RAW / 'prtr-manifest.json'
    previous = {s['file']: s for s in json.loads(path.read_text(encoding='utf-8'))['sources']} if path.exists() else {}
    for entry in listing:
        if entry['dataType'] != 'office' or entry['year'] >= 2022: continue
        year = entry['year']
        suffix = entry['data'][0]['zipPathNew']
        assert re.fullmatch(r'data/\d{4}/data_\d+/office/office_\d{4}\.zip', suffix), suffix
        era = f'H{year - 1988:02}' if year <= 2018 else f'R{year - 2018:02}'
        for name, url in [(f'office_{year}.zip', base + suffix),
                          (f'{era}PRTRdata.zip', f'https://www.env.go.jp/chemi/prtr/kaiji/data/{era}PRTRdata.zip')]:
            result = retain(previous.get(name) or {'file': name, 'url': url, 'year': year})
            manifest['sources'].append(result)
            save_manifest('prtr', manifest)
            print('PRTR', year, name, result['bytes'], flush=True)


def food_japan():
    manifest = {'sources': [], 'catalogUrl': 'https://www.e-stat.go.jp/stat-search/files?layout=datalist&lid=000001478566&page=1',
        'sourceName': '農林水産省 食料需給表 令和6年度 項目別累年表'}
    for index, key in enumerate(['production', 'imports', 'exports']):
        result = retain({'file': f'maff-{key}.csv', 'url': f'https://www.e-stat.go.jp/stat-search/file-download?fileKind=1&statInfId={40422798 + index:012}'})
        manifest['sources'].append(result)
        save_manifest('food_japan', manifest)
        print(key, result['bytes'], flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('family', choices=['air', 'water', 'legacy_water', 'prtr', 'food_japan'])
    args = parser.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    globals()[args.family]()
