# Population map typography and palette polish

## Scope / version

Local response to the screenshot of India's `8.1億` population circle. Base commit: `b236255db4dc60f748aecfe4327d45d39f8ad33b`, plus the preserved existing worktree changes and this UI update. Runtime cache revision: `population-style-1`. No commit, push, deployment or distribution package was produced.

Final implementation hashes are recorded in `artifacts/population-style/after/report.json`:

- `app.js`: `2405d8bbf559d3747af44722ed826a4d770ff03e91e23d403c5f3f020bdaeed6`
- `app-content.js`: `06cdbdc10f9d75880ec36031a3dc4fe9209af990200a026ea0dd7c26dfa5faa3`
- `map-ui-grid-polish.css`: `d270bb3bc204fc3eec6c6e019c471ac58ed0bd3fd8685824d6ed6505cba8d8fb`

## Visual changes

- Replaced amber radial highlights and selected-circle bloom with low-opacity blue-gray surfaces, thin cool outlines and a pale celadon selected outline. Circle centers are quieter, smaller dots.
- Changed only the in-circle population numbers to a clean system sans-serif. The number and Japanese unit use different sizes and colors, share a baseline, and are measured together for centering. Numeric labels draw after the circles, with a narrow dark outline rather than a glowing shadow, so nearby rings do not paint over the text.
- Preserved the 80% horizontal observation/hover cards, other MAP typography, original population rounding, circle-area formula, coordinates, source records and interactions. The separate abstract Population Tide shader and its palette were not changed.
- Updated MAP accent and quantitative legend colors, explanatory color names, and legend marks to agree with the new circles. The legend no longer uses the unrelated rainbow swatch for population area.
- Updated runtime cache keys. Added `check:population-style:browser` and adapted the existing global population test to inspect the actual flat-filled arcs instead of depending on the removed radial gradient.

## Verified

Actual local Chrome rendering at `http://127.0.0.1:4447`, with bundled World Bank data. The unrelated NOAA request is fixture-isolated. Mobile checks are browser viewport/touch emulation, not physical-device verification.

- Reproduced the original amber/Mincho appearance at 3840×2160 with India in 1987: source population 808,931,270, displayed as `8.1億`. Before screenshot: `artifacts/population-style/before/3840-india.png`.
- Final style regression: **16 checks passed** across 3840×2160, 1440×900, 390×844 and 320×844. Actual Canvas calls verify flat fill color/alpha, zero circle glow, sans-serif number and smaller unit, centering inputs, and no glyph squeezing. CSS computed styles verify the MAP accent and circular legend mark.
- The same regression checks 1987/1967/2025 coverage, source position, actual radius, fixed area reference, and cross-year area ratios. Real mouse/touch country selection opens the correct detail/source values; selected-circle outline and 80% observation card remain correct. Observation capture and mode exit/diagnostic clearing pass.
- Existing global population regression: **all four profiles passed** (3840×2088, 1440×900, 390×844, 320×740 reduced motion), including selected Japan and visible FRA/DEU/ITA/POL/UKR/RUS/USA/IND/CHN/BRA/ZAF source coordinates/radii, 1967→2025 area ratios, actual France selection, readout bounds/control clearance, and mode exit. Evidence: `artifacts/population-style/global/`.
- Existing hover/inline regression: 1440 and 390 widths with normal motion passed; original India/Japan values, 80% background, horizontal fields, details/close behavior remain valid. Evidence: `artifacts/hover-inline-80/after-motion/`. Final legend-only CSS changes were checked again by the full style regression.
- `npm --ignore-scripts run check`, `npm run check:population`, changed-script syntax checks and scoped `git diff --check` passed. This does not claim a release build or approval of lifecycle/release-rights gates.
- The population data is unchanged: before/after SHA-256 of `data/gaia-signals.json` is `966602fbe7d7ea737ebd9ac01f9eb302196aca2071e99f25d297d4097a5414fe`; import validation preserves all 14,292 original rows for 217 countries/economies.
- Visually inspected before/after India crops, final PC map crop, 4K full map, and mobile map screenshots. Final crops are under `artifacts/population-style/after/`.

## Not verified / unchanged workflows

No persistence, calculation, export or backend code changed. Source detail and observation capture were checked; saved-view reload was not rerun for this visual-only change. File export remains disabled by the app. Safari/Firefox, physical phones, production deployment and package installation were not tested. Existing release prerequisites are unchanged.
