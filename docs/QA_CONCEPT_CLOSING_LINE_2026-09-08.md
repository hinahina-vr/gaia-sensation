# Closing title: one line — 2026-09-08

- Local candidate: `concept-11-single-line`, based on `aaa9153116c704f14d82f48969a396b907388451` plus preserved local changes. Not pushed or deployed.
- Request: display “世界は、まだ物語ではない。” on one line, as indicated in the supplied screenshot.
- Restored only this explicitly requested title at the closing position; the previous plain-language explanation and implementation limits remain unchanged. Added a title-specific no-wrap rule with responsive 17–25 px type. No JavaScript or image changes. CSS cache key is now `concept-11`.
- Runtime files: `concept/index.html`, `concept/concept.css`. Regression files: `scripts/check-concept-closing-line-browser.mjs`, updated copy assertions in `scripts/check-concept-page.mjs` and `scripts/check-concept-plain-copy-browser.mjs`, and the new npm command in `package.json`.

## Verification

- The supplied image visibly has two lines, but its original browser viewport is unknown. The historical baseline naturally wraps onto two lines at 280 px; this was reproduced without altering its HTML/CSS, then verified as one line at that same width after the change. Baseline 327 px was already one line; the exact screenshot's line split was not reproduced from that commit.
- `node scripts/check-concept-closing-line-browser.mjs http://127.0.0.1:4447 --before`: passed reproduction checks. Evidence: `artifacts/concept-closing-line-before/`.
- `npm run check:concept-closing-line:browser`: passed at 280, 320, 327, 390, 595, and 1440 px. All rendered text occupies exactly one line with no clipping or horizontal page overflow. Return-to-overview navigation passed. Evidence and hashes: `artifacts/concept-closing-line-after/report.json`.
- Visually inspected the actual 327 px and 1440 px browser screenshots: title is centered, readable, and on one line.
- `npm run check:concept-plain-copy:browser`: passed all four existing viewport cases, including plain-language copy, implementation limits, diagram opening/zoom/close/focus, and overview navigation. Its `after` report now identifies this candidate, superseding the prior local run.
- `npm run check:concept` and `git diff --check`: passed. Git emitted only line-ending conversion warnings.
- Local headless Chrome with mobile/desktop emulation and CSP enforcement; no page errors or CSP violations. Not physical-device or production verification. Game save/export flows were not changed or retested for this isolated title edit.

## Tested runtime SHA-256

- HTML: `2789a4de00eb6e505c4be0add33af620d25b5a4755289d15a0c277a01b8020e0`
- CSS: `427283feb4f832ce1e060083b58b8480b62a5d5a5d670de97a78a8d66658671b`
- JavaScript (unchanged): `4696cfa83134cef43cce1dcf47feb3eec05aeb00316d0927aae1bbc9c9eac78a`
