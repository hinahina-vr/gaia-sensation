# Left-aligned MAP heading and previous/next controls

## Scope / version

Local implementation of the request to move the title left and add `＜` / `＞` on either side to change exhibits. Base commit: `b236255db4dc60f748aecfe4327d45d39f8ad33b`, with prior worktree changes preserved. Runtime cache revision: `heading-step-1`. No commit, push, deployment or package was produced.

Changed files:

- `map-heading-navigation.js`: new plain previous/next buttons around the existing `#japan-title`; uses the existing canonical 30-exhibit catalog and provider click handlers. Steps wrap 30→01 and 01→30. The title's DOM node, accessible name and live announcement remain intact.
- `map-heading-navigation.css`: left-aligned heading and 44×44 px controls. Desktop starts after the measured Back/demo group. Mobile uses a separate left-aligned title row below Back/audio, with a darker header fade for readability. In short landscape layouts, the title stays in the left column and credits align with the right observation column; attribution text and links are unchanged.
- `gaia-mode-loader.js`, `index.html`: load/cache references.
- `scripts/check-map-heading-navigation-browser.mjs`, `package.json`: new browser regression and npm command `check:map-heading-navigation:browser`.
- `scripts/check-mobile-map-shell-browser.mjs`: checks actual 2D Back/title overlap rather than assuming they must be on the same row.

The controls are excluded from story detours and closed MAP views. Existing lower navigation, menu actions, data, figures, calculations, storage and export logic are unchanged. ResizeObserver reserves the actual desktop action-group width, including the demo control.

Final SHA-256:

- JS: `bb0178239a8b6ea857ed602067b8b821df27935243c8085f3900edce47973cb0`
- CSS: `cb7f459992229a5dc07fb2693592a1947049bad48bac77338e71d35e683ed193`
- Loader: `7927be1e7ac43d03a73633f75146e30d114c8d3811b9238ac72c24d7e462e5a3`
- HTML: `723e750bb0888a69ec68b8fafde932e99e46d9330231a4eb7b8b327977e0b2a9`

## Verified

Actual local Chrome at `http://127.0.0.1:4447`. Mobile checks use viewport/touch emulation. Data comes from bundled snapshots, synthetic responses or deliberately isolated API failures; this is not a live-provider or physical-device claim.

- Before screenshots/measurements at 390×844 and 1440×900 confirmed no title-side controls. The MAP 01 title starts at x=120 and x=427.72 respectively. After the change it starts at x=64 and x=272: 56 px and approximately 156 px farther left. Mobile moves below the existing Back row; Back itself is unchanged. Evidence: `artifacts/map-heading-navigation/before/`.
- Primary navigation regression: **145 checks passed** at 390×844, 320×568, 628×844, 768×1024, 844×390, 1440×900 and 1920×1080. It covers all 30 exhibits by actual forward button activation at 320 and 1440 widths, both wrap directions, additional provider transitions, readable/unclipped titles, hit-testable 44 px arrows, and separation from Back/demo, audio and readouts. Evidence: `artifacts/map-heading-navigation/after/`.
- Normal-motion regression: **49 checks passed** at 390×844, 844×390 and 1440×900. Includes actual taps/clicks, Enter/Space activation with focus retained, five rapid next-button activations, demo cancellation by real input, the existing mobile toolbar, mobile→desktop→mobile resizing with a sheet open, story exclusion and Back. Evidence: `artifacts/map-heading-navigation/after-motion/`.
- An additional landscape source-overlap assertion caught the full-width credit row touching the new title row. Its reproduction is retained in `artifacts/map-heading-navigation/landscape-credit-before/`. The landscape-only column adjustment was then applied.
- **Final version: all 49 normal-motion checks passed again** at 390×844, 844×390 and 1440×900, now including explicit source-fragment/title separation checks. This rerun covers the changed landscape CSS and preserves the portrait/desktop checks. Final file hashes, measurements and screenshots: `artifacts/map-heading-navigation/final/report.json`. The earlier seven-size/30-exhibit evidence predates only this landscape-specific CSS adjustment; navigation JS is identical.
- Existing mobile-shell regression: **16 checks passed** at 390×844 and 320×568 across MAP 18/1/2/6/12/21. Actual reading/tools/exhibition menus, timeline input, source and statistics dialogs, guide/demo operation, focus trapping, ecology selection, resizing and story-layout isolation pass. Evidence: `artifacts/map-heading-navigation/mobile-shell/`.
- `npm --ignore-scripts run check`, `npm run check:render-refactor`, changed-script syntax checks and scoped `git diff --check` passed. Loader checks cover lazy entry, stylesheet/script ordering, preload hints and deduplication. Lifecycle/release-rights gates were not run; no release-build claim is made.
- Visually inspected before/after mobile headings, complete 390 px MAP view, 320 px heading, final PC heading and the final landscape heading/right-side credits. All final regression reports contain zero page JavaScript errors.

## Not verified / unchanged workflows

Saved-view reload and observation-notebook persistence were not rerun; they were not changed. File export remains disabled by the application. No ZIP/install workflow was introduced. Physical phones, Safari/Firefox, live external feeds and production/deployment were not tested. Earlier unrelated release prerequisites and the separately recorded reduced-motion preference-switch failure were not changed.
