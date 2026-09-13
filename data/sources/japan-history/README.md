# MAP 31–71 historical source additions (2026-09-12)

Public source responses are retained locally, with URL, request parameters,
retrieval time, byte count and SHA-256 in each `*-manifest.json`. Raw ZIP/PDF
downloads are ignored by Git; the three MAFF CSVs and source manifests are kept.
Existing recent-source directories and their original responses are unchanged.

## Sources and limitations

- JMA: retained annual tables in `../japan-sensor-open/`; 38 stations, 1955–2024.
  Solar radiation has usable records from 1961. Positions are acquisition-time
  station positions, not a reconstruction of historical relocations.
- MOE annual water files: `water-manifest.json`, 1984–2019 requests to the
  [official annual export](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp).
  Empty periods/metrics are not fabricated.
- NIES legacy water: `legacy_water-manifest.json`, 1971–1983 annual values and
  matching same-year station lists; 1984 nutrient file and format manuals.
  [Source and terms](https://www.nies.go.jp/igreen/index_water.html).
  The source's republication restriction needs review before any public release.
  This addition is local only; no republication approval is implied.
- NIES air: `air-manifest.json`, requested 1970–2018 annual TD/TM files from the
  [official download service](https://tenbou.nies.go.jp/download/).
  Actual metric start years differ. OX uses the existing daytime mean definition;
  earlier different statistics are not substituted. No hourly files were fetched.
- PRTR: `prtr-manifest.json` and retained `prtrdata.json` from
  [NITE's map](https://www.nite.go.jp/chem/prtr/mapdata/), plus same-year
  [MOE individual reports](https://www.env.go.jp/chemi/prtr/kaiji/index.html).
  The retrieved GIS catalogue supports 2018–2022 for this extension. This is not
  the start of the PRTR reporting system. IDs are matched only within a year.
- River biology: existing raw `artifacts/prtr-biology-sources/` archives from
  [MLIT/NILIM](https://www.nilim.go.jp/lab/fbg/ksnkankyo/), now extracting historical
  survey records with matching district GIS. Earliest included fish: 1994;
  benthos: 1996. Not the complete history of the survey programme.
- Food: retained FAO FBSH archive in `artifacts/fao-food-sources-2026-09-09/`
  extends the existing FBS dataset. Legacy rice “Milled Equivalent” item 2805 is
  explicitly labelled when mapped to 2807. Old/new FAO methods are distinct.
- Japan food: `food_japan-manifest.json` and `maff-{production,imports,exports}.csv`
  from [MAFF food balance sheets](https://www.maff.go.jp/j/tokei/kouhyou/zyukyu/gaiyou/)
  via [e-Stat's table catalogue](https://www.e-stat.go.jp/stat-search/files?layout=datalist&lid=000001478566&page=1).
  These fiscal-year reference quantities (including brown-rice equivalence)
  are not FAO observations or exactly comparable to international calendar-year
  quantities. Missing cells are not converted to zero. The cereal dependency
  reference sums P/M/X over three fiscal years before calculation; it is not an
  asserted reproduction of FAO's three-year average. Energy adequacy is not filled.

## Reproduction

Python 3.13 is used locally (`lxml` and Windows `tar.exe` also needed for biology).
The historical extension starts from the existing recent snapshots and retained
source archives. Use a separate checkout/output copy when reproducing a release.
Do not delete existing sources or replace their recorded hashes with a new fetch.

1. Fetch missing historical sources with `python scripts/fetch-japan-history.py`
   followed by one of `water`, `legacy_water`, `air`, `prtr`, `food_japan`.
   Cached responses are hash-checked. Water export URLs are ephemeral; the saved
   `exportUrl` and `query` are needed to recreate an expired response. Original
   downloads may change upstream, so a fresh fetch is not a byte-identical archive.
2. `python scripts/build-japan-sensor-open-data.py --weather-only`
3. `python scripts/build-prtr-biology-data.py --biology-only`
4. Run `python scripts/build-japan-history-data.py water`, then `air`, then `prtr`.
   `pack` is available to convert pre-existing weather/biology schema-1 output.
5. `python scripts/build-food-history-data.py`
6. `python scripts/build-annual-observation-index.py`
7. `python scripts/check-map-history-data.py`, plus the browser and unit checks
   listed in `docs/QA_MAP_HISTORY_2026-09-12.md`.

The original recent-year water/air builders now compare source-year records with
`--check`; rebuilding replaces those years while preserving older history.
The older `build-fao-food-data.py` is a **baseline-only** extractor: if intentionally
run, immediately rerun `build-food-history-data.py` before using its output.

## Delivery format

`data/japan-*.json` schema 2 is a small manifest. `data/annual/<dataset>/` contains
gzip annual records and 64 stable station-ID history shards. All files must remain
together. SHA-256 values version the requests. The browser loads the selected
year and selected station's shard, with bounded caches; it does not download the
entire national history on exhibit entry. Serving a decompressed gzip response
is also supported. Real Chrome was tested; other browser engines were not.

Historical ambiguous station IDs/coordinates are excluded and audited, not
resolved by invented locations. Source rows without a stable station key use
year-specific IDs. Source-year and survey-ID text may differ; the source's actual
survey-year field determines the year. No missing-year interpolation is used.
