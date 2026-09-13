# Neutral mobile observation-panel edges

## Scope / version

Local response to the cropped orange/cyan panel-edge screenshot. Base: `b236255db4dc60f748aecfe4327d45d39f8ad33b` plus the preserved worktree changes. Cache revision: `plain-panel-edge-1`. No commit, push, deployment or package was produced.

`map-mobile-shell.css` changes only the shared observation-frame rule inside the mobile breakpoint and `.is-mobile-map-shell` scope:

- Removed the 2 px theme-coloured top border, inner highlight and exterior glow/shadow.
- Applied one uniform 1 px muted gray border, `rgba(167, 184, 190, .22)`.
- Reduced the rounded corners from 16 px to 6 px.
- Retained background-only 80% opacity, blur, text, data, controls and positioning. Desktop frames, story detours, mobile menu artwork/buttons and map data colours are unchanged.

Updated the CSS reference in `gaia-mode-loader.js` and loader reference in `index.html`. Added `scripts/check-mobile-panel-edge-browser.mjs` and npm command `check:mobile-panel-edge:browser`.

Final CSS SHA-256: `cebd60e138f00803ea3d5144c8aa9bcc6279d2773d14e0c8c4a19f7bddd8dcf4`. Loader/HTML hashes are recorded in `artifacts/mobile-panel-edge/after/report.json`.

## Verification

Actual local Chrome at `http://127.0.0.1:4447`. Mobile viewport/touch emulation, not physical phones. UI tests use bundled data, synthetic API responses or intentional API failures; unrelated provider requests are isolated. No claim is made about live-provider availability.

- Before editing, reproduced the orange top edge at 628×844, MAP 18. Computed style confirmed the 2 px coloured top border, different cyan side border, 16 px corners and layered shadows. Screenshot: `artifacts/mobile-panel-edge/before/628-18-edge.png`.
- New visual regression: **42 checks passed**, covering MAP 18/1/2/6/12/21 (all six observation-surface families) at 628×844, 390×844, 320×568, 768×1024, 844×390, 1440×900 and 1920×1080. Normal entrance/fade motion is allowed to finish before measuring the active panel.
- Mobile computed styles confirm the uniform gray border, 6 px corners, no panel shadow, background alpha .8 and container opacity 1. Observation text remains populated, controls stay hit-testable, panel bounds fit, and no horizontal overflow occurs. Desktop checks confirm that restoring the former mobile-only edge rule does not affect desktop geometry, font, background, border, corners or shadow.
- MAP 18 source-credit clearance remains above 12 px in all seven profiles. This preserves the previous overlap fix despite removing the extra top-border pixel.
- Existing mobile-shell regression: **16 checks passed** at 390×844 and 320×568, including six exhibit families, real exhibition/reading/tools menu interactions, timeline input, source/analysis dialogs, guide/demo controls, focus trapping, ecology selection, breakpoint changes and story-layout exclusion. Evidence: `artifacts/mobile-panel-edge/mobile-shell/report.json`.
- `npm --ignore-scripts run check`, changed-script syntax checks and scoped `git diff --check` passed. Lifecycle/release-rights gates were not run; this is not a release-build claim.
- Visually inspected the before/after 628 px edge, 390 px MAP 18, 320 px CO2 panel and 844 px landscape MAP 18 screenshots. Final screenshots and detailed measurements: `artifacts/mobile-panel-edge/after/`.

## Unchanged / unverified

No storage, calculation, export or backend logic changed. Saved-view reload and observation capture were not rerun for this border-only patch; file export remains disabled by the app. No distribution ZIP was created. Physical phones, Safari/Firefox, production and installation/deployment were not tested. The separately recorded pre-existing reduced-motion test failure from the previous request was not changed or retested here.
