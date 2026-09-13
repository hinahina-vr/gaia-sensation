# Exhibition apple color correction: provenance and rights

- Production date: 2026-08-11
- Production method: OpenAI built-in ImageGen color study followed by a deterministic local color correction of the project-owned source asset
- External source assets: none
- Third-party reference images: none
- Intended use: `assets/visuals-07/novel-bg-exhibition-v3.png`
- Scope: change only the small apple on the GAIA SENSEWARE exhibit table from artificial cyan-blue to a natural blue-green / pale-green apple

## Source asset

- Base commit: `d1e5ed0e09c3658f3718f06710c82400156ff02f`
- Original asset SHA-256: `d482e1772e8d24694e04f85368cf58b3f69e2c08be288187ec689459bc8d2762`
- Original git blob: `fbaa1cb3a82ffd653851256c41d7f13e9b95b870`
- Dimensions and format: 1672 x 941 pixels, RGB PNG

## ImageGen color study

- Generator: OpenAI built-in ImageGen (`image_gen`)
- Generated source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-4218fb68-ec48-42b9-b882-661bc38a1dfc.png`
- Prompt record: edit only the small blue apple on the exhibit table into a believable Japanese green apple with muted blue-green to pale-green skin; retain its original shape, stem, highlight, surface wear, shadow, anime / painterly treatment, composition, lighting, dimensions and crop; do not change any other object, person, text, wall, map, table, terminal or background area.
- Adoption note: the complete ImageGen frame was not shipped because it lightly re-rendered unrelated background pixels. It was used only as a color and apple-shape study.

## Final local correction

- Final asset SHA-256: `566986e4afe553742d467986b81027a33933f08fd79f5ff9632f831fee53d829`
- Final git blob: `cbf5f8ca4abf849dbe1ee27e2c08176d7a7f65da`
- Final dimensions and format: 1672 x 941 pixels, RGB PNG
- Changed-pixel count: 667
- Exact changed-pixel bounding box: x=965..994, y=581..608
- Local processing: the selected original cyan skin pixels were remapped into a restrained green hue range while preserving the original per-pixel luminance, shading, highlight variation and surface texture. No pixel from the ImageGen study was copied into the final asset.
- Preserved unchanged: canvas size, crop, composition, wall, map, table, terminal, people, lighting, apple stem, cast shadow and every pixel outside the apple-skin bounding box.
