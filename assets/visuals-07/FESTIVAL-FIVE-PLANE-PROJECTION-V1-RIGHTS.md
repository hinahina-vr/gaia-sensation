# Festival five-plane projection v1: provenance and rights

- Production date: 2026-08-13
- Production method: OpenAI built-in ImageGen (`image_gen`)
- Use case: `precise-object-edit` / `text-localization`
- External source assets: none
- Third-party reference images: none
- Intended use: `festival_concept_010` through `festival_concept_012` only
- Excluded use: `festival_concept_013` and `festival_concept_014` retain `novel-bg-exhibition-v3.png`
- Typography: the English and Japanese title is part of the generated projected image. No Web, CSS, SVG, canvas, font rendering, or other post-generation text overlay was used.

## Final asset

- Asset: `assets/visuals-07/novel-bg-festival-five-plane-projection-v1.png`
- Dimensions: 1672 x 941 pixels, RGB PNG
- SHA-256: `92e56f13f120f4a260ec4c4e361222d9169199f736ef30854d7985b4b8e726d7`
- Selected ImageGen source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-9ee38223-fb34-4159-9f90-6d1dcc3b598f.png`
- Selected source dimensions: 1671 x 941 pixels, RGB PNG
- Selected source SHA-256: `ed4402a47af6aaad0c17e984e690357a3e99847f8642fc8147ef4303f63b594d`

## Generation lineage

1. Five-plane projection source (`v5`):
   - Path: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-d8ce0340-d4db-4ceb-8927-ec21a009c7ae.png`
   - Dimensions: 1671 x 941 pixels, RGB PNG
   - SHA-256: `97b778d2f19c73c4aa110ad7758a19336137603ad206336830b02ef4d7023926`
   - Result: the back, left, right, ceiling, and floor projections were accepted. Its centered 390 x 844 cover crop clipped the title, so it was not selected.
2. Mobile-safe focal correction (`v6`, final selected ImageGen source):
   - Path and hashes are listed above.
   - Result: the same five projected surfaces remain visible while the complete English and Japanese title and the Earth stay inside the centered mobile crop.
3. One-pixel canvas normalization:
   - The 1671 x 941 selected ImageGen source was placed at `(0, 0)` on a 1672 x 941 RGB canvas.
   - Its rightmost source column, source `x=1670`, was duplicated once at destination `x=1671`.
   - No resampling, recoloring, retouching, compositing, typography replacement, or other pixel editing was performed.

## Five-plane projection prompt (`v5`)

```text
Use case: precise-object-edit
Asset type: visual-novel environment background, anime/painterly convention-hall background
Input image: the currently approved student-built black-curtain exhibition booth inside a bright coastal university festival hall. Preserve the same hall, sea view, crowd scale, daytime, camera angle, painterly anime rendering, booth footprint, simple rental pipe frame, black curtains, and open front entrance.

Primary change: redesign ONLY the experience inside the booth as a true five-surface projection-mapping installation. The open front entrance is NOT projected. The five projected surfaces are exactly: back wall, left wall, right wall, ceiling, and floor. Make the viewer immediately understand that the imagery wraps continuously around those five physical planes. Show clear wall corners, ceiling seam, and floor plane, while one flowing environmental visualization crosses those seams with correct perspective and light spill.

Creative direction:
- intimate student-made installation, approximately 4m wide × 3m deep × 2.4m high, not an enterprise booth, no giant truss, no LED wall, no hologram
- black blackout curtains create a dark little room with the front open
- use modest student equipment: several discreet compact short-throw projectors or small projection housings placed/rigged safely near the upper edges; believable projected light cones may be faintly visible
- immersive content is a continuous Earth-observation environment: a large Earth is integrated into the back-wall field, while ocean currents, cloud bands, rainfall traces, atmospheric layers, waveform lines, sensor nodes, contour lines, and softly glowing particles flow from the Earth across both side walls, ceiling, and floor
- the Earth must feel embedded in the projected data environment, not pasted on and not floating as a hologram
- the projected floor should catch moving-like bands of ocean current and dots; the ceiling should carry cloud/atmosphere arcs; side walls carry sensor graphs and map contours
- cyan and deep blue projection light softly illuminates curtain folds and the room entrance; avoid loud neon and cheap cyberpunk styling
- the outside festival hall and sea remain bright and painterly, creating an exciting contrast with the small dark immersive room

Projected typography:
- typography must exist physically INSIDE the projected image, generated as part of the projection mapping; do not leave space for later Web/CSS text
- exact text, no extra words:
  GAIA
  SENSEWARE
  地球の声、聴いてみませんか
- place the exact three-line lockup on the back wall, somewhat below or beside the Earth but fully readable through the open entrance
- match the GAIA SENSATION website: refined high-contrast editorial serif similar to Georgia/Times for English, restrained Japanese Mincho similar to Yu Mincho / Noto Serif JP for Japanese; light-to-regular weight, elegant spacing, no corporate sans serif
- make the lettering follow the back-wall projection perspective and inherit subtle projected texture/light falloff so it feels projected, not pasted on
- keep it compact enough for center cover crop at 390px but large enough to read

Composition:
- the open entrance frames the five-plane mapped interior
- preserve a clean lower visual-novel text safe area; no essential typography or Earth edge in the bottom-most 18 percent
- central 390px cover crop must retain the open booth, readable exact title, Earth, at least three clearly visible projected planes, and the floor/ceiling continuity
- PC wide crop must retain the coastal hall context and anonymous small festival visitors
- no main character, no identifiable face, no legible third-party brand, no watermark, no black bars

Preserve everything else unless required to make the five-surface mapping physically coherent.
Output: one 1672×941 RGB PNG-style painterly background.
```

## Mobile-safe title correction prompt (`v6`, final)

```text
Use case: precise-object-edit / text-localization
Asset type: visual-novel environment background, anime/painterly student festival projection-mapping booth
Input image: the approved five-surface projection-mapping booth. Preserve the hall, open non-projected entrance, black curtains, pipe frame, small projectors, the five projected planes (back, left, right, ceiling, floor), all continuous cloud/ocean/sensor imagery, lighting, visitors, sea, camera, rendering style, and lower VN-safe region exactly.

Change ONLY the Earth-and-title focal grouping on the back wall:
1. Move the Earth and the complete three-line projected title lockup leftward so the complete lockup is centered on the source-image center line. The entire exact title must fit within source x=690 through x=980. This is essential for a centered 390×844 CSS cover crop.
2. Reduce the English lockup to about 72 percent of its current width, preserving its refined high-contrast Georgia/Times-like serif design.
3. Keep the Japanese line proportionally more readable: make it about 90 percent of its current height and place it directly below SENSEWARE with clear breathing room. Use restrained Yu Mincho / Noto Serif JP-like Mincho forms.
4. Preserve exact text with no omissions, substitutions, extra punctuation, or additional words:
GAIA
SENSEWARE
地球の声、聴いてみませんか
5. Keep all three lines horizontally centered together and entirely readable. The title must look like projected light following the back-wall perspective and subtle curtain/screen texture, never a Web/CSS overlay.
6. Shift and, if needed, modestly reduce the Earth so its meaningful globe silhouette remains centered behind/above the lockup and visible within the same mobile crop. The Earth remains embedded in the surrounding projected observation field, not a hologram.
7. Do not alter or weaken the visible five-plane continuity: ceiling cloud vortex, left/right sensor flows, back wall, and floor ocean-current lines must remain connected across physical corners.
8. No other change. No PC, no LED wall, no corporate truss, no new furniture, no people inside the booth, no watermark, no black bars.

Mobile acceptance framing: a centered 390×844 cover crop of the 1672×941 output must show the complete words GAIA and SENSEWARE, the complete Japanese line, a recognizable Earth, the back/left/right walls, ceiling, and floor. Do not solve this by adding text after generation; all typography must be generated as physical projection.
Output: one 1672×941 RGB PNG-style painterly background.
```
