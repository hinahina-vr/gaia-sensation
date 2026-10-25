"""Audit shipped lake records and images against the cached native JRC windows."""
import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location('builder', ROOT / 'scripts/build-surface-water.py')
builder = module_from_spec(spec)
spec.loader.exec_module(builder)
data = json.loads((ROOT / 'data/surface-water/lakes.json').read_text(encoding='utf-8'))
planet_area = builder.pixel_areas([-180, -90, 180, 90], (180, 360)).sum() * 360
assert abs(planet_area - 510065621.724) < 0.01, planet_area
checks = []
for region in data['regions']:
    union = None
    for row in region['years']:
        with np.load(builder.CACHE / f'{region["id"]}-{row["year"]}.npz') as cached:
            a = cached['values']
            assert hashlib.sha256(a.tobytes()).hexdigest() == row['windowSha256']
            assert np.allclose(cached['bounds'], region['bounds'], atol=1e-10, rtol=0)
            assert a.shape == tuple(row['shape'])
            mask = a >= 2
            union = mask if union is None else union | mask
            weights = builder.pixel_areas(region['bounds'], a.shape)
            # Compute independently by row nonzero counts, not rendered colors.
            area = sum(int(np.count_nonzero(values >= 2)) * weight for values, weight in zip(a, weights))
            assert math.isclose(area, row['water'], abs_tol=1e-7)
            png = Image.open(ROOT / 'data/surface-water' / row['image'])
            sample = np.asarray(Image.fromarray(a).resize(png.size, Image.Resampling.NEAREST))
            palette = np.array([[27,42,52],[12,29,39],[138,217,202],[63,176,218]], dtype=np.uint8)
            assert np.array_equal(np.asarray(png), palette[sample])
    union_area = float(np.dot(union.sum(axis=1), weights))
    assert math.isclose(union_area, region['footprintArea'], abs_tol=1e-7)
    for row in region['years']:
        with np.load(builder.CACHE / f'{region["id"]}-{row["year"]}.npz') as cached:
            valid = (cached['values'] > 0) & union
            coverage = float(np.dot(valid.sum(axis=1), weights)) / union_area * 100
            assert math.isclose(coverage, row['coverage'], abs_tol=1e-9)
    checks.append(dict(id=region['id'], nativeWindows=32, imagePixelsVerified=True, missingCoverageVerified=True))
report = dict(status='passed', source='Cached original JRC v1.0 classification windows, not RGB tiles', checks=checks)
output = ROOT / 'artifacts/surface-water-20261022'
output.mkdir(parents=True, exist_ok=True)
(output / 'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
