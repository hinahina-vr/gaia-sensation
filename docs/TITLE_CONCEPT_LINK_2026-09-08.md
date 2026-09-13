# Title header: CONCEPT link

## Scope and version

Local change on base `b236255db4dc60f748aecfe4327d45d39f8ad33b`, retaining the existing uncommitted work. Opening asset revision: `title-concept-1`. No commit, push, deployment or distributable package.

- `index.html`: one native `CONCEPT` link to `./concept/`, inside the opening's title header; updated opening asset cache references.
- `opening.css`: plain upper-left text link with a 44px hit height and visible keyboard focus. Only visible on the final title, not sound setup, the cinematic, MAP or story. Narrow-screen expanded audio moves below the link to preserve access.
- `opening.js`: a normal same-tab link click uses the existing title-return marker. Browser Back can resume the title without repeating sound setup/cinematic. Modified clicks retain native link behavior.
- `scripts/check-title-concept-link-browser.mjs`, `package.json`: new browser regression (`check:title-concept:browser`).
- `scripts/check-concept-page.mjs`, `scripts/check-concept-page-browser.mjs`: replace the retired “unlinked page” expectation with title-only linking, retaining the prohibition on preloading concept assets.

The concept content, data, story saves, notebook and export implementation are unchanged.

## Verification

Final local Chrome run: **4 profiles passed**, no page errors or observed CSP violations. Desktop 1440×900; mobile/touch emulation at 390×844, 320×568 (reduced motion), and 844×390. Other profiles use normal motion. Requests to live APIs are isolated; this is not production/live-provider or physical-device testing.

Tested actual clicks/taps and desktop Tab/Shift+Tab/Enter navigation, keyboard focus appearance, viewport bounds, 44px target, collapsed/expanded audio separation, no concept requests before navigation, rendered concept destination, browser Back without repeated onboarding, and hidden link in other modes. MAP entry, guide close, MAP exit and return to title passed on desktop and portrait phones; story entry passed in landscape. Screenshots visually inspected on desktop, portrait and landscape, including narrow-screen expanded audio.

Evidence: `artifacts/title-concept-link/final/report.json` and adjacent PNGs. The initial test stopped at MAP's existing feature-introduction modal because the test had not dismissed it; the regression now closes that modal through its actual close button. No product change was needed for that test correction.

Additional passes: `npm run check:concept`, `npm --ignore-scripts run check` (main checks only; no lifecycle gates), `node --check scripts/check-title-concept-link-browser.mjs`, and scoped `git diff --check`.

Not rerun: the concept reader's full pre-existing multi-page interaction suite, story save/load and notebook persistence, physical mobile devices, Safari/Firefox, deployment and ZIP extraction. File export is disabled in this build. No change to these implementations is claimed.

Final SHA-256:

- `index.html`: `3e2f68791acae79b27344a4a39cc6867537e078e67909f29d2470d1192b10208`
- `opening.css`: `d34f5eb029f61b45192df4424bb55ad08721b52322a29cca5625fa3e12dbebe5`
- `opening.js`: `764b60066615fd94a9c1fa18da7b907892ce90deace84e691a708e5a53bc74b4`

Reproduce against the local server: `npm run check:title-concept:browser -- http://127.0.0.1:4447 artifacts/title-concept-link/recheck`.
