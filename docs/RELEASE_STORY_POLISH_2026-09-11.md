# Story / concept / sound release — 2026-09-11

## Authority and candidate

Owner's current instruction: 「コミット・プッシュ・デプロイ」, following the completed sound-list compaction. This releases the accumulated, previously requested local changes on `codex/gaia-copy-motion-polish-20260904`, based on public commit `888c26b623151205f6b8ecf9f77951dbc9a425ae`.

Existing destination: `hinahina-vr/gaia-senseware`, current feature branch and `main`, ordinary fast-forward push; Cloudflare Pages project `gaia-senseware`, production branch `main`, <https://gaia-senseware.pages.dev/>. Both remote branches and the current production deployment were read back at the base commit before release. No force push, history rewrite, database migration, secret change, or infrastructure configuration change is included.

## Reconciled scope and reusable evidence

| Requested change | Implementation / regression record |
| --- | --- |
| MAP 01 chapter uses BLUE GLASS TIDE, without restarting between its demos | `QA_STORY_MAP_BLUE_GLASS_TIDE_2026-09-10.md` |
| Opening surf, centered text, WebGL plume and subsequently stronger color | `QA_STORY_OPENING_SEA_PLUME_2026-09-10.md`, `QA_STORY_PLUME_DENSITY_2026-09-11.md` |
| Slower entry from credits into the ending | `QA_ENDING_ENTRY_FADE_2026-09-10.md` |
| Character-page copy and text aligned to the first portrait | `QA_CHARACTER_COPY_ALIGNMENT_2026-09-10.md` |
| Concept-book text, learning section, depth, original notes, removals and colophon | `QA_CONCEPT_EDITORIAL_2026-09-10.md`, `QA_CONCEPT_LEARNING_2026-09-10.md`, `QA_CONCEPT_DEPTH_NOTES_2026-09-10.md` (latest copy supersedes earlier wording) |
| Temperature timeline automatic playback, revised controls, final-year return | `QA_STORY_TEMPERATURE_AUTOPLAY_2026-09-11.md` |
| Exhibition clock starts at 13:00, including chat and exported script | `QA_STORY_AFTERNOON_CLOCK_2026-09-11.md` |
| Natural phrase/page breaks in both narrative runtimes | `QA_STORY_READING_BREAKS_2026-09-11.md` |
| Section content/UI fade-in and half-strength surf only | `QA_STORY_SECTION_ENTRY_2026-09-11.md` |
| Remove the four chapter labels above the track list; desktop height minus 24 px | `QA_SOUND_COMPACT_RAIL_2026-09-11.md` |

These records retain the original requests, reproduction evidence, actual browser checks, exact tested hashes, failures and limitations. Earlier reports are historical evidence, not a claim that every older file hash equals this release. This release rechecks integration and delivery on the final combined candidate. Authored frozen manuscripts, story IDs/version and existing user-save format remain unchanged; current clock/page revisions and integrated-script output are explicitly versioned.

## Release verification

Evidence root: `artifacts/release-story-polish-20260911/` (ignored local test output). `release-evidence.json` records the final commit, Git tree extraction, remote refs, CI result, deployment ID and actual production checks after those steps occur. This pre-release record is not itself proof that deployment succeeded.

- Full root `npm run check`, including pre/post checks, data/story/export contracts, CSP generation, loader checks, media provenance and targeted secret-format scan: passed during release preflight.
- `check:release-rights`: passed with unchanged scope hash `f626449f950c9cfc1545dbcfeeb11a404790c09557ab01d09e5b967e8192a187`; no new media/data/dependency adoption.
- Pinned Pages Worker dry-run build: passed, `_worker.js` byte-identical to the existing version. The first sandboxed build could not access Wrangler's local configuration directory; the same build succeeded with authorized filesystem access. No production write occurred during this build.
- QA scripts now allow the explicitly selected HTTPS origin while continuing to block unrelated external services. The existing security helper only supplies CSP to localhost; production checks retain the actual server headers. Reports identify their actual base URL and distinguish local from HTTPS delivery.
- Published-byte verification includes `concept/` as well as root browser code, assets and runtime data.
- Commit contents are materialized into a new directory, verified against every Git blob, checked for extra files, and served from that directory for desktop/mobile browser regression before deployment. No ZIP is distributed in this release.
- Required production gates: exact HTTP body hashes and security headers, read-only sensor API health and protected-path checks; real-browser story transitions, typography/save/export, temperature completion, sound layout/playback, character/concept display and navigation. Results are recorded separately from local evidence.

### CI synchronization correction

The first pushed candidate, `8870b1ba1d484b0366c360ccb87686dfaa8b7533`, passed the sensor job but failed the Web job in run `34543779249`: the guide's first full-map target had appeared while the card still reported `placement: standalone`. Its 1280×820 target bounds overlapped the temporary centered card, so the test's geometry-only readiness condition accepted that intermediate state. The immediately following screenshot already showed the target arrow. Evidence is preserved in `artifacts/release-story-polish-20260911/ci-8870b1b/`.

The follow-up changes only the contest test and this record: it waits for non-standalone placement and a displayed arrow as well as the existing containment/proximity rules. It also asserts the actual arrow display, without relaxing distance, clipping, size or timing limits. Product files are unchanged. The final commit's CI and newly materialized delivery evidence must still pass; a retry alone is not treated as proof of a fix.

## Limits and retained issue

Production verification of `8e877d5` exposed two more premature test observations, with no page errors/404s: a reduced-motion LOAD still had the same old step ID while its asynchronous runtime preparation was pending, and audio selection completed before the asynchronously decoded cover/title presentation. The existing `data-runtime-reveal`/`aria-busy` and sound presentation `data-track`/`aria-busy` are now required readiness barriers in the tests. The temperature/clock saved-load tests use the same runtime barrier. Product sources remain unchanged. Failed reports are retained under `production-story/section` and `production-surface/sound-playback`; final reruns and the final deployment are separately recorded in release evidence.

Browser checks use installed Chrome with viewport/touch emulation and isolated saved-position fixtures. Media checks use actual Web Audio/media decoding, not subjective listening on physical speakers. No physical iOS/Android, Safari/Firefox, live sensor hardware or production database mutation is claimed. External reference-link destinations are not fetched by the isolated visual tests.

The previously recorded ordinary-story control overlap on short landscape viewports is still unresolved. Portrait/story typography and the separate landscape temperature-panel fixes do not establish that this older layout issue is fixed. A separate layout adjustment and regression at the reported landscape conditions remain necessary.
