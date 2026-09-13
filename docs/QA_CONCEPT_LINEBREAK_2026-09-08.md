# Concept reader: phrase-aware Japanese line breaks

## Scope and candidate

- Request: fix unnatural wrapping in the supplied phone screenshot, including the orphan `る。` in the transition heading.
- Base: `aaa9153116c704f14d82f48969a396b907388451`, with local changes only.
- Runtime changes: `concept/index.html`, `concept/concept.css`. CSS cache key is now `concept-9`; unchanged JavaScript remains `concept-8`.
- The heading, its description, and the graduation-project note shown above it use short nonbreaking phrases separated by explicit optional break opportunities. Original wording, font sizes, desktop hard breaks, and navigation are preserved.
- Regression: `scripts/check-concept-linebreak-browser.mjs`, also exposed as `npm run check:concept-linebreak:browser` and syntax-checked by `npm run check:concept`.

Tested runtime SHA-256 (exact local file bytes):

| File | SHA-256 |
| --- | --- |
| `concept/index.html` | `ad5db9520749c6edbac1c4912711606eb8d75db6888a4800d31c568284244d32` |
| `concept/concept.css` | `73c6a2426c8a9699c337568cf1f03b912eae25ed3539e3c8307cd9bcf2baeb8b` |
| `concept/concept.js` (unchanged) | `3a5370e2b97ad1fb9dd2898bd33a6156a2e71b42286a79693051f1bbd4b82866` |

## Reproduction and focused browser regression — PASS

Environment: real headless Google Chrome on Windows, local HTTP at `http://127.0.0.1:4447`, mobile/desktop viewport emulation, reduced motion, repository CSP headers. The before run substitutes HTML/CSS/JS from the pinned base commit; the after run loads current files from the local HTTP server.

Commands:

```text
node scripts/check-concept-linebreak-browser.mjs http://127.0.0.1:4447 --before
npm run check:concept-linebreak:browser
```

- At 360px, the baseline paints `いつの間にか、自分を見てい` followed by a separate `る。`, matching the reported symptom. At 390px the original ending already fits in this environment; the regression does not claim every width was broken.
- After the fix, 280/320/360px paint the heading as `地球を見ていたはずが、` / `いつの間にか、` / `自分を見ている。`.
- At 390/412/480/768/900/1440px the second sentence fits together and the original two-line presentation is retained.
- The test measures every painted character with DOM ranges. All specified phrases stay on one line, no line consists only of a sentence ending, and all characters remain within both their column and the viewport.
- Original text is asserted unchanged. Heading stays at least 22px and the two body paragraphs at least 14px.
- No horizontal page overflow at any of the nine widths. The `作品を支える思想へ` link still reaches `#depth`, clears the fixed header, and changes the header to its deep theme.
- No page errors, HTTP failures, or recorded CSP violations.
- Visually inspected the 360px heading/description, 360px project note, and 1440px heading/description screenshots.

Evidence: `artifacts/concept-linebreak-before/report.json`, `artifacts/concept-linebreak-after/report.json`, and corresponding `*-threshold.png` / `*-project-note.png` files. Reports retain exact line text, per-character geometry, and source hashes.

## Related checks

- `npm run check:concept` — PASS (syntax, preserved copy/contracts, assets, anchors, and existing title entry).
- `npm run check:security-policy` — PASS (six inline script hashes unchanged).
- `git diff --check` — PASS.
- `node scripts/check-concept-page-browser.mjs http://127.0.0.1:4447 artifacts/concept-linebreak-page` — PASS, seven groups, zero page/HTTP errors. Includes 1440/390/320/768/3840px, header themes and anchors, readable body type, all six tabs and keyboard operation, diagram opening/zoom/pan/focus/closing, print content, reduced motion, 390px JavaScript-disabled fallback, and existing local story entry without preloading concept assets. Report: `artifacts/concept-linebreak-page/report.json`. The existing suite retains its historical `version: concept-8` label; its recorded source hashes match the CSS `concept-9` candidate listed above.

## Boundaries

No push, commit, deployment, or production changes were requested for this fix. Physical Android/iOS devices and their installed fonts have not been tested. No new storage, export, external API, or distributable ZIP is involved; no live-provider behavior is claimed.
