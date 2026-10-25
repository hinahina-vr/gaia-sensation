"""Build exhibit 74 from original JRC GSW v1.0 annual classifications.

Install rasterio/numpy/Pillow on E; this script never installs dependencies.
Only bounded windows are downloaded via HTTP range requests. Raw window caches
remain in ignored artifacts/, not in the shipped data. No RGB tile analysis.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS', '.tif')
os.environ.setdefault('GDAL_HTTP_TIMEOUT', '30')
os.environ.setdefault('GDAL_HTTP_MAX_RETRY', '2')
os.environ.setdefault('GDAL_CACHEMAX', '64')
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/surface-water-source-cache'
OUT = ROOT / 'data/surface-water'
BASE = 'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GSWE/YearlyClassification/VER1-0/tiles'
YEARS = list(range(1984, 2016))
LAKES = [
    dict(id='urmia', name='ウルミエ湖', country='イラン', lon=45.47, lat=37.7,
         bounds=[44.95, 37.0, 46.0, 38.4], tile=[160000, 880000]),
    dict(id='great-salt', name='グレートソルト湖', country='アメリカ', lon=-112.5, lat=41.2,
         bounds=[-113.1, 40.55, -111.8, 41.8], tile=[120000, 240000]),
    dict(id='poopo', name='ポオポ湖', country='ボリビア', lon=-67.0, lat=-18.6,
         bounds=[-67.35, -19.15, -66.65, -18.25], tile=[360000, 440000]),
]


def pixel_areas(bounds, shape):
    """WGS84 ellipsoid area of each latitude row, per pixel, in km²."""
    west, south, east, north = bounds
    h, w = shape
    e2 = 6.6943799901413165e-3
    e = math.sqrt(e2)
    u = np.sin(np.deg2rad(np.linspace(north, south, h + 1)))
    primitive = 6378137.0 ** 2 * (1 - e2) / 2 * (u / (1 - e2 * u * u) + np.arctanh(e * u) / e)
    return (primitive[:-1] - primitive[1:]) * math.radians((east - west) / w) / 1e6


def acquire(task):
    lake, year = task
    path = CACHE / f'{lake["id"]}-{year}.npz'
    if path.exists():
        return
    row, col = lake['tile']
    url = f'{BASE}/yearlyClassification{year}/yearlyClassification{year}-{row:010d}-{col:010d}.tif'
    for attempt in range(3):
        try:
            # A fresh URL avoids reusing a failed HTTP range from GDAL's cache.
            with rasterio.open(url if attempt == 0 else f'{url}?retry={attempt}') as source:
                if source.crs.to_epsg() != 4326 or source.count != 1:
                    raise ValueError(f'Unexpected raster CRS/bands: {url}')
                window = from_bounds(*lake['bounds'], source.transform).round_offsets().round_lengths()
                values = source.read(1, window=window)
                bounds = rasterio.windows.bounds(window, source.transform)
            break
        except rasterio.errors.RasterioIOError:
            if attempt == 2:
                raise
    if not set(np.unique(values)).issubset({0, 1, 2, 3}):
        raise ValueError(f'Unknown water classes: {url}')
    np.savez_compressed(path, values=values, bounds=bounds, url=url)
    print(f'{lake["id"]} {year}: original classification window cached', flush=True)


def build_lake(lake):
    footprint = None
    records = []
    for year in YEARS:
        with np.load(CACHE / f'{lake["id"]}-{year}.npz') as raw:
            water = raw['values'] >= 2
            footprint = water if footprint is None else footprint | water
    reference_year = 2000
    with np.load(CACHE / f'{lake["id"]}-{reference_year}.npz') as raw:
        reference = raw['values']
        bounds = raw['bounds'].tolist()
    weights = pixel_areas(bounds, reference.shape)
    area = lambda mask: float(np.dot(mask.sum(axis=1, dtype=np.int64), weights))
    footprint_area = area(footprint)
    palette = np.array([[27, 42, 52], [12, 29, 39], [138, 217, 202], [63, 176, 218]], dtype=np.uint8)
    image_dir = OUT / lake['id']
    image_dir.mkdir(parents=True, exist_ok=True)
    for year in YEARS:
        with np.load(CACHE / f'{lake["id"]}-{year}.npz') as raw:
            a = raw['values']
            if a.shape != reference.shape or not np.allclose(raw['bounds'], bounds, rtol=0, atol=1e-8):
                raise ValueError('Mismatched yearly grids')
            water = a >= 2
            valid = (a > 0) & footprint
            common = valid & (reference > 0)
            prior = area((reference >= 2) & common)
            current = area(water & common)
            coverage = area(valid) / footprint_area * 100
            common_coverage = area(common) / footprint_area * 100
            # No comparisons based on a small, changing observed footprint.
            delta = (current / prior - 1) * 100 if prior > 0 and common_coverage >= 95 else None
            width = 480
            # Equirectangular local map corrected at its middle latitude.
            aspect = (bounds[2] - bounds[0]) * math.cos(math.radians((bounds[1] + bounds[3]) / 2)) / (bounds[3] - bounds[1])
            height = round(width / aspect)
            indexed = Image.fromarray(a).resize((width, height), Image.Resampling.NEAREST)
            image = Image.fromarray(palette[np.asarray(indexed)])
            image_path = image_dir / f'{year}.png'
            image.save(image_path, optimize=True)
            png = image_path.read_bytes()
            records.append(dict(year=year, permanent=area(a == 3), seasonal=area(a == 2),
                water=area(water), coverage=coverage, commonCoverage=common_coverage,
                referenceCommonWater=prior, commonWater=current, changePercent=delta,
                image=f'{lake["id"]}/{year}.png', imageSha256=hashlib.sha256(png).hexdigest(), imageBytes=len(png),
                sourceUrl=str(raw['url']), windowSha256=hashlib.sha256(a.tobytes()).hexdigest(),
                shape=list(a.shape)))
    return {k: v for k, v in lake.items() if k != 'tile'} | dict(bounds=bounds, footprintArea=footprint_area,
        referenceYear=reference_year, years=records)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    if not args.offline:
        with ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(acquire, ((lake, year) for lake in LAKES for year in YEARS)))
    regions = [build_lake(lake) for lake in LAKES]
    result = dict(schemaVersion=1, dataset='JRC Global Surface Water v1.0 Yearly Classification',
        period=[1984, 2015], builtAt='2026-10-22', attribution='Source: EC JRC/Google',
        sourceUrl='https://global-surface-water.appspot.com/download',
        citation='Pekel et al. (2016), Nature 540, 418–422. doi:10.1038/nature20584',
        license='Copernicus: free of charge, without restriction of use; acknowledgement required.',
        method='Native annual classification: 0 no data, 1 non-water, 2 seasonal, 3 permanent. Fixed rectangular AOIs; not official lake boundaries. WGS84 ellipsoidal pixel-area sums at original 0.00025° spacing. Coverage denominator is the union of water-classified pixels across 1984–2015. Changes vs 2000 use only pixels observed in both years, requiring ≥95% coverage of that union. Display images use nearest-neighbour downsampling only; areas use original pixels.',
        limits='Original v1.0 period only, not the latest 1984–2024 series. Annual classification combines observations across a year, not a single-date shoreline or annual average area. No interpolation of missing observations. Adjacent surface water inside each fixed AOI is included. Observation timing, classification and shoreline pixel uncertainty remain; water level, volume and causes are not inferred.',
        regions=regions)
    (OUT / 'lakes.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps({r['id']: {'years': len(r['years']), 'coverageRange': [min(y['coverage'] for y in r['years']), max(y['coverage'] for y in r['years'])], 'water2015': r['years'][-1]['water']} for r in regions}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
