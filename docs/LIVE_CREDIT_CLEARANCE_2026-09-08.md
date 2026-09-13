# Live MAP source-credit clearance

## Scope / version

Local fix for the reported source text overlapping the lower MAP controls. Base commit: `b236255db4dc60f748aecfe4327d45d39f8ad33b`, with all earlier worktree changes preserved. Runtime cache revision: `credit-clearance-1`. No commit, push, deployment or distribution package was produced.

Changed files in this request:

- `src/exploration/live-exhibits.js`: stable credit positioning for MAP 15–20 and recalculation after readout updates.
- `src/exploration/index.js`, `gaia-mode-loader.js`, `index.html`: cache references for that module.
- `scripts/check-live-credit-clearance-browser.mjs`, `package.json`: reproducible before/after browser regression and its npm command.
- This verification record. No CSS, source/license wording, data, calculations or persistence logic changed in this request.

Final implementation SHA-256: `src/exploration/live-exhibits.js` = `f09bbe6cbadf94f1714741c0fdbf79bf85e079880798e6b822a076750eb4d383`. The full six-file hash manifest is in `artifacts/live-credit-clearance/after/report.json`.

## Reproduction and correction

The old position calculation used the animated readout's `getBoundingClientRect().top`. The entrance moves the dock down by 24–48 CSS pixels without resizing it, so ResizeObserver does not necessarily update the credits when the motion settles. Source links and feed-state text could remain inside the final dock, including over its source/analysis buttons.

Actual Chrome reproduction with normal motion, MAP 15, Sapporo's unavailable bundled value: the footer extended 21.90625 px into the panel at 1920×1080 and 18 px at 1440×900. The original overlap assertion passed at both sizes. Evidence: `artifacts/live-credit-clearance/before/report.json` and the corresponding full-map/footer screenshots.

The new calculation reserves the bottom-anchored, settled readout bounds, accounts for rendered CSS zoom, and adds 12 px clearance. If the current animation lifts the panel higher, that higher edge is respected too. Readout changes and window resizing recalculate the offset. Existing credit links, wrapping and responsive visibility rules remain unchanged.

## Passed verification

Actual local Chrome rendering at `http://127.0.0.1:4447`, with normal animation. Mobile profiles use viewport/touch emulation, not physical devices. Live snapshot requests deliberately return a 503 to exercise the real bundled fallback, then a synthetic Tokyo response exercises the longer timestamp. Unrelated NOAA output and the external provider destination are fixture-isolated. These are UI/integration checks, not live-provider availability checks.

- `node scripts/check-live-credit-clearance-browser.mjs`: **60 checks passed**, no page JavaScript errors. Profiles: 1920×1080, 1440×900, 1024×768, 3840×2160, 390×844, 320×568 and 844×390.
- 42 checks cover all six MAP 15–20 exhibits across those seven profiles, after normal dock entrance motion. Every visible source/time fragment stays inside the viewport and clear of the readout, buttons, location selector, toolbar, title and zoom controls. All visible credit links and action-button centers remain hit-testable; no horizontal overflow. Minimum measured footer-to-panel clearance: **12 px**.
- Seven longer timestamp updates preserve clearance and show a JST timestamp.
- Four in-place resizes from the original 1920 profile to 901×768, 390×844, 844×390 and back to 1920×1080 preserve the same constraints.
- Seven interaction checks actually click the Open-Meteo credit, verify the popup URL, then open and close the correct MAP 20 source dialog through the desktop source button or mobile tools sheet. Returning to another exhibit removes the live-weather credit.
- Visually inspected before/after 1920 footer screenshots, the 1440 MAP 18 footer, 390 portrait, 320 portrait and 844 landscape screenshots. Full evidence: `artifacts/live-credit-clearance/after/`.
- `npm --ignore-scripts run check`, syntax checks for the changed JS/test files, and `git diff --check` passed. The npm invocation intentionally does not run lifecycle or release-rights gates; it is not a release-build claim.

## Related test failure retained

The existing `check-map-dock-motion-browser.mjs` passed its 30 desktop exhibit-transition geometry/motion checks at 1440×900, but failed at line 145: after switching the reduced-motion preference, one animation was still reported after its fixed 60 ms wait. Both the initial and serial runs failed there, so the suite's remaining profiles did not complete.

A read-only browser route served the pre-fix position function, with the new render-time call removed, and reran the unchanged motion test. It reproduced the same failure after the same 30 transition checks. Thus this failure is also present with the prior positioning behavior; its underlying timing cause has not been diagnosed or changed here. Evidence is retained in `artifacts/live-credit-clearance/dock-motion/`, `dock-motion-serial/`, `dock-motion-baseline/`, and `check-motion-baseline.mjs`. The whole motion suite is **not** reported as passed.

## Unchanged / unverified workflows

Saving, export and backend behavior were not modified; saved-view reload and observation capture were not rerun for this positioning-only patch. File export remains disabled by the application. No ZIP/install workflow exists for this change. Physical phones, Safari/Firefox, live external-provider availability, production and deployment were not tested. Existing release prerequisites remain unchanged.
