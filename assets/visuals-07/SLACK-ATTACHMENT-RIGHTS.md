# Slack attachment asset provenance

Generated on 2026-08-09 for GAIA SENSATION.

## Production method

- Generator: built-in ImageGen
- Mode: `style-transfer`
- Intended use: in-story Slack attachment illustrations
- Final style: the same anime / painterly visual-novel background style used by the game
- Final dimensions and format: 1200 x 900 WebP (4:3)
- Local processing: generated PNGs were center-fitted to 1200 x 900 with Pillow `ImageOps.fit`, Lanczos resampling, then encoded as WebP at quality 90 / method 6
- Rights note: no external stock image or third-party copyrighted artwork was introduced. Content references and style references were project-owned GAIA SENSATION assets. The built-in ImageGen outputs are stored as project production assets.
- Superseded assets: commit `ac32bda` contains photorealistic FLOWERBED and VENUE drafts. Those drafts are excluded from final integration and may be used only as composition references.

## FLOWERBED

- Final asset: `assets/visuals-07/slack-attachment-flowerbed-v1.webp`
- SHA-256: `923a27a7c0be60ac59560a53300f57315e906bbebd0162a203b5df2f45689325`
- Generated source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-802ec6bc-2868-4bfb-9692-07c58040d015.png`
- Content reference: superseded photorealistic FLOWERBED draft from `ac32bda`, composition only
- Style reference: `assets/visuals-07/novel-bg-garden-center-v2.png`
- Prompt record: redraw the station-back flowerbed completely as anime visual-novel background art; focus on the weathered physical sign with exact text `水やり当番`; preserve a casual close smartphone composition; match the garden-center background's delicate linework, layered cel-painterly shading, luminous blue-green palette and soft atmospheric depth; no photorealism, people, Slack UI, captions, watermarks or extra readable text.

## VENUE

- Final asset: `assets/visuals-07/slack-attachment-venue-v1.webp`
- SHA-256: `40a3b3e7a4fb644df631b1c2ac447cd1fcbcdca2e44265f3d0007bbe3445f8aa`
- Generated source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-78415a6c-4611-48ee-871a-7b33f94db15f.png`
- Content reference: superseded photorealistic VENUE draft from `ac32bda`, composition only
- Style reference: `assets/visuals-07/novel-bg-coastal-venue-v3.png`
- Prompt record: redraw last year's central entrance completely as anime visual-novel background art; show a Makuhari-Messe-scale coastal exhibition complex with a broad glass curtain wall and clearly visible sea and sky beyond; preserve a natural eye-level wide smartphone snapshot; match the coastal-venue background's architectural linework, blue-cyan palette, painterly/cel shading and reflected light; no photorealism, people, UI, captions, logos, construction materials or temporary setup.

## BASIL

- Final asset: `assets/visuals-07/slack-attachment-basil-v1.webp`
- SHA-256: `119571f8f1d1a0ab3f134587b61aff07e50bfac3bb4a76e16bef9dd8af4fa978`
- Generated source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-413e20ab-a527-472c-87c6-44f6c22e18a8.png`
- Content reference: the first painterly BASIL redraw from this production pass, composition and style only
- Style reference: `assets/visuals-07/novel-bg-garden-center-v2.png`
- Authoritative story details: basil behind the sales floor, a small markdown tag, yellow hose, and the soil-marked toe of a shoe caught at the frame edge.
- Prompt record: edit and complete the painterly potted-basil illustration while preserving its 4:3 smartphone composition, wet blue-gray garden-center service floor, black nursery trays, curved yellow hose, soft blue shadow, luminous green leaves, delicate anime linework, painterly cel shading and diffuse daylight; add a modest physical plant tag with exact Japanese text `値下げ`, and add only the cropped toe of one ordinary soil-marked student sneaker or work shoe at the extreme lower-left edge; keep basil as the main subject; no hands, faces, bodies, extra people, branding, price numbers, captions, chat UI, watermarks, photographic grain, photorealistic texture, 3D-render look or filter artifacts.
- Superseded within this pass: SHA-256 `7319064c6510eac09bc9b5cefe04ee5021f5146de08886e51c79c62058575f67` omitted the markdown tag and soil-marked shoe toe and is not eligible for integration.

## MEETING_MAP audit

- Asset: `assets/visuals-07/slack-attachment-venue-map-v1.svg`
- Dimensions: 1200 x 760 SVG viewBox
- SHA-256: `96e990de23cc4024ff4c1441442f6876f797afec2ef709a868b5636c54eb8809`
- Production method: project-authored SVG information graphic; no external stock image or third-party artwork
- Result: retained as a purpose-built vector information graphic. It is not a photographic attachment and does not use the rejected photorealistic treatment.
- Bundle action: included unchanged so the final attachment commit is self-contained.
