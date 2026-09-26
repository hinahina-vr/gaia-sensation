# Wind data introduction prototype — 2026-09-26

## Request and scope

User: 「試しにいれてローカルで確認させて」 following the proposed post-title explanation.
Prototype only exhibit 01, 風がつなぐ世界. Existing title/subtitle remain unchanged.
After that transition finishes, show the proposed two-sentence explanation and source metadata for seven seconds (including fades). The map keeps rendering. Pointer/keyboard/wheel interaction dismisses the explanation without consuming the action. Other exhibits, guide and map exit cancel it. Reduced-motion mode shows the copy without animation.

Source state follows the actual provider: fetching, cached/saved, and illustrative fallback values are distinguished. JA/EN/zh-CN text is included in the existing localization catalog. Asset cache URLs updated; package version unchanged.

## Candidate and evidence

Base SHA: `3b8a0f12b8844094101dd8d578c30ef40778b01b` **+ uncommitted changes** (including the earlier action-icon fix and unrelated existing work).

- `node scripts/check-wind-data-intro-browser.mjs`: passed. Installed Chrome with local production CSP at 1440×900, 390×844, 844×390, and 320×568; smallest viewport uses reduced motion.
- Verified actual title → explanation → disappearance timing, fade frames, seven-second reading interval, continuing map frames and unpaused transport, no viewport overflow, screenshots, sample/loading metadata, repeat selection, unaffected 02, and rapid 02→01→02 cancellation.
- Clicked the source button while the explanation was visible: it dismissed and the data panel opened. Mobile operation-sheet taps likewise work.
- `npm run check:mode-loader`: passed, including 38 lifecycle checks.
- Locale bundle generation/equivalence and `node scripts/check-i18n-catalog.mjs`: passed (the latter is a story/metadata catalog check, not whole-app browser coverage).
- `node --check app.js`, security policy validation, and `git diff --check`: passed.
- Evidence: `artifacts/wind-data-intro-2026-09-26/report.json` records full source SHA and tested file SHA256s; viewport screenshots in the same directory were visually reviewed.

Weather data in browser QA were mocked or explicitly unavailable. This is not physical-device, live-provider, or production verification. No save/export format changed. Existing unrelated CO₂ legend/menu overlap remains recorded in `MAP_ACTION_ICONS_2026-09-26.md`; this prototype does not alter its stacking.

Local preview: `http://127.0.0.1:4492/#world-01`. Reload to replay the title and explanation. Chrome launched for the user. No commit, push, or deployment requested/performed.

## Follow-up: retain the title band and revise Japanese

User: 「なんか日本語変だな あと最初のやつの後ろの帯、消さずに説明出して」.

- Revised the two sentences to: 「世界各地の地上10mで、風がどちらへ、どれくらいの速さで吹いているか。」「気象予測モデルのデータをもとに、その様子を光の流れで表しています。」
- Exhibit 01 now keeps the original title band in place across the handoff. The title text disappears and explanation text fades in over that same band. Removed the explanation's separately drawn background. The shared band adjusts its height to the explanation and disappears at the end; other exhibit title transitions retain their existing exit.
- Visual review found the explanation overlapping the left zoom rail at 320px. Added narrow-screen clearance and slightly smaller body text at widths up to 360px, plus a regression assertion for that clearance. Re-ran the full four-viewport test on this final candidate.
- Re-ran `node scripts/check-wind-data-intro-browser.mjs`: all four viewports passed, including reduced motion, live-response fixture and unavailable-data fixture, actions, map frames, rapid switching and cancellation. Added frame-by-frame assertions that the original band remains visible at full opacity and does not translate away across the title/explanation boundary.
- Latest evidence: `artifacts/wind-data-intro-2026-09-26/shared-band/report.json`, `handoff-frames.json`, and four viewport screenshots (visually reviewed). Earlier evidence is retained but is not evidence for this revision.
- Syntax, 38 mode-loader lifecycle checks, locale bundle equivalence, security policy and diff whitespace checks passed. Same base SHA + uncommitted changes; updated artifact hashes recorded in the latest report. No commit/push/deploy.

## Follow-up: constant band height

User: 「帯の高さは変わらないようにタイポグラフィ調整して」.

- Reproduced the previous band's height change in installed Chrome at 390×844 (`--before-fixed-height`; `fixed-height-before/report.json`).
- Removed the JavaScript height measurement, CSS custom height and height transition. The shared band now uses the original title rule `clamp(180px, 24vh, 260px)` in both phases; it does not react to explanation or source-status length.
- Adjusted only explanation typography: smaller responsive body size, tighter line-height, compact attribution/status spacing, and continuous paragraph flow on the narrowest screens. Kept left zoom-rail clearance, full wording, source-state distinction, fade/hold duration and interaction behavior.
- Latest primary QA: `node scripts/check-wind-data-intro-browser.mjs` passed at all four widths. Added frame measurements proving zero height change from title through explanation, including loading→sample changes, and assertions that every text element stays inside the original band.
- `node scripts/check-wind-data-intro-browser.mjs --languages`: passed with English at 320×568 and Simplified Chinese at 390×844, both showing unavailable-data notices. Same fixed-height/text-bounds/interaction checks; separate evidence in `fixed-height-languages/`.
- Evidence for this revision: `artifacts/wind-data-intro-2026-09-26/fixed-height/report.json` and viewport screenshots, visually reviewed. Earlier evidence is retained separately. Mode-loader (38 lifecycle checks), security policy, syntax and whitespace checks passed. Same full base SHA + uncommitted changes; file hashes in the latest report identify this candidate. Local only; no commit/push/deploy.
