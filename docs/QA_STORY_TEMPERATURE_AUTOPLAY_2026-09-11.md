# Story temperature: automatic playback and UI — 2026-09-11

## Request and scope

Owner's request, with a screenshot of the NASA GISS temperature-anomaly display:

> これも自動で進むようにして　あとUIが他のと比べてダサいので直しといて
> あと、スライダー最後までいったらストーリーに戻って進んで

Interpretation: automatically advance the **temperature-anomaly** display through the available 1958–2025 annual observations; both automatic completion and manual seeking to the final year should return to the next story step. Align this display's interface with the surrounding dark-blue/glass UI. This does not enable the story's separate AUTO setting, skip the following narration, modify data, extend to forecast years, or authorize a release.

The prior manual-only comparison behavior is intentionally superseded at the final year. Comparisons remain available before the final year, with pause/resume and point selection. Earlier local concept, character-copy, opening-plume, music and ending-transition work is preserved.

## Implementation

- `story-temperature.js`: starts automatically after loading and drawing the first frame; a single timer advances one year at a time (260 ms after each draw, 400 ms with OS/in-app reduced motion). The first frame is held for 1 second. At 2025 it holds for 1.6 seconds, then emits phase-specific completion. Pointer scrubbing, source reading and hidden-document state suspend playback and completion. Seeking back cancels the pending completion. Return/close cancels the timer and document listeners; a canceled load cannot mount a player during the exit fade.
- `story-temperature.css`: shared sans-serif UI typography, restrained pill return control, compact previous/play/next transport, large year readout, fine progress track, subdued secondary labels, aligned source and legend. Scientific palette, raw data rendering and missing-cell meaning remain unchanged.
- `novel-mode.js`: accepts completion only while the matching interaction is open; ignores a stale CO2 completion in the temperature phase; continues through the existing fade/focus/save lifecycle to `map_mode01_024`, exactly once.
- `app.js`: passes the existing effective reduced-motion preference into the temperature player. Earlier CO2 playback remains separate.
- `gaia-mode-loader.js`, `index.html`: updated asset cache keys.
- `package.json`, browser checks: new repeatable autoplay regression; existing comparison test now pauses and compares through 2024, leaving end-of-range completion to the new test. Lifecycle output is redirectable to preserve older evidence.

## Evidence and environment

All browser evidence uses installed Chrome, actual same-origin assets and binary temperature data at `http://127.0.0.1:4492`, isolated saved-story fixtures followed by native clicks/taps/keys. Mobile sizes are viewport/touch emulation, not physical devices. External services are blocked. Local navigation uses the production CSP policy; no production/header verification is claimed.

- Before reproduction: `artifacts/story-temperature-autoplay-2026-09-11/before/report.json`, PC 1440×900 and mobile 390×844. After waiting, the initial year stayed 1958; after native `End` and another 2.2 seconds, it stayed at 2025 / `map_mode01_023`. Both symptoms reproduced; screenshots preserved.
- Comparison regression: `artifacts/story-temperature-autoplay-2026-09-11/comparison/report.json`, **7 passed** (PC, mobile, 320×568, 844×390 landscape, reduced motion, data failure, pending-load cancellation). Actual map pixels change, touched cells match the binary source including missing cells, repeated manual comparisons remain available, source notes remain accessible, native SAVE/LOAD and actual full-script Markdown downloads pass in all five normal display variants. Return does not flash the underlying obsolete CO2 map.
- Existing narrative/lifecycle regression: `artifacts/story-temperature-autoplay-2026-09-11/lifecycle/report.json`, **2 passed** (PC and mobile). Native CO2 auto-completion → narration → temperature, reload during temperature interaction, native loading of the earlier saved CO2 step, and restoration of the original map/inert state all pass.
- `npm run check:story-temperature`: **passed**, 68 years / 1,101,600 cells / 476 independent raw-source monthly-average comparisons, plus correct narration background and new script syntax.
- `npm run check`: **passed**, including the existing story, data, media, CSP, content, license-register and secret-pattern checks. The simulated live-source 503 warnings are expected fallback tests, not a live production failure.

- Full real-time autoplay: `artifacts/story-temperature-autoplay-2026-09-11/final/report.json`, **5 passed** (PC, mobile, small, landscape, OS reduced motion). No accelerated clocks: consecutive annual frames through 2025, exactly one completion, next narration/focus, pause/resume, source-reading suspension, seeking back from the end, previous/next transport, native pointer/touch final-year seek, native saved-step replay, and explicit return without duplicate progression. No page errors, 404s or CSP violations.
- Visual QA refinement: screenshots revealed excessive blank map margins on a tall phone and a footer clipped below the short-landscape fold. Changed only two temperature-specific CSS media rules: portrait height capped at 620 px, and short-landscape panel height uses the viewport minus 28 px. **After** that change, reran the full playback/manual-completion scenarios on mobile, small and landscape: `artifacts/story-temperature-autoplay-2026-09-11/final-layout/report.json`, **3 passed**. Map, slider and 44 px playback/return buttons fit; no horizontal overflow. Main agent visually inspected desktop, portrait, small, landscape and expanded source screenshots. All JavaScript/data remained identical to the preceding complete comparison/lifecycle runs; those results are reused for unaffected paths.
- Edge conditions on the final files: `artifacts/story-temperature-autoplay-2026-09-11/edge/report.json`, **1 passed**. In-app reduced-motion enabled with normal OS media preference produces actual frame intervals of 424.7–425.8 ms. A stale CO2 completion is ignored. Native mouse hold at 2025 for 2 seconds does not return; dragging backward before release cancels completion. **Injected** document-hidden conditions suspend both playback and final-year return and resume afterward; this last check is not claimed as a physical background-tab/mobile OS test.
- Final syntax checks for all three affected browser test scripts and `git diff --check`: **passed**.

## Final local candidate

Base commit: `888c26b`, branch `codex/gaia-copy-motion-polish-20260904`, plus the preserved local working tree. Final focused-file SHA-256 values (also recorded in both final-layout and edge reports):

| File | SHA-256 |
| --- | --- |
| `story-temperature.js` | `ee41941330979d5d76faba9c54c76129c1bbd373680ce6baec066e121e2046ff` |
| `story-temperature.css` | `b5ead0cfbab75adfb34de90cac979cb5bb872c8b03bed2c4d4763ab6f5ad2ec7` |
| `novel-mode.js` | `32e4e717577e67b255f2c871f3b23ace23f75477517ec32d07bf81de1328b964` |
| `app.js` | `c555979ae476be1544880c89db93e953b256b065148758c8794ba0256c0b9dbf` |
| `gaia-mode-loader.js` | `d4be12cffaf46c905bf27d7072a57c3243ca9a38c273082c9ab74827d03bc3af` |
| `index.html` | `ee58414061aee6a8c7c612763a01057faecbf73dc5b984fecd45a6efcc7032e2` |

## Limits and release state

- Local implementation only. No commit, push, deployment, or ZIP release was requested or performed. Production remains unverified for this change.
- No new data retrieval, palette alteration, interpolation change, source rewrite or narrative-copy change.
- The short-landscape ordinary-VN character/text overlap previously recorded outside the temperature panel is not changed here; the temperature-panel UI and its story return are the current scope.
