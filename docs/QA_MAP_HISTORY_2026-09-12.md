# MAP 31–71: history extension — local verification

## Request and result

User: 「31-71ってなんで4年分ぐらいしかデータないの　30ばりに1955年ぐらいからほしいんだけど　追加してくれる」

The short ranges largely came from import-time year filters. Those restrictions
were expanded and older public sources added, preserving all existing observations.
1955 is used where actual records support it; later-starting indicators, missing
years and unmatched GIS records are not fabricated. MAP 71 already had longer
FAO three-year-average history than the other annual exhibits.

| MAP | Included periods | Important limitation |
| --- | --- | --- |
| 31 coastal COD | 1971–2024 | Same-year public water records |
| 32, 34, 36 pH | 1978–2024 | Minimum pH, not annual mean |
| 33, 35, 37 DO | 1976–2024 | Reported annual mean |
| 38–42 weather | 1955–2024 | 38 retained JMA stations |
| 43 solar radiation | 1961–2024 | Not available from 1955 |
| 44–48 SO2/NO/NO2/NOx/CO | 1971–2023 | Same-year monitoring-station GIS |
| 49 OX | 1985–2023 | Existing daytime mean definition retained |
| 50 NMHC | 1975–2023 | No earlier metric substitution |
| 51 CH4 | 1976–2023 | Same definition |
| 52 THC | 1971–2023 | Same definition |
| 53 SPM | 1974–2023 | Same definition |
| 54 PM2.5 | 2010–2023 | Later-starting observation series |
| 55 river BOD, 57 lake COD | 1971–2024 | Censored observations remain null |
| 56 river COD | 1971–1977, 2009–2024 | 1978–2008 gap is not filled |
| 58 SS | 1977–2024 | Actual available values |
| 59 total N, 60 total P | 1984–2024 | Actual available values |
| 61 hexane extract | 1978–2024 | Includes years with only censored records |
| 62 zinc | 2007–2024 | Later-starting metric |
| 63 LAS | 2013–2024 | Later-starting metric |
| 64 nonylphenol | 2012–2024 | Later-starting metric |
| 65–67 PRTR | 2018–2022 | Same-year coordinates located in retrieved GIS catalogue; not all years since programme start |
| 68 benthos | 1996–2023 | District GIS matched records only |
| 69 fish | 1994–2023 except 1996 | District GIS matched records only |
| 70 food, 9 groups | 1960–2023 | 1960 Japan only; FAO global history from 1961 |
| 71 cereal dependency | 1960–1962 through 2021–2023 | Added early periods are Japan-only MAFF-derived references |
| 71 energy adequacy | 2000–2002 through 2023–2025 | Original FAO series unchanged; Japan remains unavailable |

The latest year has not been advanced by this historical-extension request.
This is the history verified from the sources retrieved, not a claim to have
exhausted all archives or restored all observations since each programme began.

## Changes and provenance

- Annual manifests, gzip year files and station-history shards: 3,353,814
  station-year records, 4,055 compressed parts (148,317,563 bytes).
- All 181 original annual periods retain their observations. Biology taxon-code
  tie ordering is canonicalized only for comparison; names/codes/counts are unchanged.
  All original FAO rows are preserved, including its entire energy-adequacy series.
- UI years derive from real manifest periods; gaps are skipped by keyboard and
  automatic year advance. Async loads cannot replace a newer year/exhibit. A failed
  year load keeps the old year/value labelled and supports retry.
- Long analysis retains all 70 weather points while using at most eight integer
  year ticks. Map station history uses a scrollable grid instead of 70 crushed cells.
- Annual saved analyses now reload from a fresh page without changing the current
  map. PRTR restoration uses the selected year's dictionary and quantities; old
  yearless PRTR saved IDs still mean 2022.
- Japan food references carry separate source and fiscal-year labels. FAO FBSH/FBS
  method changes are explicit; a mixed-source series is not summarized as one
  comparable endpoint change. Rice conversion and MAFF-derived cereal dependency
  are documented in data and UI. No energy-adequacy value was invented.
- Final screenshot inspection found a one-frame stale food source label after a
  period change. `browser/source-status-before.json` reproduces it; the source
  status now updates in the same render as the value. The final food-only matrix
  (`browser/food-final.json`) and food interaction test recheck this correction.
- Source definitions were checked against public primary material; the spreadsheet
  and PDF workflows informed source parsing and format verification.

## Verification and evidence

Target: local uncommitted candidate based on `db63742`, not a published version.
Exact input hashes and test report hashes are in
`artifacts/map-history-20260912/version.json` when generated after all checks pass.

Passed checks (retained reports under `artifacts/map-history-20260912/`):

- `python scripts/check-map-history-data.py`: all annual part hashes, schema,
  IDs, coordinates, quality flags, unchanged old observations, FAO preservation
  and MAFF formula checks (`data-report.json`).
- `node scripts/check-map-history-browser.mjs`: actual local Chrome at
  1440×900 and 390×844; all MAP 31–71 earliest/middle/latest periods, all food
  groups, map point counts, displayed values, selected-station analysis rows,
  PRTR year-specific detail, real slider/keyboard operations and no overflow.
- `node scripts/check-map-history-analysis-browser.mjs --before`: reproduced
  fresh-page annual saved-view failure (`analysis/before.json`). After correction,
  the same test without `--before` passes desktop/mobile; 70 actual graph points,
  eight integer year labels, Home/End tooltips, saved filters and fresh-page reload.
- `node scripts/check-map-history-edge-browser.mjs`: delayed automatic advance,
  stale-load guards, failed-year retry, real unnamed 1992 station, censored-only
  year, and independent restoration of PRTR 2018 quantities/dictionary.
- `node scripts/check-fao-food-browser.mjs` at 1440×900 and 390×844: actual
  source panels, graph, filters/save/restore, map hits and measured-value animation.
- `node scripts/check-japan-sensor-open.mjs`, `check-japan-pollution.mjs`,
  `check-prtr-biology.mjs`, `check-fao-food.mjs`, `check-statistics-lab.mjs`,
  `check-statistics-discovery.mjs`: dataset and statistics regressions.
- `python scripts/build-japan-marine-cod.py --check`,
  `build-japan-sensor-open-data.py --check`, `build-japan-pollution-data.py --check`:
  offline original-source rebuild comparisons against the expanded output.
- `python scripts/check-annual-snapshot.py`: isolated gzip publication/rebuild,
  older-year preservation, and changed-source mismatch detection.

Browser evidence uses the repository's production CSP and actual same-origin
files. External HTTPS services are blocked. Deliberate latency/network-failure
injection in the edge test is simulated and is not production/network evidence.
Visual checks include desktop/mobile history maps, Japan source labels and the
actual 70-year mobile graph. Evidence screenshots are in `browser/`, `analysis/`
and `food/` below the artifact directory.

## Boundaries and release status

- At the initial implementation report: local only, no commit, push, deployment,
  or production smoke. The subsequent commit request is recorded below.
  Earlier unrelated uncommitted work is preserved.
- No ZIP is delivered. Source archives remain intact; only verified redundant
  uncompressed generated annual intermediates were removed. They are recoverable
  byte-for-byte from sibling gzip files.
- The statistics UI intentionally has no CSV/JSON/PNG export; no new export
  feature was added. Browser-local saved-view storage and reload were exercised.
- Physical phones, Safari/Firefox, live APIs and deployed asset serving were not
  verified. A future authorized release needs its own deployment smoke.
- NIES legacy-water redistribution wording must be reviewed before public release.
  Do not treat local extraction or public download access as publication permission.
- Source details and reproduction steps: `data/sources/japan-history/README.md`.

## Subsequent commit request (2026-09-12)

User: 「コミット」. Scope: the MAP 31–71 history extension and its related
source import, display, analysis, tests and documentation only. Earlier SOUND,
story/layout, shared MAP-dock/live-timeline and OP-candidate changes remain local
and unstaged. `package.json` includes only the two history test commands in this
commit; other pending command changes are not included. No push/deployment is
authorized or performed by this request.

The initial 4,242-file evidence fingerprint was matched before staging. Raw CSV
and NITE configuration responses retain their original bytes; their Git whitespace
checking is disabled rather than rewriting source CRLF or source whitespace.
All 4,143 fully staged paths match their working files under Git's attributes;
`package.json` was separately checked against HEAD plus exactly the two additions.

Independent commit-candidate verification served only Git-index blobs from tree
`67eebad3abd4ca96afd8b21b58c804c1abd33553` at `127.0.0.1:4493`, with no fallback
to unstaged or untracked runtime files. Browser test scripts gained optional
`GAIA_BASE_URL` / `GAIA_OUTPUT_DIR` overrides to keep this evidence separate.
Results under `artifacts/map-history-20260912/commit-candidate/`:

- `browser/report.json`: 300 checks passed, all MAP 31–71 at 1440×900 and 390×844.
- `analysis/after.json`: desktop/mobile 70-point chart and fresh-page saved-view
  restoration passed; the mobile screenshot was visually inspected.
- `edge/report.json`: all seven latency/failure, missing-data, PRTR-year and
  mobile-history-grid cases passed.

After that verification, only this documentation was updated in the staged tree.
The final staged diff passes whitespace checking. The commit remains local;
the public-source redistribution review and other release limitations above remain.
