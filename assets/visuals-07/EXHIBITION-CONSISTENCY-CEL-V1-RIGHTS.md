# Exhibition consistency cel v1: provenance and rights

- Production date: 2026-08-20
- Production method: OpenAI built-in ImageGen (`image_gen`)
- Use case: consistent seaside-festival backgrounds and visual-novel event CGs
- External source assets: none
- Third-party reference images: none
- Project references supplied to ImageGen: `novel-bg-festival-five-plane-projection-autumn-morning-v2.png`, the approved `mizuha-calm-07-v2.png` sprite and the approved `amane-calm-07-v3.png` sprite
- Post-processing: generated landscape rasters were normalized to 1672×941 lossless PNGs; dedicated portrait rasters were normalized to 941×1672 lossless PNGs
- Supersedes: the listed runtime and gallery visuals from `STORY-VISUAL-REDRAW-V2-RIGHTS.md` and `MOBILE-EVENT-CG-V1-RIGHTS.md`. Those files and records remain historical.

## Canonical visual rules

The approved five-plane booth is the single location authority: an outdoor seaside university festival in a clear autumn morning, with a black pipe-and-fabric projection booth on the left, painted coastal data across its planes, open sea and hills beyond, and a naturally attended public walkway on the right. Every MAP/GX variant changes only the projected scientific content. Ordinary visitors remain visible in the middle and far distance; no invented staff member, presenter, operator or foreground adult is added.

Mizuha and Amane retain their registered outfits, clips and hair silhouettes. Their visual-novel faces use youthful, childlike proportions while remaining the same university characters: large layered eyes, small noses and jaws, and approximately six-head, non-chibi bodies. Mizuha has long layered deep-ocean blue hair with a small side bun, wave/infinity clip and cyan reflected sheen. Amane has a short icy-blue bob, cloud clip, cyan reflected sheen and, only when her mouth is open, **one small canine on one side**. A second canine, paired vampire fangs and mature fashion-model facial proportions are prohibited.

The shared finish is clean Japanese visual-novel anime cel shading: soft cool-blue linework, two or three restrained shadow bands, pale pastel skin and selective cyan hair highlights. Prompts prohibited photorealism, painterly impasto, over-rendered individual hair strands, harsh bloom, glossy 3D rendering, mature redesigns, unknown staff, empty festival grounds, readable text, logos, signatures, watermarks and malformed hands.

## Prompt families

### Venue modes

Preserve the exact canonical booth geometry, camera side, autumn sky, sea, hills, public aisle and visitor density. Keep the lower quarter calm for the translucent dialogue UI. Replace only the five projection surfaces with the requested content: MAP 01 data provenance, GX ancient ocean, GX breathing points, GX temperature anomaly or the GX mode gateway. Render as a cohesive anime background with restrained morning light, never as a different hall or a photoreal exhibition photograph.

### Landscape event CGs

Use the canonical venue and the two approved character sprites as identity references. Compose Mizuha and Amane as youthful visual-novel heroines in clean cel shading, with complete heads and hands and no unrelated foreground people. The public festival remains attended in the background. Match the named story action: first encounter, Amane close-up, Mizuha close-up, map explanation, ESP32 collaboration, Mizuha handing over the invitation, curtain welcome or exhibition finale. Reserve the lower quarter for the dialogue UI.

### Portrait event CGs

Recompose the approved action for a 9:16 phone canvas rather than cropping it. Keep both complete faces, hair clips, hands and the story prop inside the portrait-safe upper and middle area. Keep the lower quarter low-detail for UI, and preserve environmental visitors without adding a staff member. Do not draw interface chrome, captions or decorative borders into the bitmap.

The ESP32, invitation and finale portrait outputs received a second ImageGen cleanup pass solely to remove accidental baked-in interface graphics while retaining the underlying characters and venue.

## Final assets

| Asset | ImageGen source | SHA-256 |
| --- | --- | --- |
| `novel-bg-map01-data-provenance-autumn-morning-v3.png` | `exec-4be19543-fda0-4d68-83a9-a099bb6d8583.png` | `90316d1300c7b5a19ed04eca347ad8bd702d476e2d5bb03e8ef207784160e206` |
| `novel-bg-gx-ancient-ocean-autumn-morning-v3.png` | `exec-00b93b98-04fe-468e-acba-3e28d9a3045e.png` | `f219a47c1b5d24ab780dedf492f807515b9ecc6a088f7d5f803fff584903699f` |
| `novel-bg-gx-breathing-points-autumn-morning-v3.png` | `exec-bddc1060-41d4-4311-a11d-0ce7c2e357bc.png` | `d468bdcead823a16b9847dce49c8945bf011b48c82ce9f933dfe6602f39ad0e7` |
| `novel-bg-gx-temperature-anomaly-autumn-morning-v3.png` | `exec-b64e6ff4-0987-4e5d-81dd-45cfc1b53569.png` | `f03f821c95cc0ccd4c3b62d1f5e7b08f8a0fb7c741fd2c210edb600b2ffd0050` |
| `novel-bg-gx-mode-gateway-autumn-morning-v4.png` | `exec-4bec18bb-cf44-4c8e-aec9-47cbc3ec1f5e.png` | `6cb628c79e74496fd7393c6844c0a0fd8d91e5bd682f5567065c5218fb826514` |
| `event-cg-first-encounter-five-plane-v3.png` | `exec-444e5747-6b03-4410-8c59-499dda083bc6.png` | `62984fd5ea1bbca86bf985be02c06b61d3680aae19ec2af932ae8dc4240efaa6` |
| `event-cg-amane-closeup-five-plane-v3.png` | `exec-04536dbe-8d0c-4f99-b344-322eba3770e5.png` | `ae7b03317515a741ae231d82be7be28076d44213c208f3c4c080439b499b16ea` |
| `event-cg-mizuha-closeup-five-plane-v3.png` | `exec-79c5b670-ee66-4da2-8376-a0ddbee4280c.png` | `440c8c71df5cc82a142994fc2757b24f2be874272a1067da9a9a5b872b946672` |
| `event-cg-festival-map-transition-five-plane-v3.png` | `exec-a9d4c495-c1fa-4ebd-9fca-13c183bb6d5b.png` | `9eae1fce4e79ce8d32961dce29c348fe1ed0df329e70684b2fdb1cde657ce380` |
| `event-cg-esp32-collaboration-v2.png` | `exec-6fc8dff4-560f-4b56-b0b8-38beae0dab34.png` | `9dac8e247d2fc37fc86b57a49be249c0cd73da84f02fe803d9c6f802c83c68fd` |
| `event-cg-circle-invitation-card-v3.png` | `exec-a96d1b72-6582-4132-83da-d515271f1011.png` | `0333bec3f7b6d0af5b3dca51913ede5f87dc30ffe81df28b4520bc1c7cb2f04b` |
| `event-cg-circle-welcome-v2.png` | `exec-42c82692-7138-4fd7-9da0-45287b9dfd47.png` | `525634c93527c677b8afa337e89a5d00ed46e1b64b349bfa123efb220ff7dfbd` |
| `event-cg-exhibition-finale-v2.png` | `exec-effad7da-c592-4262-896c-624c65c52051.png` | `343579e6a2af3cfbc8c1e2d1314dc852ef69d2a742e432f3f8ce7fa49fae2262` |
| `event-cg-first-encounter-five-plane-mobile-v2.png` | `exec-31bb3f53-55ee-42f5-ac86-ca56fbb39309.png` | `ab0c3e95f29f5392ed185a01761f0300eaee0d6f3e03f4c8f40c39553e711e47` |
| `event-cg-festival-map-transition-five-plane-mobile-v1.png` | `exec-4d2b8e55-a270-46a8-9e13-e670642ef2e8.png` | `eb601dd82f9e17ec68be869df9c28d1b67df4abbb18026cf080f96f7472a8091` |
| `event-cg-esp32-collaboration-mobile-v1.png` | `exec-435484d9-9a14-45b2-a4fe-e790a913d81b.png` | `1aa6b17e6aeca59ef4f102d58c4c30db773d68e2dcce33b8761ada52b097a061` |
| `event-cg-circle-invitation-card-mobile-v1.png` | `exec-3a20ee61-8278-4d2f-a20d-e483a092ee85.png` | `872f8d20ede2e8ccaa0413a9755f2e5ca33e7a39fa395bc89c6374d7842589cc` |
| `event-cg-circle-welcome-mobile-v1.png` | `exec-6397ed9b-0c8d-49c1-a06c-fd15453a60c1.png` | `ea8faebbfe367375e45bce4196d39e4ab437a4e789a114d1fad167316b409073` |
| `event-cg-exhibition-finale-mobile-v1.png` | `exec-84de4a3f-417f-41d8-a902-764bdb41ce72.png` | `8a807ffdebdd185e4eee52e20678444f95cf14b67770518fe424de9867590847` |

Generated sources are retained under `C:\Users\wdddi\.codex\generated_images\01a01d4d-0719-7a81-b2b0-2af1a600daed`.
