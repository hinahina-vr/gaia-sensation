# Story updates release candidate — 2026-09-12

Owner explicitly requested commit, push and deployment in this task. Existing destination: hinahina-vr/gaia-senseware, main and current codex branch, Cloudflare Pages gaia-senseware. Remote main db63742 is an ancestor of the candidate; local earlier commits 9fbd901 and bd6c1c3 are also included. No force push or database migration.

Scope: dialogue wording, 16:00 closing clock, character entrance/handoff expression, selected handwritten background and chat attachment, chat Gothic/channel labels/reactions, ruu log debug visibility and header layout, chapter-name swap, updated staff roles/lectures and skip-return destination. Detailed individual QA records are under docs/QA_*_2026-09-12.md. Unselected image candidates remain local and are not deployed.

Release preflight corrections: renamed ASSISTANT CSS selectors now retain single-line assistance credits; script export and old tests updated to the authorized chapter/credit changes. The old transition expectation was for a 900ms fade, superseded by the owner's documented 2700ms fade (QA_ENDING_ENTRY_FADE_2026-09-10.md). Current full ending browser suite passed both animated viewports and reduced motion after correcting that stale assertion. No runtime transition speed was changed.

Rights scope maintenance: existing 337 media content hashes and all other scope data/lockfiles/inventory are unchanged from the preceding local committed tree. One owner-requested, generated and selected OpenAI Imagegen whiteboard image is added. Existing media first-Git-evidence timestamps are refreshed. Prior owner decisions and provider-permission flags are retained, not newly represented as verified permissions. Current release instruction covers the selected generated image, not new third-party permission claims.

Evidence root: artifacts/release-20260912. Final deployment identifiers, remote state, extracted-tree verification and production checks are recorded there after execution; this file is not itself a claim of completed deployment.
