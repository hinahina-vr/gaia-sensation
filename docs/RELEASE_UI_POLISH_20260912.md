# UI polish release — 2026-09-12

Owner explicitly requested commit, push and deploy. Destination remains origin main/current codex branch and Cloudflare Pages gaia-senseware. origin/main is an ancestor of this candidate. No force push or database migration.

Scope: accumulated local exhibition playback, captions, map effects, metric interpolation, guide/terms, analysis layout, story presentation and UI arrival fixes. Existing per-feature QA records are retained. Unselected output/imagegen candidates are excluded.

Preflight: npm run build:release passed rights and full npm check (including postcheck/hardening/secrets). Its final Worker build was blocked by local Wrangler filesystem permissions; the same npm --prefix sensor-platform run build:pages-worker succeeded with access enabled and produced an unchanged tracked bundle. Stale structural tests for 09 autoplay, 12 country sequence and the concept link's new-tab attributes were aligned with previously requested behavior. Sensor guide regression now expects implemented, not planned, analysis.

Final local browser smoke: scripts/check-release-ui-smoke.mjs passed 1440×900 and 390×900: sensor guide copy/close, map overview reset, and story UI opacity increasing before text starts. Story uses the real handoff method with an immediate prologue callback, not full opening-video playback. Existing individual visual evidence is reused for other changes. No live sensor or paid AI test.

Known remaining scope: the earlier rejected generic analysis-warning summary still needs content revision; full opening and final-credit timeline regression is not newly verified in this release. Earlier guide opt-out request and explicit e-Stat explanatory-copy reconciliation remain to be checked. This release does not mark these completed.

Commit extraction, deployment IDs and production smoke evidence are stored under artifacts/release-ui-20260912 after execution; this record is not itself a claim that deployment has finished.
