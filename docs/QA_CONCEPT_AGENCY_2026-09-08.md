# Concept 10: original agency / oracle illustrations

## Scope and candidate

- Request (2026-09-08): replace the text-heavy section beginning with “世界をつくり、物語を生きる循環。” and the sections after it with ImageGen illustrations based on the author's original diagram. Emphasize non-determinism, oracle, and the human's own choice. Correct the implied reliance on an unread book and identify LifeLog as the author's initial inspiration.
- Base commit: `aaa9153116c704f14d82f48969a396b907388451`; local working tree, not committed, pushed or deployed.
- Runtime: `concept/index.html`, `concept/concept.css`, `concept/concept.js`; CSS and JS cache keys are both `concept-10`.
- Two new project-local PNGs, produced with built-in ImageGen from the author's original semantic reference. No old art was deleted or overwritten. Full prompts, dimensions, attribution and primary-source link are recorded in `docs/CONCEPT_AGENCY_IMAGEGEN_2026-09-08.md`.
- A four-scene illustrated loop replaces the eight-node text diagram and six-tab essay. Four short native captions retain the personal archive, Deep Agents, alternate selves, God Agent, oracle and personal choice.
- A second illustration replaces the long explanation of the underlying mechanism and multiple experience-worlds. It is clearly labeled as a concept illustration, not a game screenshot.
- Book commentary/attribution was removed. The LifeLog factual description is distinguished from the author's non-deterministic response; no claim is made that DARPA's project literally determines fate.
- Previous title-link placement and phrase-aware line-break work are preserved.

## Reproduction and focused regression — PASS

Local headless Google Chrome on Windows with CSP and desktop/mobile emulation. The initial before run captured the actual text-heavy local page prior to edits at 1440x900 and 390x844. The current script's `--before` option can reproduce the earlier deep-section content from the pinned base commit. This is not a physical-phone or production test.

```text
node scripts/check-concept-agency-browser.mjs http://127.0.0.1:4447 --before
node scripts/check-concept-agency-browser.mjs http://127.0.0.1:4447
```

Evidence: `artifacts/concept-agency-before/` and `artifacts/concept-agency-after/`, including reports, mechanism, diagram, worlds, and viewer screenshots.

- After profiles: 1440x900, 390x844, 320x568, 768x1024 — all passed; no page errors or CSP violations.
- Non-whitespace text in `#mechanism` plus `#position`: 2721 → 915 characters (66.4% reduction). This measures all text, including formerly hidden tab panels: text was removed rather than concealed.
- Both final PNGs decoded at their declared native dimensions, display without aspect-ratio cropping, and have descriptive alternative text.
- Main short explanations are at least 14px and remain within their columns.
- Native dialog opening, width-fit view, zoom, scroll-wheel movement, Escape and focus restoration passed.
- No personal-data storage or API/inference requests were made by the concept page.

## Full related-page regression — PASS

```text
node scripts/check-concept-page-browser.mjs http://127.0.0.1:4447 artifacts/concept-page-v10
node scripts/check-concept-linebreak-browser.mjs http://127.0.0.1:4447
npm run check:concept
npm run check:security-policy
npm run check:rights
git diff --check
```

- Full-page profiles: 1440x900, 390x844, 320x568, 768x1024, 3840x2160. Plus JavaScript-disabled reading and existing story-entry smoke: 7 cases passed, no page errors.
- Preserved work-first ordering, actual map-mode screenshots, four course names, light/deep header changes, anchors, readable typography/contrast, image decoding and declared dimensions, and no horizontal page overflow.
- Dialog regular/zoomed views, forward/reverse keyboard focus containment, Escape, close button, backdrop click, reopen zoom reset and native overflow scrolling passed.
- Print-media emulation retained both illustrations and four explanations; no actual printed output or PDF artifact was produced.
- JavaScript-disabled reading retained the illustrations and all four explanations.
- Existing story entry still loads without concept-image prefetch.
- Previous Japanese phrase-break regression passed at 280, 320, 360, 390, 412, 480, 768, 900 and 1440px.
- Image-generation source records were added to the media ledger builder; the generated 299-asset ledger passes `check:rights`. This is provenance registration, not a new claim of provider clearance or a deployment.

The previous world-building browser command remains as a compatibility entry point to the new agency regression. Existing historical screenshots and reports were retained.

## Exact tested runtime and assets

| File | SHA-256 |
| --- | --- |
| `concept/index.html` | `8585abf0e0ec92c5c0426ad3802c57648b756205afe307b8712c4bbdfb07dde8` |
| `concept/concept.css` | `27f2f65e777bf725251e2c8b686e4cb5c7187301358cdf15c55be1c97897d29d` |
| `concept/concept.js` | `4696cfa83134cef43cce1dcf47feb3eec05aeb00316d0927aae1bbc9c9eac78a` |
| `assets/concept/myth-agency-loop-v1.png` | `22a19e7abf1a3c355ce5096df3bd2632ded1db98c41afa09cd0f1e62bc454213` |
| `assets/concept/myth-possible-worlds-v1.png` | `ebfd70d4ece881ed09a6c6c9f5b846d8a7eedc078e40182fb64ea5e7a0d4871c` |

No package, ZIP, installable artifact, push or production deployment was created. Safari/Firefox, physical touch devices, live personal-data/AI integration, production delivery and the release-wide approval gate were not verified. The newly illustrated mechanism is a design concept, not newly implemented data collection or world-generation functionality.
