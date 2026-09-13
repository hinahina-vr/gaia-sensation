"""Versioned annual payloads + small station-history shards for the map.

Builders keep full same-year source records. The map loads one year and one
history shard, never decades of nationwide station records to show one point.
"""
import hashlib
import gzip
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'


def write_atomic(path, blob):
    # Windows preview/indexing can briefly hold an existing manifest open.
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_bytes(blob)
    for attempt in range(8):
        try:
            temporary.replace(path)
            return
        except OSError:
            if attempt == 7: raise
            time.sleep(.2 * (attempt + 1))


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')


def read_snapshot(name):
    result = json.loads((DATA / name).read_text(encoding='utf-8'))
    if result['schemaVersion'] == 2:
        result['periods'] = [read_part(p['file']) for p in result['periods']]
    return result


def read_part(file):
    blob = (DATA / file).read_bytes()
    return json.loads(gzip.decompress(blob) if file.endswith('.gz') else blob)


def publish_snapshot(name, result, check=False):
    """Rebuild source years without discarding previously imported history."""
    existing = read_snapshot(name) if (DATA / name).exists() else None
    if check:
        assert existing is not None, name
        periods = {p['year']: p for p in existing['periods']}
        for expected in result['periods']:
            actual = periods[expected['year']]
            for key, value in expected.items():
                assert actual.get(key) == value, (name, expected['year'], key)
        return
    if existing and existing.get('schemaVersion') == 2:
        replacements = {p['year']: p for p in result['periods']}
        retained = [p for p in existing['periods'] if p['year'] not in replacements]
        result = {**existing, **result, 'periods': retained + result['periods']}
    write_snapshot(name, result)


def save_part(file, value):
    blob = gzip.compress(encoded(value), compresslevel=6, mtime=0)
    target = file.as_posix() + '.gz'
    (DATA / target).write_bytes(blob)
    return {'file': target, 'sha256': hashlib.sha256(blob).hexdigest()}


def shard_id(ident):
    return sum(ident.encode('utf-8')) % 64


def write_snapshot(name, result):
    folder = Path('annual') / Path(name).stem
    (DATA / folder).mkdir(parents=True, exist_ok=True)
    metadata, shards = [], [{} for _ in range(64)]
    for period in sorted(result['periods'], key=lambda p: p['year']):
        points = period['stations']
        assert len(points) == len({p['id'] for p in points}), (name, period['year'])
        blob = encoded(period)
        assert len(blob) < 25 * 1024 * 1024, (name, period['year'], len(blob))
        part = save_part(folder / f"{period['year']}.json", period)
        metadata.append({**{k: v for k, v in period.items() if k != 'stations'},
            'stationCount': len(points), **part})
        for point in points:
            # Detailed taxa/substance lists stay in the annual record, not history.
            keep = {k: v for k, v in point.items() if k in ['id', 'name', 'water', 'prefCode', 'lon', 'lat', 'sourceUrl', 'measurement', 'secondary', 'metrics', 'cod', 'cod75']}
            shards[shard_id(point['id'])].setdefault(point['id'], {})[str(period['year'])] = keep
    files = []
    for index, shard in enumerate(shards):
        file = folder / f'history-{index}.json'
        blob = encoded(shard)
        assert len(blob) < 25 * 1024 * 1024
        files.append(save_part(file, shard))
    result.update(schemaVersion=2, periods=metadata, historyShards=files)
    write_atomic(DATA / name, encoded(result))
    print(name, metadata[0]['year'], metadata[-1]['year'], len(metadata), sum(p['stationCount'] for p in metadata), flush=True)


def compress_existing():
    for path in sorted(DATA.glob('japan-*.json')):
        result = json.loads(path.read_text(encoding='utf-8'))
        if result.get('schemaVersion') != 2: continue
        for part in result['periods'] + result['historyShards']:
            if part['file'].endswith('.gz'): continue
            original = DATA / part['file']
            assert hashlib.sha256(original.read_bytes()).hexdigest() == part['sha256']
            compressed = save_part(Path(part['file']), read_part(part['file']))
            assert gzip.decompress((DATA / compressed['file']).read_bytes()) == original.read_bytes()
            part.update(compressed)
        write_atomic(path, encoded(result))
        print('Compressed', path.name, flush=True)


if __name__ == '__main__': compress_existing()
