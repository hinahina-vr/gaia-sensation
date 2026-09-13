# v1.0 release provenance

Source development commit: `20f0e5d3f84e56b1c97303c283fc80abd495b3f1`.

This is a history-free publication copy. Original media dates and content hashes are preserved in `media-origin-snapshot.json`; no development history is represented as new production history.

Release transformations:

- Repository links point to `hinahina-vr/gaia-sensation`.
- The optional, production-disabled JAXA live GeoTIFF decoder and its dependencies are omitted. Saved JAXA observations remain available with their existing source and freshness labels.
- Reacquirable JMA HTML and water-quality source ZIP downloads are omitted. Runtime annual data, attribution manifests and the parser test fixture remain. To regenerate source-based data, use `node scripts/fetch-japan-marine-cod.mjs` and `python scripts/build-japan-sensor-open-data.py --fetch` first. Source-download verification requires those downloads and is separate from runtime verification.
- Development agent instructions are omitted. Existing provenance and test documentation is retained, but internal documents are not linked from README.
- The recycling regression's historical input is retained as a compressed test fixture with its original commit and SHA-256, replacing a dependency on development Git history without changing the comparison.
- `thumbnail.png` is the promotional artwork selected and supplied by the owner for this submission. SHA-256: `b7ec35a91c1651691db3dae008c450c8f362c5a0989e417613532591161571fb`. The supplied image is copied without changes; this selection does not assert third-party permission beyond the existing generated-artwork record.

The owner requested this v1.0 push and deployment after completing the development commit. Existing rights decisions remain unchanged; migration bookkeeping is not a new provider permission.

The project-specific 1 MB conservative entry budget is an owner-accepted known exception, not a contest size rule. Other checks remain required. Real-device, Safari, complete-story and live AI-provider coverage are not claimed by the release smoke test.

Production remains `https://gaia-senseware.pages.dev`. No production database initialization or migration is part of this release.
