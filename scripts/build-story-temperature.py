"""Build a local annual 2-degree GISTEMP subset; no spatial fabrication or forecast.

Input: NASA's original gzip NetCDF (CDF1/CDF2). Requires only numpy.
Usage: python scripts/build-story-temperature.py artifacts/.../gistemp....nc.gz
"""
import gzip
import hashlib
import json
import struct
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import numpy as np

source = Path(sys.argv[1])
raw = source.read_bytes()
buf = gzip.decompress(raw)
assert buf[:3] == b'CDF' and buf[3] in (1, 2), 'Expected classic NetCDF'
version = buf[3]
pos = 4

def uint():
    global pos
    value = struct.unpack_from('>I', buf, pos)[0]
    pos += 4
    return value

def string():
    global pos
    length = uint()
    value = buf[pos:pos + length].decode('ascii')
    pos += (length + 3) // 4 * 4
    return value

types = {1: ('>i1', 1), 2: ('S1', 1), 3: ('>i2', 2), 4: ('>i4', 4), 5: ('>f4', 4), 6: ('>f8', 8)}

def attrs():
    global pos
    tag, count = uint(), uint()
    assert tag in (0, 12)
    result = {}
    for _ in range(count):
        name, kind, length = string(), uint(), uint()
        dtype, size = types[kind]
        values = np.frombuffer(buf, dtype=dtype, count=length, offset=pos)
        result[name] = values.tobytes().decode('ascii') if kind == 2 else values.tolist()
        pos += (length * size + 3) // 4 * 4
    return result

records = uint()
assert uint() == 10
dims = [(string(), uint()) for _ in range(uint())]
global_attrs = attrs()
assert uint() == 11
variables = {}
for _ in range(uint()):
    name = string()
    dimids = [uint() for _ in range(uint())]
    metadata, kind, size = attrs(), uint(), uint()
    begin = uint()
    if version == 2:
        begin = (begin << 32) + uint()
    variables[name] = {'dims': dimids, 'attrs': metadata, 'type': kind, 'size': size, 'begin': begin}

record_size = sum(v['size'] for v in variables.values() if v['dims'] and dims[v['dims'][0]][1] == 0)

def array(name):
    v = variables[name]
    shape = [dims[i][1] or records for i in v['dims']]
    dtype, itemsize = types[v['type']]
    strides = [itemsize * int(np.prod(shape[i+1:])) for i in range(len(shape))]
    if v['dims'] and dims[v['dims'][0]][1] == 0:
        strides[0] = record_size
    a = np.ndarray(shape, dtype=dtype, buffer=buf, offset=v['begin'], strides=strides).astype(float)
    for key in ('_FillValue', 'missing_value'):
        if key in v['attrs']:
            a[a == v['attrs'][key][0]] = np.nan
    return a * v['attrs'].get('scale_factor', [1])[0] + v['attrs'].get('add_offset', [0])[0]

if '--inspect' in sys.argv:
    print(json.dumps({'dims': dims, 'records': records, 'attrs': global_attrs, 'vars': variables}, indent=2))
    sys.exit()

assert [dims[i][0] for i in variables['tempanomaly']['dims']] == ['time', 'lat', 'lon']
assert variables['tempanomaly']['attrs']['units'] == 'K'  # A kelvin difference equals a Celsius difference.
assert 'Base: 1951-1980' in global_attrs['history']
assert np.allclose(array('lat'), np.arange(-89, 90, 2))
assert np.allclose(array('lon'), np.arange(-179, 180, 2))
assert variables['time']['attrs']['units'].startswith('days since ')
epoch = datetime.fromisoformat(variables['time']['attrs']['units'][11:].strip())
dates = [epoch + timedelta(days=float(d)) for d in array('time')]
monthly = array('tempanomaly')
frames, encoded = [], []
for year in range(1958, 2026):
    indices = [i for i, d in enumerate(dates) if d.year == year]
    assert len(indices) == 12 and sorted(dates[i].month for i in indices) == list(range(1, 13)), year
    months = monthly[indices]
    complete = np.isfinite(months).all(axis=0)
    mean = np.mean(months, axis=0)
    values = np.full((90, 180), 32767, dtype='<i2')
    values[complete] = np.rint(mean[complete] * 100).astype('<i2')
    assert np.all(np.abs(mean[complete]) < 20)
    # Source latitudes run south -> north. Display binary runs north -> south.
    encoded.append(values[::-1].tobytes())
    weights = np.cos(np.deg2rad(array('lat')))[:, None] * np.ones((1, 180))
    frames.append({'year': year, 'validCells': int(complete.sum()),
                   'areaMeanC': round(float(np.sum(mean[complete] * weights[complete]) / weights[complete].sum()), 3)})

root = Path(__file__).resolve().parents[1]
binary = b''.join(encoded)
(root / 'data/story-temperature-annual.bin').write_bytes(binary)
metadata = {
    'schemaVersion': 1, 'dataset': 'GISTEMP v4 Land-Ocean Temperature Index, ERSSTv5, 1200 km smoothing',
    'provider': 'NASA GISS', 'sourceUrl': 'https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz',
    'documentationUrl': 'https://data.giss.nasa.gov/gistemp/',
    'citation': 'GISTEMP Team, 2026; Lenssen et al. (2024), doi:10.1029/2023JD040179',
    'retrievedAt': datetime.fromtimestamp(source.stat().st_mtime, timezone.utc).isoformat(),
    'sourceSha256': hashlib.sha256(raw).hexdigest(), 'binarySha256': hashlib.sha256(binary).hexdigest(),
    'baseline': '1951–1980', 'unit': '°C', 'width': 180, 'height': 90, 'resolutionDegrees': 2,
    'storage': 'little-endian int16; °C × 100; north-to-south, west-to-east', 'missing': 32767,
    'binary': 'story-temperature-annual.bin',
    'method': 'Annual arithmetic mean only where all 12 monthly grid values are valid; round to 0.01 °C. No additional spatial interpolation, no future projection.',
    'caveat': 'Regional gridded estimates with NASA 1200 km smoothing, not point thermometer readings. Missing cells remain missing. Area-weighted grid mean is not the official GISTEMP global index.',
    'frames': frames,
}
(root / 'data/story-temperature-annual.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(f'{len(frames)} annual frames, {len(binary):,} bytes; first/last: {frames[0]}, {frames[-1]}')
