# Amane style v3: provenance and rights

- Production date: 2026-08-20
- Production method: OpenAI built-in ImageGen (`image_gen`)
- Use case: transparent visual-novel character sprites
- External source assets: none
- Third-party reference images: none
- Project references supplied to ImageGen: the owner-approved Amane close-up (`codex-clipboard-18cf4310-901e-41a7-bc60-24a0ebd0c18d.png`) and the existing `amane-*-07-v2.png` project sprites
- Post-processing: two opaque checkerboard outputs were passed through ImageGen background extraction; no character retouching was requested. Final PNGs retain 1024×1536 RGBA canvases with transparent corners.

## Art direction

The owner-approved close-up is authoritative for face design, variable cool-blue line weight, cyan reflected hair light, layered blue-violet/amber eyes, soft peach skin transitions and restrained pastel cel shading. The existing v2 sprites supplied the outfit, approximately six-head body scale and expression intent. Prompts prohibited named-artist imitation, photorealism, chibi proportions, thick black outlines, plastic 3D shading, text, logos and watermarks.

## Final assets

| Asset | ImageGen source | SHA-256 | Expression |
| --- | --- | --- | --- |
| `amane-calm-07-v3.png` | `exec-b298a26c-db36-4824-942a-55aaf03d47c2.png` | `9446b50bdc40129ea6e66366dfe5113f38d09169f8aa3c81e10895c1202eb074` | Warm open smile with a small visible fang. |
| `amane-soft-07-v3.png` | `exec-afbe7126-28a3-42ae-8f9a-188415e4d7a9.png` | `52cb37ac00b874c2147beff4d77e03f912b3841ddc90b3fa823b34c743bdeef3` | Gentle smile with hands gathered near the ribbon. |
| `amane-startled-07-v3.png` | `exec-23242962-cf45-4854-ab1b-f7eb7cc91e4a.png` | `d19ea0b9943d994348ec9fe19314b4dee3e19e251b5eda5c9e54a8fb2ef536eb` | Cute surprised reaction; background-extracted final. |
| `amane-exasperated-07-v3.png` | `exec-ed8682f6-d9a0-4aba-a085-48baf2bb19a1.png` | `2954830f515b4b1b3953770993dcb316c71fe7d0f7038637c18728c366ec408a` | Mildly exasperated hand-on-hip reaction; background-extracted final. |

Generated sources are retained under `C:\Users\wdddi\.codex\generated_images\01a018de-1f19-7d80-b301-ee77d2125e38`.
