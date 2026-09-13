# GAIA SENSATION — Five-surface projection event CG candidates

Recorded: 2026-08-13 JST

> **Superseding PMO decision — portrait assets not adopted:** The three mobile-only
> portrait candidates and their proofs below are retained outside the repository for
> provenance only. They must not be copied into the repository or referenced by any
> cue, runtime path, preload/decode/reveal path, or gallery entry. The active candidates
> for both desktop and mobile are the three landscape R2 assets. Mobile presentation
> uses the same landscape assets with responsive `cover` and the smallest necessary
> `object-position` adjustment. Complete hand/connector/tablet visibility is not an
> acceptance requirement. Further ImageGen calls are prohibited.

## Workflow

- Tool: built-in ImageGen edit/compositing (`imagegen` skill)
- No post-generation text, logo, watermark, character retouching, or paint-over was added.
- Landscape PC/mobile files are deterministic centered `cover` crop previews only. The later mobile portrait candidates are separately generated assets; their `proof-390x844` files are deterministic centered `cover` previews.
- Repository implementation, commit, push, and deploy were not performed.

## Inputs

- First-encounter edit target: `C:\Users\wdddi\.codex\worktrees\6d6d\touch-prism-mvp\assets\visuals-07\event-cg-first-encounter-v1.png`
- Amane close-up edit target: `C:\Users\wdddi\.codex\worktrees\6d6d\touch-prism-mvp\assets\visuals-07\event-cg-amane-closeup-v1.png`
- Mizuha close-up edit target: `C:\Users\wdddi\.codex\worktrees\6d6d\touch-prism-mvp\assets\visuals-07\event-cg-mizuha-closeup-v1.png`
- Five-surface booth reference: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-9ee38223-fb34-4159-9f90-6d1dcc3b598f.png`

All local inputs and the two user display screenshots were inspected with `view_image` at original detail before generation.

## Outputs

All candidates are 1672 × 941 PNG.

| Cue | Candidate | Built-in generated original | SHA-256 |
|---|---|---|---|
| `festival_concept_015–020` | `event-cg-first-encounter-v2-candidate.png` | `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-60860fe5-f133-4510-a191-2b24b65b8cfc.png` | `AA6F1D41D038FF73ADCE6A8364B7210425292B5A7C650A27C4454B99C2837B07` |
| `festival_concept_021–022` | `event-cg-amane-closeup-v2-candidate.png` | `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-4dca4719-24f3-4107-abcc-b92b4b2cb4b2.png` | `E61CC3CD3A13E9C32A6786BA0C577161A74FB1205C6C77A03A860E98E793E260` |
| `festival_concept_023–026` | `event-cg-mizuha-closeup-v2-candidate.png` | `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-ed33d37a-9054-4d6c-ae54-b8ff8a03d532.png` | `A8FAD687BF60549D9AF6A021C602D8A3A26552A2500A43921788D631E74AFFA0` |

The first wide draft before targeted spacing correction is preserved at:
`C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-607599c8-22c6-4e0a-b3d0-fc1e60d093c1.png`

## Prompt 1 — first-encounter initial edit

```text
Use case: compositing
Asset type: 16:9 visual-novel event CG, replacement candidate for festival_concept_015–018
Input images: Image 1 is the edit target and definitive character/style/composition reference. Image 2 is the definitive five-surface projection booth environment reference.
Primary request: Rebuild Image 1 so the two existing characters stand naturally just inside the open entrance of the small five-surface projection booth from Image 2. Remove the old pegboard, paper maps, taped sheets, wooden table, cup, and tabletop terminal completely. Replace them with a believable student-built approximately 4-meter booth made from black curtains and ordinary rental pipe framing, with one continuous projection across the rear wall, left wall, right wall, ceiling, and floor.
Character invariants — preserve at very high fidelity from Image 1: Amane remains on the left, with the same long blue-gray hair, side braid, infinity hair clip, blue eyes, young-student age, body proportions, dark blue-green jumper dress over the same white blouse, and the same welcoming right-hand gesture. Mizuha remains on the right, with the same short pale-blue bob, white flower hair clip, blue eyes, young-student age, body proportions, pale-blue cardigan over the same white dress, relaxed posture and expression. Preserve both faces, hairstyles, eyes, clothes, pose language, relative height, left/right order, delicate anime painterly linework, and quiet warmth. Do not redesign either character.
Scene/backdrop: the booth is modest and plausible for students, not a corporate installation. The entrance remains visibly open. At the far left and far right edge, retain a narrow glimpse of the convention hall and seaside daylight beyond. Projected Earth, cloud systems, ocean currents, atmosphere and fine observation lines flow continuously around corners across all five surfaces; seams and perspective must read physically.
Composition/framing: 16:9 landscape. Place both characters close together near the booth entrance, still left/right, so both complete faces sit within the central 24 percent of image width and remain readable in a centered portrait 390px cover crop. Keep heads and shoulders in the upper-middle, neither face cropped, with their relationship and Amane's guiding hand readable. Preserve generous clean lower 25 percent as visual-novel dialogue-text safety area: no faces, hands, important booth details, or focal highlights in that bottom quarter.
Lighting/mood: deep blue projected light and reflected cyan/white patterns must wrap physically onto hair, cheeks, white sleeves, Mizuha's pale clothing, Amane's dark clothing, and the floor. Keep faces bright and legible with soft warm skin tones. Integrate subjects into the projected space; no pasted-background look, no hard cutout halos.
Style/medium: same polished soft Japanese visual-novel anime illustration style as Image 1, refined painterly textures, cinematic but intimate student exhibition scale.
Text: none.
Constraints: no character design changes; no extra characters inside the booth; no pegboard; no paper map; no printed sheets; no table; no terminal; no visible text; no letters; no logo; no watermark. Preserve the full image as a standalone CG without game UI.
Avoid: corporate LED walls, giant truss stage, holograms, sci-fi machinery, luxury expo booth, neon signage, distorted hands, duplicated limbs, merged characters, illegible faces.
```

## Prompt 2 — first-encounter targeted iteration

```text
Use case: identity-preserve targeted compositing edit
Asset type: final candidate for the same 16:9 visual-novel first-encounter event CG
Input images: Image 1 is the first edited candidate and must remain the base for booth, five-surface projection, lighting and overall finish. Image 2 is the definitive original-character identity/pose/style reference. Image 3 is the booth construction reference.
Primary request: Make one targeted composition correction only: move the two preserved characters closer together toward the horizontal center so both complete faces, both hair clips, shoulders and Amane's welcoming right-hand gesture survive a centered 390px portrait cover crop. Keep everything else from Image 1.
Exact composition target: Amane remains on the left and Mizuha remains on the right. Place Amane's face center at approximately 45% of image width and Mizuha's face center at approximately 56% of image width; both faces fully inside the central 22% of the canvas. Their near shoulders may overlap slightly in depth but their bodies and faces must remain clearly separate. Amane's open guiding right hand stays naturally between them, below their faces and above the lower-quarter boundary. Frame both from roughly mid-torso upward; the unimportant lower body may extend behind the lower safety region, but place no face, hair clip, guiding hand, or focal projection highlight in the bottom 25%.
Character invariants: preserve exactly the same Amane on left—long blue-gray hair, braid, infinity clip, blue eyes, dark blue-green jumper dress, white blouse, same age/body proportions, expression and welcoming right-hand gesture—and the same Mizuha on right—short pale-blue bob, white flower clip, blue eyes, pale-blue cardigan, white dress, same age/body proportions, expression and relaxed pose. Do not swap, redesign, merge, resize disproportionately, or change their faces, hairstyles, clothes, colors, gaze or pose language.
Environment invariants: keep the modest student-scale black-curtain and rental-pipe booth, open entrance, narrow hall/seaside glimpses at the outer edges, and continuous deep-blue projection across rear/left/right/ceiling/floor with Earth, clouds, ocean currents, atmosphere and observation lines. Preserve coherent cyan/blue projected light wrapping over hair, skin, white cloth, dark cloth and floor. Faces remain warm and readable.
Style/medium: identical soft polished Japanese visual-novel anime illustration and painterly finish as Images 1 and 2.
Text: none.
Constraints: change only character spacing/framing needed for central mobile crop and lower text safety; no old pegboard, maps, table or terminal; no extra people inside; no text, letters, logo, watermark or UI.
Avoid: corporate LED walls, stage truss, holograms, sci-fi machinery, character redesign, duplicated limbs, malformed hands, merged silhouettes, cut faces.
```

## Prompt 3 — Amane close-up

```text
Use case: identity-preserve compositing
Asset type: 16:9 visual-novel event CG close-up for festival_concept_021–022, paired with the first-encounter five-surface projection CG set
Input images: Image 1 is the edit target and definitive Amane identity, expression, pose, close-up framing, clothing and art-style reference. Image 2 is the definitive five-surface projection booth environment reference.
Primary request: Keep Amane from Image 1 at very high fidelity and replace only the obsolete exhibit environment with the interior of Image 2's modest student-built five-surface projection booth.
Character invariants: Amane is the same short-haired young student with the same pale-blue bob, same white flower hair clip, same blue eyes, gentle blush, small calm smile, face shape, age, body proportions, pale-blue cardigan, white dress/blouse and blue neck ribbon. Preserve her three-quarter close-up, head tilt, gaze toward the viewer, shoulder angle, and her right hand lightly holding the same blue cable/connector gesture. Keep the hand natural and readable; no extra fingers. Do not redesign her.
Scene/backdrop: remove all pegboard, printed maps, paper panels, desktop equipment, monitor and outdoor-dominant old background. She is just inside a believable approximately 4-meter student booth made from black curtains and ordinary rental pipe framing. The rear, left, right, ceiling and floor carry one continuous deep-blue projection of Earth, cloud systems, ocean currents, atmosphere and fine observation lines that bend correctly across corners. A narrow open-entrance edge may reveal soft convention-hall/seaside daylight, but the projection booth must be the dominant setting. No control terminal is visible; the cable may exit frame toward a modest hidden controller.
Composition/framing: retain the intimate shoulder-and-face close-up. Center Amane's face, flower clip, collar and cable-holding hand tightly enough that all remain visible in a centered 390px portrait cover crop. Her face and eyes occupy the central visual focus. Reserve the lower 25 percent as visual-novel text safety area: no eyes, face, flower clip, fingers, connector, or essential booth detail there.
Lighting/mood: coherent blue projection light and moving cyan/cloud reflections wrap around the contour of her bob, flower clip edge, cheek, cardigan folds, white collar, fingertips and cable. Keep skin warm and eyes/clip clearly readable. The subject must feel inside the projection, not pasted over it; soft bounce light, contact light and atmospheric integration.
Style/medium: exactly the same refined soft Japanese visual-novel anime illustration and painterly finish as Image 1, matched to the other two CGs in this set.
Text: none.
Constraints: one character only; preserve Amane identity, expression, outfit, hand action and framing; no pegboard; no paper map; no printed sheets; no visible terminal; no text; no letters; no logo; no watermark; no UI.
Avoid: corporate LED panels, stage truss, hologram, sci-fi machinery, luxury expo styling, pasted cutout halo, face drift, hairstyle drift, costume drift, extra fingers, malformed cable.
```

## Prompt 4 — Mizuha close-up

```text
Use case: identity-preserve compositing
Asset type: 16:9 visual-novel event CG close-up for festival_concept_023–026, paired with the first-encounter five-surface projection CG set
Input images: Image 1 is the edit target and definitive Mizuha identity, expression, pose, tablet, close-up framing, clothing and art-style reference. Image 2 is the definitive five-surface projection booth environment reference.
Primary request: Keep Mizuha from Image 1 at very high fidelity and replace only the obsolete exhibit environment with the interior of Image 2's modest student-built five-surface projection booth.
Character invariants: Mizuha is the same long-haired young student with identical blue-gray hair, braided sections, infinity hair clip, blue eyes, gentle blush, small welcoming smile, face shape, age, body proportions, dark blue-green jumper dress over the same white blouse, and pale neck bow. Preserve the same close three-quarter framing, head angle, gaze toward the viewer, flowing hair silhouette, and both hands holding the same thin dark tablet against her torso. Keep the tablet, fingers and grip natural and readable; no extra fingers. Do not redesign her.
Scene/backdrop: remove all pegboard, printed maps, paper panels, tabletop terminal and outdoor-dominant old background. She is just inside a believable approximately 4-meter student booth made from black curtains and ordinary rental pipe framing. The rear, left, right, ceiling and floor carry one continuous deep-blue projection of Earth, cloud systems, ocean currents, atmosphere and fine observation lines that bend correctly across corners. A narrow open-entrance edge may reveal soft convention-hall/seaside daylight, but the projection booth must dominate. No other equipment or furniture.
Composition/framing: retain the intimate face, hair and upper-torso close-up. Center Mizuha's face, infinity hair clip, bow, both hands and the tablet close enough that all essential elements remain visible in a centered 390px portrait cover crop. Keep the tablet near the central body axis without changing her holding pose. Her face and eyes are the central focus. Reserve the lower 25 percent as visual-novel text safety area: no eyes, face, hair clip, fingers, tablet top edge, or essential booth detail there.
Lighting/mood: coherent blue projection light and moving cyan/cloud reflections wrap around braids, loose hair strands, infinity clip edge, cheek, white blouse, dark jumper dress, fingers and tablet edges. Keep skin warm and eyes/clip readable. Add soft reflected highlights on the tablet, with no screen text. The subject must feel physically inside the projection, not pasted over it.
Style/medium: exactly the same refined soft Japanese visual-novel anime illustration and painterly finish as Image 1, matched to the other two CGs in this set.
Text: none.
Constraints: one character only; preserve Mizuha identity, expression, outfit, tablet pose and framing; no pegboard; no paper map; no printed sheets; no tabletop terminal; no text; no letters; no logo; no watermark; no UI.
Avoid: corporate LED panels, stage truss, hologram, sci-fi machinery, luxury expo styling, pasted cutout halo, face drift, hairstyle drift, costume drift, missing tablet, extra fingers, malformed hands.
```

## Crop validation

- PC preview: centered cover crop at 1440 × 810.
- Mobile preview: centered cover crop at 390 × 844.
- PC passes for all three candidates.
- Mobile does not pass the stated invariant set:
  - First encounter: Mizuha's face is cut at the right edge.
  - Amane close-up: cable-holding hand and connector are outside the crop.
  - Mizuha close-up: tablet and hand are outside the crop.
- No candidate is approved for repository integration until PMO/new 01/new 02 resolve the mobile framing requirement.

## R2 additional targeted edits

New 01 authorized one additional built-in ImageGen targeted edit per asset. No new scenario wording or rescue-line content was introduced into the images or cue plan.

| Cue | R2 candidate | Built-in generated original | SHA-256 |
|---|---|---|---|
| `festival_concept_015–020` | `event-cg-first-encounter-v2-candidate-r2.png` | `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-0883c923-3a2a-41df-86d0-8b4456227bf1.png` | `B6B51146DF739B3150F5C0D126E53EB5F85F471EC788BA74DE65E09D272A1C10` |
| `festival_concept_021–022` | `event-cg-amane-closeup-v2-candidate-r2.png` | `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-4115ba34-d1f9-4b77-88cf-9129a7245c9d.png` | `F7A0EAACACA94DC8D52FFBDC626ECB5A2A5535BA433319B71194D3E06A5EA967` |
| `festival_concept_023–026` | `event-cg-mizuha-closeup-v2-candidate-r2.png` | `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-21607138-bd8d-4a22-ad08-fb1d200c3e62.png` | `0AD34C323B01A9F51E3BAB9A7F7D30A2DD2BE3F99A30B4E9657717BF8E1E3544` |

## Prompt 5 — first-encounter R2

```text
Use case: identity-preserve targeted compositing edit
Asset type: final 16:9 visual-novel first-encounter event CG for festival_concept_015–020
Input images: Image 1 is the current five-surface-booth candidate and must remain the base environment/lighting. Image 2 is the definitive original character identity, clothes, left/right order and pose reference. Image 3 is the definitive booth construction reference.
Primary request: Perform one precise reframing edit so the complete faces, hair clips, shoulders and relationship of both characters fit inside a centered 390×844 portrait cover crop while the 16:9 PC composition stays natural. Do not change their identities or the booth.
Exact mobile-safe composition: the centered portrait cover crop shows roughly the central 26% of this landscape image. Put every essential element inside the central 22%: both entire heads and hair clips, both faces with breathing room, both near shoulders, and the long-haired left character's welcoming open right hand. Place the long-haired left character's face center around 47% of canvas width and the short-haired right character's face center around 55%; reduce their horizontal face gap substantially. Frame them as a natural close two-shot from upper torso/chest upward, standing shoulder-to-shoulder near the entrance. The left character remains visibly left and the right character visibly right. Slight shoulder overlap in depth is allowed, but never merge bodies or hair. Keep the left character's open palm between their chests, compact and fully above the lower-quarter boundary.
Character invariants: preserve the long-haired left character exactly—same blue-gray hair, braid, infinity clip, blue eyes, face, young-student age, dark blue-green jumper dress, white blouse, expression, gaze and welcoming hand pose. Preserve the short-haired right character exactly—same pale-blue bob, white flower clip, blue eyes, face, young-student age, pale-blue cardigan, white dress, expression, gaze and relaxed pose. Preserve relative height and original anime design; no swapping, redesign or costume change.
PC balance: on 1440×810, the two-shot should feel intentionally intimate, not tiny and not overcrowded. Leave visible five-surface projection booth around them and a narrow open entrance/hall/seaside trace at outer edges.
Environment/lighting invariants: keep the student-scale black curtains, ordinary rental pipes, open entrance, and one continuous deep-blue Earth/cloud/ocean-current/atmosphere/observation-line projection across rear, both side walls, ceiling and floor. Keep physically coherent cyan/blue light wrapping over hair, cheeks, white clothes, dark clothes and floor while faces remain warm and readable.
VN safety: the bottom 25% must be calm dialogue-safe space with no face, hair clip, open guiding hand or focal projection highlight. Lower torsos may continue behind the future text overlay.
Style/medium: same polished soft Japanese visual-novel anime illustration and painterly finish as the inputs.
Text: none.
Constraints: no pegboard, paper maps, table, terminal, printed material, extra characters inside the booth, text, letters, logo, watermark or UI.
Avoid: corporate LED wall, giant stage truss, hologram, sci-fi machinery, distorted hands, extra fingers, duplicated limbs, merged characters, cropped faces, identity drift.
```

## Prompt 6 — Amane close-up R2

```text
Use case: identity-preserve targeted compositing edit
Asset type: final 16:9 visual-novel Amane close-up event CG for festival_concept_021–022
Input images: Image 1 is the current five-surface-booth Amane candidate and must remain the base environment/lighting. Image 2 is the definitive original Amane identity, expression, outfit and cable-holding action reference. Image 3 is the definitive booth construction reference.
Primary request: Perform one precise reframing edit so Amane's complete face, flower hair clip, upper torso, cable-holding hand, fingers and connector all fit inside a centered 390×844 portrait cover crop while the 16:9 PC composition remains a natural close-up.
Exact mobile-safe composition: the portrait cover crop shows roughly the central 26% of this landscape image. Put all essential elements inside the central 22%. Scale Amane slightly smaller into a medium close-up from head to mid-torso. Center her face at approximately 48% of canvas width. Preserve the cable-holding gesture but bend her right elbow closer to her torso and lift the same connector beside her right collarbone/shoulder, around 56% of canvas width, so the flower clip, full face, hand, fingers and connector form one compact vertical group within the central 22%. The cable curves downward and exits frame without connecting to visible equipment. Do not hide, remove or change the hand action.
Character invariants: preserve the exact short pale-blue bob, white flower clip, blue eyes, face shape, blush, calm smile, head tilt, gaze, young-student age, pale-blue cardigan, white blouse/dress, blue neck ribbon, body proportions and delicate anime design from Image 2. Keep the same hand identity and connector type. No redesign or costume change.
PC balance: on 1440×810, Amane remains a clear intimate close-up, not tiny; booth projection and open entrance remain visible around her. Avoid an awkward empty half-screen by balancing the Earth projection behind her shoulder.
Environment/lighting invariants: preserve the modest black-curtain/rental-pipe five-surface booth with continuous Earth/cloud/ocean-current/atmosphere/observation-line projection across rear, sides, ceiling and floor. Keep blue/cyan projection light wrapping over hair, flower clip, cheeks, cardigan, white collar, hand, fingers and cable while skin and eyes remain warm/readable.
VN safety: bottom 25% is dialogue-safe; keep face, eyes, hair clip, hand and connector entirely above it. Lower torso may continue behind the future text overlay.
Style/medium: exactly the same soft polished Japanese visual-novel anime illustration and painterly finish as the inputs.
Text: none.
Constraints: one character only; no visible pegboard, maps, paper, terminal, monitor, furniture, text, letters, logo, watermark or UI.
Avoid: corporate LED wall, stage truss, hologram, sci-fi machinery, missing hand, cropped connector, extra fingers, malformed cable, face drift, hair drift, clothing drift, pasted cutout halo.
```

## Prompt 7 — Mizuha close-up R2

```text
Use case: identity-preserve targeted compositing edit
Asset type: final 16:9 visual-novel Mizuha close-up event CG for festival_concept_023–026
Input images: Image 1 is the current five-surface-booth Mizuha candidate and must remain the base environment/lighting. Image 2 is the definitive original Mizuha identity, expression, outfit, tablet and hand pose reference. Image 3 is the definitive booth construction reference.
Primary request: Perform one precise reframing edit so Mizuha's complete face, infinity hair clip, upper torso, tablet and both tablet-holding hands all fit inside a centered 390×844 portrait cover crop while the 16:9 PC composition remains a natural close-up.
Exact mobile-safe composition: the portrait cover crop shows roughly the central 26% of this landscape image. Put every essential element inside the central 22%. Scale Mizuha slightly smaller into a medium close-up from head to mid-torso. Center her face around 48% of canvas width. Keep the exact thin dark tablet and two-handed holding action, but bring the tablet vertically close against the center of her chest, with tablet center around 53% of canvas width. Both hands and fingers wrap naturally around its left and right lower/side edges inside the central 22%; do not push either hand toward the outer landscape edge. Place the infinity clip, full face, bow, tablet top edge and both hands as one compact vertical composition. Preserve her head tilt and direct gentle gaze.
Character invariants: preserve the exact long blue-gray hair, braid structure, loose flowing strands, infinity hair clip, blue eyes, face shape, blush, soft smile, young-student age, dark blue-green jumper dress, white blouse, pale-blue bow, proportions and anime design from Image 2. Preserve the same tablet object and calm holding pose. No redesign, haircut, costume change or missing hand.
PC balance: on 1440×810, Mizuha remains a polished intimate close-up rather than a tiny figure; her long hair may fan outward for visual richness while all required mobile-safe elements remain central. Balance the Earth projection behind her shoulder.
Environment/lighting invariants: preserve the modest black-curtain/rental-pipe five-surface booth with continuous Earth/cloud/ocean-current/atmosphere/observation-line projection across rear, sides, ceiling and floor. Keep blue/cyan projected light wrapping over braids, hair edges, infinity clip, cheek, white blouse, dark jumper dress, fingers and tablet rim while skin and eyes remain warm/readable. Tablet screen stays dark with soft reflection and no text.
VN safety: bottom 25% is dialogue-safe; keep face, eyes, clip, both hands and tablet top/recognizable silhouette above it. Lower torso/tablet bottom may continue behind the future text overlay.
Style/medium: exactly the same soft polished Japanese visual-novel anime illustration and painterly finish as the inputs.
Text: none.
Constraints: one character only; no pegboard, maps, paper, terminal, monitor, furniture, text, letters, logo, watermark or UI.
Avoid: corporate LED wall, stage truss, hologram, sci-fi machinery, missing tablet, missing hand, cropped fingers, extra fingers, malformed grip, face drift, hair drift, clothing drift, pasted cutout halo.
```

## R2 crop validation

- PC 1440 × 810: all three R2 candidates pass composition, character identity, five-surface projection continuity, lighting integration, and dialogue-area balance.
- Historical mobile QA result before the corrected acceptance criteria: the 390 × 844 centered cover did not satisfy the temporary strict complete-prop-visibility requirement.
  - First encounter: the short-haired character's outer face/head remains cut at the right edge.
  - Amane close-up: face and flower clip pass; the outer edge of the cable-holding hand/connector remains cut.
  - Mizuha close-up: face and infinity clip pass; the tablet's right edge and right hand remain cut.
- Superseding corrected acceptance: the temporary requirement to show the full connector/hand/tablet was withdrawn. Under the corrected criteria, all three R2 landscape assets have asset-only GO for both desktop and mobile: `cover` has no black bars and the faces/hair clips remain identifiable. They are eligible for combined integration, but no repository integration or combined/public GO is recorded here.

## Mobile portrait candidates — withdrawn / provenance only

These assets were produced under a temporary PMO policy that was later withdrawn as an unauthorized internal-QA requirement. They are recorded here only to preserve generation history. They are not adopted assets and must remain outside the repository. The active desktop/mobile candidates are the R2 landscape assets above.

| Cue | Mobile portrait candidate | Dimensions | Built-in generated original | SHA-256 |
|---|---|---:|---|---|
| `festival_concept_015–020` | `event-cg-first-encounter-mobile-v2-candidate.png` | 853 × 1844 | `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-d4ac7369-fd15-4542-921f-27503f00b298.png` | `9FC1E295B4883A475096A735782A9C2435B6A31777B690B2791C99EB95380925` |
| `festival_concept_021–022` | `event-cg-amane-closeup-mobile-v2-candidate.png` | 852 × 1846 | `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-5ecd7ab6-7ec4-4929-a51d-14a609ed51d2.png` | `21C7F353D31E401E35C203C9FA9E7B461749F50FD833F536878BF98C573CD98F` |
| `festival_concept_023–026` | `event-cg-mizuha-closeup-mobile-v2-candidate.png` | 853 × 1844 | `C:\Users\wdddi\.codex\generated_images\019fe602-6284-7bb0-9b31-7dd9f965ca03\exec-2c712cfc-74e4-472c-bec6-f4f7a57867f2.png` | `48E371B7BE57EA5036DB1F9926CFB93716F8952ABE2447E320BC8140A8FB1613` |

## Prompt 8 — first-encounter mobile portrait

```text
Use case: identity-preserve compositing
Asset type: GAIA SENSATION visual novel event CG, mobile-only portrait asset for festival_concept_015–020.
Primary request: Recompose the exact same first-encounter moment from Image 1 onto a newly designed very tall portrait canvas intended for a 390×844 viewport. This must be a true portrait composition designed from the beginning, never a crop, squeeze, warp, or simple rescale of the landscape image.
Input images: Image 1 is the sole character-identity, costume, pose, expression, age, visual-style, and scene-moment anchor. Image 2 is the five-surface projection booth architecture and atmosphere anchor.
Scene/backdrop: The same student-scale roughly 4 m booth made from black curtains and ordinary rental pipes, with continuous blue projection across rear, both side walls, ceiling, and floor. Earth, clouds, ocean currents, atmospheric and observation lines flow naturally around corners. The entrance remains open, with only a subtle edge glimpse of the school venue and seaside atmosphere. No corporate LED wall, stage truss spectacle, or hologram.
Subjects: Preserve exactly the two girls from Image 1. On the left, the same long blue-gray-haired girl with braid, infinity-shaped hair clip, blue-gray eyes, white blouse, dark blue-green jumper dress, and her same gently guiding right-hand gesture. On the right, the same short pale-blue bob-haired girl with flower hair clip, blue eyes, white dress/blouse and pale-blue cardigan. Preserve their faces, hairstyles, eye shapes and colors, proportions, body types, age, clothing construction and colors, expressions, gaze relationship, left/right placement, pose, and refined anime illustration style. Do not swap or redesign them.
Composition/framing: very tall 390:844 portrait composition, approximately 9:19.5. Compact natural two-shot from head through shoulders and waist. Both complete heads, every outer hair contour, both hair clips, both faces, both shoulders, the left girl's guiding hand, and their relationship must sit fully inside the central mobile-safe region with generous side margins. Place the pair close enough together to read as one encounter but do not overlap faces. Important anatomy and gestures remain above the lower 25% VN text-safe zone; reserve the bottom quarter primarily for projected floor/negative space. Keep the characters centered and no edge-touching. The final must survive exact 390×844 cover with zero black bars.
Lighting/mood: physically integrated blue projection light wraps around hair edges, cheeks, white fabric, dark dress, cardigan, hand, and floor while faces remain clearly readable and natural skin tones survive.
Constraints: Same scene and exact instant as Image 1; character fidelity is more important than novelty. Portrait-only re-layout. No new story beat, no protagonist-rescue content, no added characters or props. No text, lettering, numbers, logos, signage, UI, borders, black bars, or watermark.
Avoid: cut heads, clipped faces, cropped hair clips, missing shoulders, cropped guiding hand, separated characters, distorted anatomy, extra fingers, character swap, redesigned outfit, pegboard, paper map, tabletop terminal, outdoor-dominant background, futuristic corporate display, hologram, illegible projections.
```

## Prompt 9 — Amane mobile portrait

```text
Use case: identity-preserve compositing
Asset type: GAIA SENSATION visual novel event CG, mobile-only portrait asset for festival_concept_021–022.
Primary request: Recompose the exact same Amane close-up moment from Image 1 onto a newly designed very tall portrait canvas intended for a 390×844 viewport. This must be a true portrait composition designed from the beginning, never a crop, squeeze, warp, or simple rescale of the landscape image.
Input images: Image 1 is the sole character-identity, costume, expression, pose, cable/connector, visual-style, and scene-moment anchor. Image 2 is the five-surface projection booth architecture and atmosphere anchor.
Scene/backdrop: The same student-scale roughly 4 m booth made from black curtains and ordinary rental pipes, with continuous blue projection across rear, both side walls, ceiling, and floor. Earth, clouds, ocean currents, atmospheric and observation lines flow around the booth corners. Keep a subtle open-entrance edge, never an outdoor-dominant setting. No corporate LED wall, stage truss spectacle, or hologram.
Subject: Preserve exactly the same short pale-blue bob-haired girl from Image 1: same young face, blue eyes, flower-shaped hair clip, pale-blue cardigan, white blouse/dress, ribbon, body proportions, age, soft expression and refined anime illustration style. Preserve the same action: she holds the same blue cable connector naturally beside her upper body. The complete connector tip, cable segment, every finger, the entire holding hand and wrist must be anatomically correct and fully visible. Do not redesign her or replace the connector.
Composition/framing: very tall 390:844 portrait close-up, approximately 9:19.5. Frame her complete head, full outer hair contour, flower hair clip, face, shoulders and upper torso, with the connector-holding hand and connector clearly visible beside the face/shoulder. Put all critical elements inside the central mobile-safe region with generous side margins: no hair, flower clip, face, connector, fingers, hand or wrist may touch or cross an edge. Important elements remain above the lower 25% VN text-safe zone; reserve the bottom quarter primarily for projected floor/negative space. Center the character and hand as one compact readable silhouette. The final must survive exact 390×844 cover with zero black bars.
Lighting/mood: physically integrated blue projection light wraps around hair, face contour, cheek, white fabric, cardigan, hand, connector and cable while skin tone, eyes and flower clip remain readable.
Constraints: Same scene and exact instant as Image 1; character and prop fidelity are more important than novelty. Portrait-only re-layout. No new story beat, no protagonist-rescue content, no added characters or props. No text, lettering, numbers, logos, signage, UI, borders, black bars, or watermark.
Avoid: clipped hair, cropped flower clip, cut connector, cropped fingers/hand/wrist, hidden cable, distorted anatomy, extra fingers, redesigned costume, tablet, pegboard, paper map, tabletop terminal, outdoor-dominant background, corporate display, hologram.
```

## Prompt 10 — Mizuha mobile portrait

```text
Use case: identity-preserve compositing
Asset type: GAIA SENSATION visual novel event CG, mobile-only portrait asset for festival_concept_023–026.
Primary request: Recompose the exact same Mizuha close-up moment from Image 1 onto a newly designed very tall portrait canvas intended for a 390×844 viewport. This must be a true portrait composition designed from the beginning, never a crop, squeeze, warp, or simple rescale of the landscape image.
Input images: Image 1 is the sole character-identity, costume, expression, pose, tablet, visual-style, and scene-moment anchor. Image 2 is the five-surface projection booth architecture and atmosphere anchor.
Scene/backdrop: The same student-scale roughly 4 m booth made from black curtains and ordinary rental pipes, with continuous blue projection across rear, both side walls, ceiling, and floor. Earth, clouds, ocean currents, atmospheric and observation lines flow around the booth corners. Keep the same intimate booth interior, not an outdoor-dominant setting. No corporate LED wall, stage truss spectacle, or hologram.
Subject: Preserve exactly the same long blue-gray-haired girl from Image 1: same young face, blue-gray eyes, long flowing hair, braided section, infinity-shaped hair clip, white blouse, ribbon, dark blue-green jumper dress, body proportions, age, gentle expression and refined anime illustration style. Preserve the same action: she holds the same dark tablet vertically with both hands in front of her upper body. The entire tablet silhouette, all four tablet edges and corners, both complete hands, every visible finger and both wrists must be anatomically correct and fully visible. Do not redesign her or replace the tablet.
Composition/framing: very tall 390:844 portrait close-up, approximately 9:19.5. Frame her complete head, full outer hair contour, infinity hair clip, face, shoulders and upper torso together with the whole tablet and both holding hands. Put every critical element inside the central mobile-safe region with generous side margins: no hair, infinity clip, face, tablet edge/corner, finger, hand or wrist may touch or cross an edge. Keep the full tablet compactly centered below her face, both hands symmetrically readable. Important elements remain above the lower 25% VN text-safe zone; reserve the bottom quarter primarily for projected floor/negative space. The final must survive exact 390×844 cover with zero black bars.
Lighting/mood: physically integrated blue projection light wraps around hair, face contour, cheek, white blouse, dark dress, tablet edges and both hands while skin tone, eyes, infinity clip and tablet silhouette remain readable.
Constraints: Same scene and exact instant as Image 1; character and prop fidelity are more important than novelty. Portrait-only re-layout. No new story beat, no protagonist-rescue content, no added characters or props. No text, lettering, numbers, logos, signage, UI, borders, black bars, or watermark.
Avoid: clipped hair, cropped infinity clip, cut tablet edge/corner, cropped fingers/hands/wrists, hidden second hand, distorted anatomy, extra fingers, redesigned costume, cable connector, pegboard, paper map, tabletop terminal, outdoor-dominant background, corporate display, hologram.
```

## Mobile portrait proof validation

- Proof transform: deterministic centered CSS-equivalent `cover` into exactly 390 × 844; no padding, contain mode, or black bars.
- `event-cg-first-encounter-mobile-v2-candidate-proof-390x844.png`
  - SHA-256: `4FA67AEEF3F9ED5EC4E3D952A6D4F97BE5D86881629338E6FD393EAA70A36CAF`
  - Pass: both complete faces and outer head contours, both hair clips, shoulders, left/right relationship, and guiding hand are visible.
- `event-cg-amane-closeup-mobile-v2-candidate-proof-390x844.png`
  - SHA-256: `B1ABB046BEBEF0F9396EA8164CF71A765F794F0167872AB0ED2F278F9BFCA767`
  - Pass: complete face and flower clip, connector tip, cable segment, holding hand, fingers, and wrist are visible.
- `event-cg-mizuha-closeup-mobile-v2-candidate-proof-390x844.png`
  - SHA-256: `838990B449C399AF79946249A300ED7A7378DAA824D279691033EDF45F354B6E`
  - Pass: complete face and infinity clip, all four tablet edges/corners, both hands, fingers, and wrists are visible.
- All three preserve the same five-surface booth, blue physical projection light, approved character/costume design, and corresponding R2 scene moment. No text, logo, watermark, UI, protagonist-rescue line, or new scenario content is present.
- Repository integration remains forbidden until visual acceptance; no repository asset, cue, gallery, save, script, commit, push, or deploy was changed.
