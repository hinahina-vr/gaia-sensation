# Title About link: desktop utility placement

## Candidate and scope

- Request: find a better PC position for `このサイトについて` on the title screen.
- Base: `aaa9153116c704f14d82f48969a396b907388451`; local, uncommitted candidate only. No push or deployment was requested or performed.
- Runtime files: `index.html`, `opening.css`, `opening.js`. Both opening asset cache keys end in `title-about-desktop-1`.
- On wide, fine-pointer/hover devices, the existing native link moves to the top right, 12px left of the audio dock. Its vertical alignment and 46px target match the audio control. It follows the audio panel's expansion without overlap.
- Touch and narrow layouts retain the original link beneath the start buttons. There is still only one anchor, with the same destination and title-return behavior. Resizing preserves that DOM node and keyboard focus.
- The normal PC logo/start-card composition is preserved by retaining the old second grid track. Existing concept-page line-break changes were preserved, not changed in this task.

Tested SHA-256 (exact local runtime bytes):

| File | SHA-256 |
| --- | --- |
| `index.html` | `565bf624248b592651bf1b2d690168cd38b8c303df34c05bbfe5b6c1c4fcfd44` |
| `opening.css` | `a92ddf02523df966869f77fcc518deaea9c79f71c3ba2fd68ddabd70d59f7d33` |
| `opening.js` | `c83545b26fff31ad67c8bd7e2d4c1de4b5035a0d3bccef079310baf585b77a42` |

## Real browser checks — PASS

Environment: headless Google Chrome on Windows, local HTTP, repository CSP enforced, desktop/mobile/touch emulation. External requests were blocked and `/api/**` returned an offline fixture; this is not live-data, production, physical-phone, or Safari verification.

```text
node scripts/check-title-concept-link-browser.mjs http://127.0.0.1:4447 artifacts/title-about-desktop-after
node --check opening.js
node --check scripts/check-title-concept-link-browser.mjs
npm run check:concept
npm run check:security-policy
git diff --check
```

- Full navigation profiles: PC 1440x900; touch 390x844, 320x568 (reduced motion), 844x390 landscape. All four passed, with no page errors or CSP violations.
- PC resize checks: 1920x1080, 1366x768, 1024x600, 961x768, 960x768, back to 961x768, 1440x500, and 1440x900. The link changes placement across 960/961 without duplication or losing focus.
- Mobile resize checks retained: 360x640, 390x600, 420x568, 390x640, 390x641, 420x720, 420x721.
- Checked actual hit testing, viewport containment, target size, Japanese caption, and separation from the start cards, guide control, and audio panel.
- Audio expanded/collapsed states and per-frame animation samples have no overlap with the link.
- Link is absent during sound setup/cinematic and after entering MAP/story. It does not preload concept assets.
- Native keyboard Enter with visible focus on PC, native taps on touch, concept rendering, browser Back directly to title, MAP entry/exit/title return, and landscape story entry all passed.

Evidence: `artifacts/title-about-desktop-after/report.json` and screenshots in the same directory, including title, expanded audio, keyboard focus, concept, and responsive profiles. Main-agent visual review covered normal desktop, expanded audio, compact/short desktop, and all three phone profiles.

## Before/after composition comparison

Fresh reduced-motion captures in `artifacts/title-about-desktop-before/` and `artifacts/title-about-desktop-layout-after/` show identical measured rectangles for the title lockup, logo, menu, route cards, and audio dock at 1440x900 and 390x844. The phone About-link rectangle is also identical: x=135.78125, y=627.625, width=118.4375, height=44.

At 1440x900, the About link moved from its below-menu row to x=1226.390625, y=24, width=131.609375, height=46. The collapsed audio dock starts at x=1370, leaving the intended 12px gap.

## Existing limitation retained

At 1024x600, the pre-existing desktop title lockup extends above the viewport. A separate before run serving `index.html`, `opening.css`, and `opening.js` from the pinned base commit reproduced the same lockup rectangle (y=-108.625, height=472.625) as the changed candidate. Evidence is in `artifacts/title-about-desktop-compact-before/` and `artifacts/title-about-desktop-compact-after/`. This older logo-layout issue was not introduced or repaired by moving the About link; no claim is made that every title element is fully contained at that size.

No ZIP, installable package, export, or production release was created. Physical devices, other browser engines, and production delivery remain unverified.
