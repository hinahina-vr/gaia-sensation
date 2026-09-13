# Concept copy clarity — 2026-09-08

## Scope and candidate

- Local revision: `concept-10-plain-copy-1`, based on `aaa9153116c704f14d82f48969a396b907388451` plus the existing, preserved local changes.
- Request: the closing explanation in the supplied screenshot was incomprehensible, including “世界は、まだ物語ではない。” and “最後まで人間である。”
- The preceding local illustration change had already removed that closing block. This follow-up also replaces related abstract introduction, current-work, and footer copy with concrete descriptions of what AI proposes and what the person decides.
- Separates the proposed AI system from the currently implemented game. The page does not claim that the proposed personal-record AI system is running.
- Runtime change in this follow-up: `concept/index.html` only. CSS, JavaScript, and the two generated diagrams are unchanged from the preceding local candidate.
- Regression coverage: `scripts/check-concept-plain-copy-browser.mjs`, additional copy assertions in `scripts/check-concept-page.mjs`, and npm test commands in `package.json`.
- No push, deployment, or distribution archive was requested or performed.

## Checks and evidence

- `node scripts/check-concept-plain-copy-browser.mjs http://127.0.0.1:4447 --before`: reproduced the screenshot's closing phrases using the baseline HTML/CSS/JS in local Chrome at 595 × 1040. Evidence: `artifacts/concept-plain-copy-before/report.json` and `595-reported-closing.png`.
- `npm run check:concept-plain-copy:browser`: passed at 1440 × 900, 595 × 1040, 390 × 844, and 320 × 568. Evidence: `artifacts/concept-plain-copy-after/report.json` and the explanation/current-work/footer screenshots for each width.
- Checked removal of the opaque phrases, explicit AI/person roles, proposed-versus-implemented wording, rendered text bounds, and absence of horizontal page overflow.
- Verified the new “図で仕組みを見る” link reaches the diagram without fixed-header overlap; the actual local diagram decodes, opens, zooms, closes with Escape, and restores focus. Returning to the overview restores the light header.
- No page errors or CSP violations in these browser cases.
- Visually inspected the 390 px explanation, current-work, and footer screenshots for readable output and unclipped text.
- `npm run check:concept`: passed after adding the new test command and syntax check.
- `git diff --check`: passed; Git reported only line-ending conversion warnings on existing modified files.

## Exact runtime inputs

SHA-256 recorded by the browser test from the UTF-8 source:

| File | SHA-256 |
| --- | --- |
| `concept/index.html` | `5bdc619228f20db81cfb2b7267cda4aa4b540270e3744460a5e2084f7f9ea72e` |
| `concept/concept.css` | `27f2f65e777bf725251e2c8b686e4cb5c7187301358cdf15c55be1c97897d29d` |
| `concept/concept.js` | `4696cfa83134cef43cce1dcf47feb3eec05aeb00316d0927aae1bbc9c9eac78a` |

## Limits

Tests used local headless Chrome with desktop/mobile viewport emulation and CSP enforcement, not physical devices or production. Human comprehension still requires the owner's judgment; automated copy assertions only protect the chosen wording. The entire game, save/export flows, and the prior full browser matrix were not rerun for this HTML-copy-only follow-up. No runtime files were changed after the recorded browser run.
