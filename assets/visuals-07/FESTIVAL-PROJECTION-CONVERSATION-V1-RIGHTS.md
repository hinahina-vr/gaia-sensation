# Festival projection conversation v1: provenance and rights

- Production date: 2026-08-13
- Production method: OpenAI built-in ImageGen (`image_gen`)
- Use case: `illustration-story` / `precise-object-edit`
- External source assets: none
- Third-party reference images: none
- Intended use: festival conversation background, `festival_concept_027` through `festival_concept_076` only
- Excluded use: MAP and all non-`festival_concept` scenes keep their existing assets
- Typography: no generated or post-generation text, logo, sign, watermark, Web, CSS, SVG, or canvas text overlay is present.

## Final asset

- Asset: `assets/visuals-07/novel-bg-festival-projection-conversation-v1.png`
- Dimensions: 1672 x 941 pixels, RGB PNG
- SHA-256: `ce49de5053c65361b0e06fbcab99bb2aa18d4f4ead2a84584022d5fffeaed4e7`
- Selected ImageGen source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-967c7053-b1d3-4324-b2f4-cff6eda47c98.png`
- Post-processing: none. The project PNG is copied byte-for-byte from the selected built-in generation.

## Generation lineage

1. Conversation-wide source (`v1`, not selected):
   - Path: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-8b1d2831-9fca-4585-9f51-aaa08bd241f1.png`
   - Dimensions: 1671 x 941 pixels, RGB PNG
   - SHA-256: `041a3d3c81505668bcfb0203a9c239bf6f1dc4c445c062ae6c99ed57f1b4c349`
   - Result: PC composition passed, but the centered mobile cover crop clipped the Earth and the booth's right side. It is not the project asset.
2. Centered/mobile-safe correction (`v2`, final):
   - Path, dimensions, and SHA-256 are listed above.
   - Result: both curtain edges, the whole Earth, all five projected surfaces, and an exhibition-hall edge remain inside the centered 390 x 844 cover crop while the PC conversation foreground remains open.

## Conversation-wide prompt (`v1`)

```text
Use case: illustration-story / precise environment continuity redesign
Asset type: wide visual-novel conversation background, anime/painterly university-festival exhibition hall
Input roles:
- Image 1 is the obsolete background only. It shows what must NOT remain: an empty quiet seaside gallery/private room with hanging blue art, a single PC table, chair, bookshelf, potted plants, household decor, and too much empty floor. Do not preserve this room design.
- Image 2 is the canonical space, style, lighting, and installation reference. It is the approved student-built black-curtain five-plane projection-mapping booth in the coastal festival hall. Preserve its identity and painterly anime art direction.

Primary request:
Create a new wide conversation background set a few meters beside the SAME five-plane projection booth, inside the SAME large, busy coastal university festival exhibition hall. The camera has stepped sideways and slightly back from Image 2, creating a natural open area where the story characters can talk while the immersive booth remains unmistakably present in the middle distance.

Required spatial continuity:
- The same modest student-scale booth remains clearly visible in midground, positioned slightly off-center so it does not occupy the character overlay zone.
- It must retain simple rental pipe framing, black blackout curtains, an open non-projected entrance, and the recognizable five-surface projection across back wall, both side walls, ceiling, and floor.
- Through the open entrance, show the embedded Earth and continuous ocean-current, cloud, atmosphere, rainfall, waveform, map-contour, sensor-node projection. Let tasteful blue/cyan light spill onto nearby floor and curtain folds.
- Do NOT depict the projected title or any other readable text in this conversation background. No logo, no signage, no watermark.
- Keep the booth intimate and student-built, not a corporate pavilion, no giant truss, no LED wall, no hologram.

Exhibition-hall context:
- Clearly the same bright seaside large exhibition hall, not a separate room.
- Show high industrial ceiling trusses, broad hall depth, neighboring handmade student booths, simple exhibition tables, cables/cases, and small anonymous visitor groups.
- The sea and bright coastal daylight are visible through the hall opening or glazing in the background.
- Convey a lively but believable university festival: moving small groups, warm human energy, layered depth.
- Visitors stay small and anonymous, with no readable faces. No main story character is baked into the art.

Conversation composition and UI safety:
- This is a background behind character sprites and dialogue, not an event CG.
- Keep the central foreground and the common left/center/right sprite lanes clear of people, furniture, posts, signs, and high-contrast clutter. Use an open clean aisle/floor as breathing room.
- Put anonymous crowds and neighboring booths mainly in the midground/background edges.
- Preserve a low-detail, low-contrast lower 25 percent for the VN dialogue window.
- The projection booth must remain identifiable on PC 2048, PC 1440, and a centered 390×844 CSS cover crop. Keep its entrance, dark curtain, Earth projection, and at least three projected planes within the central crop.
- The centered mobile crop should still read “busy coastal exhibition hall beside an immersive student projection booth,” while leaving room for the dialogue UI.

Remove entirely:
- quiet empty gallery mood
- hanging blue art sheets
- solitary PC/laptop desk
- folding chair
- bookshelf and books
- potted plants / household decor
- residential, classroom, studio, meeting-room, or private-room cues
- large vacant unused seating area

Style and rendering:
- Match Image 2 exactly: soft luminous Japanese visual-novel anime environment art, painterly watercolor/cel finish, structurally convincing exhibition architecture, deep navy/cyan projection against bright blue-white coastal daylight.
- Balanced contrast; atmospheric perspective; no photorealistic filter, no 3D-render look, no excessive neon/cyberpunk.
- No identifiable people, no story-character sprite, no readable text, no logos, no brands, no watermark, no black bars.
Output: one 1672×941 RGB PNG-style landscape background.
```

## Mobile-safe correction prompt (`v2`, final)

```text
Use case: precise-object-edit
Asset type: wide visual-novel conversation background, anime/painterly coastal university-festival exhibition hall
Input image: the approved PC composition for the same-hall conversation background beside the five-plane projection booth.

Make one targeted composition correction for the centered 390×844 CSS cover crop:
1. Move the entire black-curtain projection booth horizontally to the exact center of the source image.
2. Scale the complete booth down uniformly by approximately 18 percent. Preserve its proportions and student-built scale.
3. The central 26 percent of source width must contain BOTH left and right black-curtain entrance edges, the complete Earth silhouette, complete left wall, complete right wall, back wall, ceiling projection, and floor projection. Nothing in that list may be cut off by the centered mobile crop.
4. The full open booth entrance must read as one enclosed five-surface projection-mapping installation. Maintain continuous ocean currents, clouds, atmospheric arcs, waveform lines, map contours, sensor nodes, and cyan light across both side walls, back wall, ceiling, and floor.
5. Keep the Earth centered inside the booth and entirely visible. No text, no title, no logo.
6. Preserve the PC-wide conversation composition: keep generous uncluttered foreground and open floor for character sprites, retain the bright coastal hall, sea view, high ceiling trusses, neighboring student booths, anonymous small crowds, and hall depth on both sides. Rebalance those surrounding elements naturally around the newly centered smaller booth.
7. Preserve the lower 25 percent as low-detail VN dialogue safe area.
8. No story characters, no close identifiable faces, no furniture or crowd in the center foreground, no quiet private-room cues, no PC desk, no chair, no bookshelf, no plants, no hanging gallery art, no corporate pavilion, no LED wall, no hologram, no watermark, no black bars.
9. Match the source’s painterly Japanese visual-novel anime style and deep navy/cyan projection against bright blue-white coastal daylight.

Mobile acceptance: a centered 390×844 cover crop must clearly show both curtain edges, the whole Earth, both side-wall corners, the back wall, ceiling, and floor while still retaining a thin readable indication of the surrounding exhibition hall.
Output: one 1672×941 RGB PNG-style landscape background.
```
