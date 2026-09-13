# Story starts at 13:00 — 2026-09-11

## Request and result

Owner: 「9時台から始まってるけど、13時ぐらいからスタートにして」, with the GX heading showing `9:45｜展示端末・GX／太古の海`.

Interpretation: start the exhibition narrative at 13:00, shift the daytime sequence by 3 hours 40 minutes while preserving scene intervals, and keep the separately authored sunset walk in the evening. This is an in-world clock change, not a change to playback speed or duration.

| Scene | Previous clock | Current clock |
| --- | --- | --- |
| CONCEPT | 9:20–9:40 | 13:00–13:20 |
| MAP 01 | 9:40–9:45 | 13:20–13:25 |
| GX | 9:45–9:53 | 13:25–13:33 |
| ESP32 | 9:53–10:00 | 13:33–13:40 |
| Invitation | 10:00–10:07 | 13:40–13:47 |
| Welcome / exhibition | 10:07–10:45 | 13:47–14:25 |
| Sunset walk | PM 5:10–5:45 | 17:10–17:45 (same time, explicit 24-hour notation) |

Daytime chat timestamps now run from 13:46 to 14:05. The first posts precede opening the welcome chat by a minute, preserving the original relationship. The four late messages shown during the sunset walk now use 17:41–17:43, instead of retaining morning timestamps. The `午前展示枠` location label becomes `午後展示枠`. Narrative text, scene/step IDs, storyVersion 13, the three interactions, music and existing images are unchanged. The narrator's recollection beginning 「朝は」 remains a valid reference to earlier that day.

## Files and history

- New `story/afternoon-clock-20260911.js` records exact before/after values for six scene clocks and 31 runtime time fields (30 chat entries plus one inherited narration timestamp). It rejects unexpected input and supports exact reversal for historical-contract tests; it does not silently apply the offset twice.
- `scripts/build-novel-story.mjs` applies that revision after the existing approved-story merge; `novel-story-data.js` and `story/現行統合台本.md` are regenerated through their existing generators, not hand-edited.
- `novel-back-half-cues.js` is aligned with the same afternoon clocks, PM day-period metadata, and existing sunset timing.
- `gaia-mode-loader.js` and `index.html` update data/staging/loader cache keys.
- `story/README.md` documents the authored clock revision. The frozen manuscripts, raw submitted script, approved source and previous LOG revision manifests are all preserved byte-for-byte.
- Temporal/static-label tests are updated. The previous LOG follow-up test reverses **only** the explicitly recorded clock changes before checking its historical hashes; all non-clock fields remain subject to the original exact contracts. New `check:story-afternoon:browser` provides a repeatable regression.

## Verification

Local target: `http://127.0.0.1:4492`; base commit `888c26b` plus the preserved local working tree. Installed headless Chrome; PC 1440×900 and touch/mobile viewport emulation 390×844, not physical-device testing. Primary new browser check uses actual assets/runtime, isolated saved-step fixtures, native inputs, production CSP on local navigation and blocked external services. No rendered labels or chat timestamps are injected by the tests.

- `artifacts/story-afternoon-2026-09-11/before/report.json`: **4 passed reproductions**, starting at 9:20 and the reported GX heading at 9:45, on both viewports. Screenshots retained.
- `artifacts/story-afternoon-2026-09-11/after/report.json`: **22 display cases + 2 actual downloaded full-script exports passed**. All six scenes, an inserted ESP32 step, daytime chat, sunset narration and late chat were checked. Both viewports also use native SAVE, advance and LOAD at GX, retaining the step with the new 13:25 heading. Exported time metadata contains 13:46, 14:05, 17:41 and 17:43. No page errors, 404s or CSP violations.
- `artifacts/story-afternoon-2026-09-11/label-regression/report.json`: **12 passed**, six scenes × PC/mobile via native saved-slot LOAD. Visual clocks, full accessible date/range/place labels, story-time data, minute precision, viewport bounds, noninteractive label behavior and absence of horizontal clipping all pass. Console/page errors and 404s are empty.
- Main agent inspected the actual GX screenshots for PC/mobile and confirmed `13:25` at the reported heading position.
- `npm run check`: **passed**, including current/approved/frozen story contracts, all historical LOG checks, staging, temporal metadata/runtime, integrated export, content/data and security checks.
- Focused metadata check after adding the independent six-clock expectation: **passed**. Browser-test syntax: **passed**.
- Rerunning `scripts/build-novel-story.mjs` produced a **byte-identical** tested runtime. `scripts/export-current-story-script.mjs --check`: **passed**. No stale morning clock or `午前` label remains in active runtime/staging/integrated script.

### Tested runtime hashes (SHA-256)

| File | Hash |
| --- | --- |
| `novel-story-data.js` | `2ff6aac5345ffc56ad2431460291a3dc5f21b18a9b554fa6132acb2430108d57` |
| `novel-back-half-cues.js` | `6cb69b9f8fa5b1a22c87319b7785192dfef51a46536cc5d046e783a13e2046b2` |
| `novel-mode.js` (unchanged this request) | `32e4e717577e67b255f2c871f3b23ace23f75477517ec32d07bf81de1328b964` |
| `gaia-mode-loader.js` | `55748e8a70d5dde62f74ed919f1c49d557ebc48b6e36bddc47c5393304b86c7b` |
| `index.html` | `d9b9cc551f5ac529335fdc16185910c1f3206dfe0af1f3dd50c249ef14e93aa8` |

## Scope limits / release

Local only: no commit, push, deployment or distribution artifact was requested or produced. Physical devices and production are not verified for this change. Previous local temperature-autoplay/UI, opening-plume, character/concept, music and ending work is preserved; their runtime controllers are not changed here. The previously noted ordinary-VN short-landscape character/text overlap remains outside this clock adjustment; no new claim of a layout fix is made.
