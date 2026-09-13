# GAIA SENSATION — festival_concept_076 five-surface booth CG candidate

Recorded: 2026-08-13 JST

## Status

- Superseding ROOT PMO decision: **R2 asset-only GO**.
- The initial candidate remains HOLD. Its PC 1440 centered cover passes, while its centered mobile crop excludes both characters.
- The adopted R2 candidate is `event-cg-festival-map-transition-v2-candidate-r2.png`, SHA-256 `1702EABA7FDABF3B916C437743DBB3E2D0482D937E2090B7FA54598F6142438A`.
- ROOT PMO directly inspected the R2 original, PC proof, and mobile proof. On mobile, both faces and the infinity/flower clips are readable; Amane's outer head contour touching the edge by a few pixels does not impair character recognition and is outside the owner's requested acceptance criteria.
- Exactly one built-in ImageGen edit candidate was produced. No additional scene, mobile-only asset, alternate composition, or targeted iteration was generated.
- Repository integration is authorized only for `festival_concept_076` in a latest-PUBLIC-descended combined worktree. This provenance workspace performed no repository asset integration, cue change, commit, push, or deploy.

## Workflow

- Tool: OpenAI built-in ImageGen edit/compositing (`imagegen` skill).
- Post-processing: none on the candidate. Proof files are deterministic centered CSS-equivalent `cover` crops only.
- No post-generation text, logo, watermark, UI, paint-over, or character retouching was added.

## Inputs

1. Edit target / current `festival_concept_076` CG:
   `C:\Users\wdddi\.codex\worktrees\6d6d\touch-prism-mvp\assets\visuals-07\mode-map-v1.webp`
2. Approved v6 five-surface booth reference:
   `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-9ee38223-fb34-4159-9f90-6d1dcc3b598f.png`
3. Approved conversation-wide v2 continuity reference:
   `C:\Users\wdddi\.codex\visualizations\2026\08\08\019fe20b-7ae5-77e3-8b97-cd897107aa96\festival-projection-implementation\assets\visuals-07\novel-bg-festival-projection-conversation-v1.png`
   - SHA-256: `ce49de5053c65361b0e06fbcab99bb2aa18d4f4ead2a84584022d5fffeaed4e7`
4. User display screenshot inspected for context:
   `C:\Users\wdddi\AppData\Local\Temp\codex-clipboard-88eeb4c5-0353-40e7-b809-e84690adcd3d.png`

Every input was inspected with `view_image` at original detail before generation.

## Output

- Candidate: `event-cg-festival-map-transition-v2-candidate.png`
- Dimensions / format: 1672 × 941, RGB PNG
- SHA-256: `5E2FF7C1789E2E8940D746C3688E27A441230DDBDEE8A186966CB633DBFC9712`
- Built-in generated original:
  `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-ee6ff5b4-b2e6-4827-b1ec-9a5f4c586e31.png`

### Proofs

- PC 1440 × 810 centered cover:
  `event-cg-festival-map-transition-v2-candidate-pc1440.png`
  - SHA-256: `362C7CA4FB0E73BAC8D59B0EC6882D124F1A6059CFF8F339B32E0067C743ED5D`
  - Pass: both characters, pointing action, notebook, five physical projected surfaces, curtains, pipes, projectors, hall edges, and lower VN-safe area remain readable.
- Mobile 390 × 844 centered cover:
  `event-cg-festival-map-transition-v2-candidate-mobile390.png`
  - SHA-256: `7F838EE2537FB4D4BBA86B59F72D110AFD85CC6DB0677CE181A01FD92F1FDE57`
  - Fail: no black bars, but both faces and both hair clips fall outside the centered crop; only Mizuha's pointing arm enters at the right edge.

## Full prompt

```text
Use case: identity-preserve compositing
Asset type: one PC/mobile-shared landscape visual-novel event CG for festival_concept_076.
Primary request: Edit Image 1 only. Preserve the exact #0076 characters, relationship, action, costumes, faces, hair ornaments, watercolor-anime design, and quiet explanatory moment, but rebuild the flat abstract map room as the physically believable interior of the already approved five-surface projection-mapping booth shown in Images 2 and 3. Output only one landscape CG; no mobile-only asset or alternate composition.
Input roles:
- Image 1 is the definitive edit target and sole character/pose/style anchor.
- Image 2 is the canonical close architectural reference for the student-built black-curtain and rental-pipe five-surface booth.
- Image 3 is the canonical continuity reference for the same booth inside the same coastal university exhibition hall.
Character invariants: Keep exactly two young women and no one else inside the booth. Mizuha is the same long blue-gray-haired woman with braided section, infinity-shaped hair clip, blue-gray eyes, white blouse and dark blue-green jumper dress; she remains to the left of Amane and points with the same extended index-finger gesture toward the projected observations. Amane is the same short pale-blue bob-haired woman with flower hair clip, blue eyes, pale-blue cardigan and white dress; she remains to Mizuha's right and holds the same open paper notebook/reference material with both hands. Preserve face shapes, age, body proportions, relative height, expressions, gaze, hair silhouettes, garment construction and colors, left/right relationship, pointing action, notebook action, and delicate pale watercolor Japanese visual-novel illustration style from Image 1. Do not swap, redesign, add, or remove either character.
Scene/backdrop: They are unmistakably standing inside the modest approximately four-meter student booth from Image 2. Show black blackout curtains with real folds, ordinary exposed rental pipe uprights and top bars, small physical projectors, and five distinct physical projection surfaces: rear wall, left wall, right wall, ceiling, and floor. A continuous luminous data visualization crosses every corner and plane with ocean, clouds, atmospheric arcs, temperature and CO2 observation points, and ocean-current lines. Integrate the world map/Earth naturally as projected content on the rear and side planes; it is not a flat pasted mural and not a separate fantasy corridor. Projection geometry must bend and distort correctly over curtain folds, corners, pipes, and floor perspective. Blue/cyan projector spill and bounced light wrap physically over their hair edges, cheeks, white fabric, dark jumper dress, cardigan, notebook, hands, and floor while faces and hair ornaments stay readable.
Hall continuity: Through a narrow opening at one or both entrance edges, retain a subtle but unmistakable glimpse of the same exhibition hall from Image 3: high ceiling truss, neighboring handmade student booths, and coastal daylight. Keep those hall details secondary and distant; no identifiable additional faces.
Composition/framing: landscape approximately 16:9, matching Image 1's explanatory two-shot. Preserve the relative staging—Mizuha left, Amane right, Mizuha pointing across the projected map and Amane holding notes—but move the pair together as one group toward the horizontal center only as much as required for responsive use. Both complete faces and both hair clips must remain clearly identifiable in PC 2048/1440 and in a centered 390×844 CSS cover crop with zero black bars. The mobile crop may omit lower bodies and outer notebook edges; it does not need to show the full figures or full sheet. Keep the pointing hand legible on PC. Reserve the lower 25 percent as calm VN dialogue safety: low-detail projected floor, with no faces, eyes, hair clips, or pointing fingertip there; lower skirts and legs may continue behind the future dialogue overlay.
Style/medium: preserve Image 1's soft hand-painted watercolor anime linework and subdued luminous palette, while matching Images 2 and 3's spatially convincing booth construction and deep navy/cyan projection light. Maintain intimate student-made scale.
Text: none.
Constraints: change only the environment, physical lighting integration, and the minimum whole-group horizontal reposition needed for mobile face readability. No new scene beat. No new character. No portrait/mobile variant. No readable writing on the notebook or projection. No text, letters, numbers, logos, signage, UI, borders, black bars, or watermark.
Avoid: single giant flat world map wall; wallpaper look; white fantasy tunnel; infinite corridor; museum planetarium; corporate LED pavilion; huge stage truss; hologram; sci-fi machinery; pasted character cutouts; hard halos; face drift; hair-clip drift; costume drift; pose swap; missing notebook; malformed hands; extra fingers; duplicated limbs.
```

## Targeted correction R2 — one authorized edit

ROOT PMO ultimately fixed the production direction to one targeted edit of the initial landscape candidate. The temporary `object-position` proof exploration was withdrawn and is not an adoption path. The targeted built-in ImageGen edit was executed exactly once; no second generation, mobile-specific asset, portrait asset, alternate scene, or additional variant was produced.

### R2 output

- Candidate: `event-cg-festival-map-transition-v2-candidate-r2.png`
- Dimensions / format: 1672 × 941, RGB PNG
- SHA-256: `1702EABA7FDABF3B916C437743DBB3E2D0482D937E2090B7FA54598F6142438A`
- Built-in generated original:
  `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-68ac4cdd-9415-4a81-b81b-4538df79349b.png`

### R2 proofs and asset-only result

- PC 1440 × 810 centered cover:
  `event-cg-festival-map-transition-v2-candidate-r2-pc1440.png`
  - SHA-256: `1B22F1EB29B1DBE7127A047889EF9385C29FA4856018367709001445AF851B61`
  - Pass: the two-character composition, identities, left/right relationship, pointing action, notebook, curtains, pipes, projectors, all five projected surfaces, hall edges, and lower VN-safe floor remain readable and balanced.
- Mobile 390 × 844 centered cover:
  `event-cg-festival-map-transition-v2-candidate-r2-mobile390.png`
  - SHA-256: `88F618B5190A85F567B19F7876FC0C66672F5AAE855E376732A7126638C06A66`
  - ROOT PMO result: **GO**. There are no black bars. Mizuha's face and infinity clip and Amane's face and flower clip are clearly readable. Amane's outer head contour touches the right edge by a few pixels, but character recognition is intact and the owner did not require complete outer-contour visibility.
- No second generation is allowed or performed. R2 is fixed for the `festival_concept_076` combined integration; all other scene/cue/script/save/gallery data must remain unchanged.

### Full targeted correction prompt

```text
Use case: identity-preserve targeted compositing edit
Asset type: final PC/mobile-shared landscape visual-novel event CG candidate for festival_concept_076.
Primary request: Make exactly one targeted composition correction to Image 1. Reposition the existing two-character group horizontally into the central 22–25 percent of the same landscape canvas and scale the whole group down modestly so both complete faces, outer head contours, the infinity hair clip, and the flower hair clip are fully visible in a centered 390×844 CSS cover crop. Change only the character-group placement and uniform scale. Preserve the booth, projection, camera, lighting, and all other scene content from Image 1.
Input roles:
- Image 1 is the edit target and definitive five-surface booth, lighting, environment, PC composition, and current-character rendering base.
- Image 2 is the definitive original #0076 identity, clothing, left/right relationship, expression, pose, pointing gesture, notebook action, and watercolor-anime character reference.
Exact mobile-safe geometry: the centered mobile cover shows roughly the central 23 percent of the landscape source. Place the complete Mizuha head and infinity clip and the complete Amane head and flower clip entirely inside that central band with breathing room. Target face centers around 47 percent canvas width for Mizuha and 54 percent for Amane. Keep the two faces close enough to read as one explanatory pair but separate and unobstructed. Their complete outer head silhouettes and clips must stay approximately within 41–59 percent canvas width. Scale both characters together uniformly as one group; do not alter their relative height or proportions.
Character invariants: Preserve exactly the same two young women from Images 1 and 2. Mizuha remains on the left with the same long blue-gray hair, braided section, infinity hair clip, blue-gray eyes, white blouse, dark blue-green jumper dress, face, age, proportions, gentle expression, gaze, and same extended index-finger pointing pose. Amane remains on the right with the same short pale-blue bob, flower hair clip, blue eyes, pale-blue cardigan, white dress, face, age, proportions, expression, gaze, and the same open paper notebook held in both hands. Preserve their left/right order, relative height, clothing construction/colors, watercolor Japanese visual-novel style, and quiet explanatory relationship. The pointing arm and notebook should be brought toward the center naturally where possible, but full arm and full notebook visibility in mobile are not required. Do not redesign, swap, merge, or repaint their identities.
Environment invariants: Keep Image 1's approved modest student-scale black-curtain and rental-pipe booth completely unchanged: same curtain folds, exposed pipes, small physical projectors, entrance openings and exhibition-hall/coastal daylight edges. Keep the exact continuous ocean/cloud/temperature/CO2/current projection crossing the rear, both side walls, ceiling, and floor with the same corner geometry, floor distortion, physical blue/cyan spill, and map integration. No flat wallpaper, fantasy corridor, corporate LED exhibit, or hologram.
PC composition: On PC 2048/1440, maintain a deliberate explanatory two-shot balanced against the projected world map. The modestly smaller centered pair must not feel tiny or unnaturally crowded. Preserve the pointing gesture's clear relationship to the map and retain visible booth architecture around them.
VN safety: Preserve the calm lower 25 percent projected-floor dialogue-safe area. No faces, eyes, hair clips, or pointing fingertip in that lower quarter; skirts/legs may continue behind the future dialogue overlay.
Text: none.
Constraints: one horizontal landscape asset shared by PC and mobile. This is a correction of Image 1, not a new scene or alternate variant. No mobile-only asset, portrait layout, new character, new prop, changed pose, changed environment, added writing, letters, numbers, logo, signage, UI, border, black bar, or watermark.
Avoid: cropped head, cropped face, cropped infinity clip, cropped flower clip, face drift, costume drift, pose swap, missing notebook, malformed hand, extra fingers, distorted anatomy, changed projector booth, lost ceiling/floor plane, lost hall edge.
```
