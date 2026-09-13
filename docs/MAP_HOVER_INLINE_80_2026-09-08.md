# MAP hover/readout: 80% background and horizontal fields

## Scope and tested version

Local implementation for the two owner-provided screenshots: the India population hover preview and Japan population observation label. No push, deployment, distribution ZIP, or production verification was performed in this change.

Base commit: `b236255db4dc60f748aecfe4327d45d39f8ad33b`, plus the existing local work and this change. Final implementation SHA-256 values are recorded in `artifacts/hover-inline-80/after/report.json`:

- `app.js`: `06d1b75b0502a65cd8d123ab32211e0c52d3e80809aba25e77ecdff02b87ba0e`
- `map-ui-grid-polish.css`: `736e13626c76d699aba994de63d720d831673e63aa7c854b6ccc1cdcbfd7e9b2`
- `gaia-mode-loader.js`: `02a7870648d629e7b3508cdd23c57a4cd8615ef1eb47d3969e298d0a65855c80`
- `index.html`: `428deca034927d385e6024b4f575f2e302e2bb8b15d23884fb782db07584d7f1`

## Changes

- Hover preview: identity, source/value summary, and click hint are separate horizontal columns. The existing shared 80%-alpha panel surface is preserved and its CSS fallback is also 80%. Text remains at its existing opacity; the entire panel is not faded to 80%.
- Canvas observation label: background changed from 95% to 80%; country, metric, and context share a row on desktop. Narrow viewports keep country and metric side by side and wrap context beneath. Renewable labels retain their existing two fields.
- Column measurement and wrapping preserve the source values, full country names, Mincho fonts, and uncompressed glyphs. Existing obstacle-aware placement is retained. Short landscape screens keep the 210px width cap so rain labels do not overlap the console.
- Loader and entrypoint cache keys updated. Added `check:map-hover-inline:browser`; updated related browser/static expectations for horizontal columns and current app behavior.

## Verification

Actual local Chrome rendering at `http://127.0.0.1:4447`, using the bundled source snapshots. The unrelated NOAA aurora request is fixture-isolated; this is not a live NOAA or production test. Mobile sizes use browser viewport/touch emulation, not physical devices.

- Before-change reproduction, 1440×900: India / 1973 / 583,465,598 people with vertically stacked hover fields; Japan / 1999 / 126,631,000 people with vertically stacked Canvas fields and an actual 0.95-alpha fill. Evidence: `artifacts/hover-inline-80/before/`.
- New regression: 1440×900, 3840×2160, 901×900, 390×844, 320×844, 568×320. Actual Canvas fill interception verifies alpha 0.8, text drawing global alpha 1, distinct horizontal positions, and no `fillText` compression. CSS computed styles and real field bounds verify the hover columns/background. Source values and years are unchanged. Desktop hover → click details → close → leave succeeds. Touch hover remains hidden. Evidence: `artifacts/hover-inline-80/after/` (9 checks).
- Normal-motion desktop hover regression: same source values and interactions, with the existing entrance/glint animation enabled. Text bounds are checked separately from the clipped decorative pseudo-element. Evidence: `artifacts/hover-inline-80/after-motion/`.
- Rain regression: Brazil/Japan at 1440, 3840, 390, 320 and 568 widths, plus reduced-motion 390. All 12 cases pass for complete values, source/name text, per-column fitting, and no overlap with controls. Evidence: `artifacts/hover-inline-80/rain/`.
- Renewable regression: CAN, JPN, DEU, VCT, GIB, XKX at 1440, 3840, 901, 390, 320 widths. All 30 cases pass, including long Japanese country names and no control overlap. Related analysis still yields 209 share records and 31 climate-context records. Evidence: `artifacts/hover-inline-80/renewable/`.
- Related MAP modes 06/07/08/09/10/11/12/14 at 1440/390/320: all 24 mode/viewport checks pass for typography, mode transitions, label fields, viewport fitting and unobstructed controls. Evidence: `artifacts/observation-typography/`. These sizes are unaffected by the final landscape-only width adjustment.
- Screenshots visually inspected: both requested desktop cards, 4K population label, narrow population label, short-landscape rain label, and long-name renewable label.
- `npm --ignore-scripts run check`, syntax checks for the changed browser scripts, and `git diff --check` pass. This is the main check command without lifecycle hooks; it does not claim release-rights approval or a complete release build.

## Boundaries

No data, calculation, persistence, export or backend implementation changed in this request. Observation captures and related analysis were exercised; saved-view reload was not rerun (prior coverage is recorded in `RECYCLING_COVERAGE_2026-09-08.md`). File export remains disabled by the application. Safari/Firefox, physical mobile hardware, deployment and final-package installation are not verified here. Existing release-rights prerequisites remain unchanged.
