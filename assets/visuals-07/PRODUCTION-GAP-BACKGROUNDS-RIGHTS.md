# Production year dedicated backgrounds: provenance and rights

- Production date: 2026-08-09
- Production method: OpenAI built-in ImageGen (`image_gen`). Station and venue-preparation backgrounds are independent generations. Return-train and used-electronics backgrounds are targeted edits of this task's own superseded generated drafts.
- External source assets: none.
- Third-party reference images: none.
- Post-processing: none. Final RGB PNG files were copied byte-for-byte from the built-in ImageGen output directory.
- Common output: 1672 x 941 pixels, RGB PNG, 16:9 visual-novel environment background, no people, no UI, no watermark, no readable brand or location text.
- Adoption boundary: use only for the listed `production_year` step ranges. Do not use these assets as fallback for other scenes.
- Self-contained bundle: the final four PNGs and this ledger are complete relative to parent `6ea4e6e18f71d207c31c77665689da77373cea35`.
- Superseded bundle: `cbd4749b9420e3c2dae414d7920241035d1843b5` is not a final adoption commit. Its station and venue-preparation blobs are retained unchanged here; its return-train and camera-store blobs are excluded.

## Station meeting

- Asset: `novel-bg-production-station-meeting-v1.png`
- Intended steps: `production_year_170` through `production_year_174`
- Story time/place: 2026-02-21 morning, near the ticket gates of a small coastal Japanese station, before and during the three-person reunion.
- SHA-256: `70314dfacc70d4e8a1d99fd218cef40294bdfe41992802aa6706b778aacba028`
- ImageGen source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-75e6a1d1-e73f-4a14-9e8d-1aa8f560b989.png`
- Final prompt:

```text
Use case: stylized-concept
Asset type: Japanese visual novel game environment background
Primary request: a dedicated background for a February morning scene where three online-school students meet near a station ticket gate, but show the environment only with no people
Scene/backdrop: a contemporary small coastal Japanese commuter station concourse near the ticket gates, clear cold morning on 2026-02-21; broad glass wall and an opening toward pale blue winter sky and a distant hint of the sea; ticket gates, timetable display shapes without legible writing, ticket machine silhouettes, station clock, handrails, tiled floor, a quiet waiting area
Style/medium: high-quality hand-painted anime background art for a soft visual novel, delicate clean linework, painterly cel shading, subtle watercolor texture, believable architecture, restrained detail matching a polished Japanese romance/adventure game; definitely illustration, not a photo, not 3D
Composition/framing: 16:9 wide landscape, eye-level, generous open floor and visual breathing room around the center and sides for character sprites, strong depth through the gates, important scene information above the lower quarter because a dialogue window will cover the bottom
Lighting/mood: crisp cool winter morning, gentle blue-white daylight through glass, soft long shadows, calm anticipation before a reunion
Color palette: luminous coastal blues, soft gray, pale warm sunlight, low-to-medium saturation
Constraints: absolutely no people or character silhouettes; no readable station name; no readable text; no logos; no watermark; no captions; no UI; no borders; no visual-novel dialogue box; coherent real-world Japanese station geometry
Avoid: photorealism, live-action photo texture, cinematic 3D render, glossy AI concept-art look, fisheye distortion, clutter, abandoned station, construction scene, festival decorations
```

## Return train at night

- Asset: `novel-bg-production-return-train-v1.png`
- Intended steps: `production_year_195` through `production_year_199`
- Story time/place: 2026-02-21 from 19:18 through 20:03, fully after sunset, inside the local coastal train after leaving the shared workroom.
- SHA-256: `3160135fef99316a8855797e4153c02bb9236169bed6b5b4e5f354a0a34dbcaf`
- ImageGen source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-3d110815-4d9f-4e3f-a905-adaf8f3597ec.png`
- Edit target used only as this task's internal source: superseded blue-hour draft, SHA-256 `9e3d63b1d3ce218251830df6f8dc9d1d9cff59f376af8d6b66ae6e3a30f78d68`.
- Final prompt:

```text
Use case: lighting-weather
Asset type: Japanese visual novel game environment background
Input images: Image 1 is the edit target and approved composition
Primary request: change only the time-of-day lighting and outside sky of Image 1 so the scene unmistakably occurs between 19:18 and 20:03 on February 21 in Japan
Scene/backdrop: preserve the same Japanese coastal local-train interior, empty blue bench, hanging straps, poles, rack, doors, wide window, coastline and sea
Lighting/mood: fully after sunset at night; remove every trace of orange, pink or sunset glow from the sky; outside is a dark navy winter night with a nearly black sea, scattered warm lights along the coast, subtle moving reflections, and clearly visible warm carriage-light reflections on the window glass; calm intimate return journey
Style/medium: preserve the exact hand-painted anime/painterly visual-novel style, linework, cel shading, watercolor texture and geometry of Image 1
Color palette: deep navy and indigo outside, warm cream carriage light, muted blue seat, tiny amber shoreline lights
Constraints: change only exterior time-of-day and corresponding light/reflections; keep camera angle, train geometry, bench shape, doors, window, straps and composition unchanged; no people or silhouettes; no readable text; no logos; no watermark; no UI; no dialogue box
Avoid: blue hour, twilight, sunset, orange horizon, pink clouds, daylight, cyberpunk neon, photorealism, 3D rendering, structural changes, extra objects
```

## Venue preparation and check

- Asset: `novel-bg-production-venue-prep-v1.png`
- Intended steps: `production_year_233` through `production_year_238`
- Story time/place: 2026-05-24 morning, a professional coastal convention hall before public opening, while the route, reception devices and fixtures are checked.
- SHA-256: `bb4f25c414048b41e85ddfd971b183ea5cd110cd686a9128de7c9e4bc405e098`
- ImageGen source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-390fd1df-2a02-4d8d-85ae-60be16f12099.png`
- Final prompt:

```text
Use case: stylized-concept
Asset type: Japanese visual novel game environment background
Primary request: a dedicated pre-opening exhibition hall background for checking visitor flow, reception equipment and fixture hardware on the morning of 2026-05-24, environment only with no people
Scene/backdrop: a large professional coastal convention hall in Japan, comparable in scale to Makuhari Messe, before public opening; tall steel truss ceiling, polished concrete floor, orderly booth frames and pegboard panels still being prepared, a clearly defined reception/check-in zone with compact tablet kiosks and cable covers, blue floor-route tape and queue stanchions, labeled-looking but unreadable equipment cases, clamps and fastening hardware arranged neatly on a worktable; a large industrial loading-bay opening reveals bright sea and morning sky in the distance
Style/medium: high-quality hand-painted anime background art for a soft visual novel, delicate clean linework, painterly cel shading, subtle watercolor texture, believable architecture and equipment, restrained polished detail matching a Japanese visual-novel background; definitely illustration, not a photo, not 3D
Composition/framing: 16:9 wide establishing view at eye level, spacious and monumental rather than a classroom or school festival; reception/check-in equipment in the middle distance, fixture-check table to one side, clear open route through the center for character sprites; important scene cues above the lower quarter because a dialogue window will cover the bottom
Lighting/mood: cool clear May morning, shafts of coastal daylight, calm purposeful preparation, organized and nearly ready, not abandoned
Color palette: steel blue, muted cyan, off-white, pale wood, silver hardware, bright ocean blue accents
Constraints: absolutely no people or character silhouettes; no readable logos, brand names or text; no watermark; no captions; no UI; no borders; no dialogue box; professional exhibition venue scale; coherent reception devices, cables, clamps and booth fixtures
Avoid: live-event crowd, completed busy exhibition, school classroom, gymnasium festival, construction chaos, cardboard-box clutter, photorealism, live-action texture, cinematic 3D render, glossy AI concept-art look, futuristic sci-fi terminal, luxury corporate booth
```

## Used PC / AV / electronics store

- Asset: `novel-bg-production-used-equipment-store-v1.png`
- Intended steps: `production_year_239` through `production_year_247`
- Story time/place: 2026-07-18 afternoon, a secondhand PC/AV/electronics shop where the group selects one exhibition terminal, two speakers and three spare cables while checking terminal ports, production age, replaceable parts and display reflections.
- SHA-256: `71f62f31e55ad49bd8ed8a45049f4a26ffe5fbc2f3677bb007a4ef27cd20fd27`
- ImageGen source: `C:\Users\wdddi\.codex\generated_images\019fe20b-7ae5-77e3-8b97-cd897107aa96\exec-7e9ee75f-48cd-424f-8007-4dba35e2e767.png`
- Edit target used only as this task's internal source: superseded off-center electronics-store draft, SHA-256 `0b03c95cc3531c9eab27760578841292c23ddcc7a272bd67f4f163fb7d91d74c`. The earlier camera-store draft, SHA-256 `654a32e82516b55ab052d11af3b5c7f902ca2b1254b91355737983030c060240`, is also excluded.
- Intermediate scene-correction prompt that produced the off-center electronics-store draft:

```text
Use case: precise-object-edit
Asset type: Japanese visual novel game environment background
Input images: Image 1 is the edit target for architecture, coastal window, warm wood palette and anime/painterly rendering only
Primary request: transform Image 1 from a camera-specialist shop into a believable Japanese secondhand PC, AV and electronics shop where three students choose one exhibition terminal, two speakers and three spare cables
Scene/backdrop: preserve the warm coastal-town shop shell, wooden shelving, glass counter, central aisle, inspection bench, July afternoon light, side window with blue sky and a small strip of sea; replace most camera displays with used monitors, compact desktop terminals, mini PCs, tablets, small left/right bookshelf speakers, audio interfaces, cable and adapter bins, power strips, chargers and replacement parts
Subject: on the main inspection counter, show one candidate black-screen monitor/terminal at a slight angle so warm shop-light reflections are visible on its anti-glare screen; nearby show the rear of a second compact terminal clearly enough to recognize HDMI/USB/power-style port shapes without labels; place a matched pair of small speakers to the left and right; neatly coil several cables and adapters beside a power strip; keep cameras only as a small secondary group on one upper shelf
Style/medium: preserve high-quality hand-painted anime background art, delicate clean linework, painterly cel shading, subtle watercolor texture, believable everyday electronics geometry; definitely illustration, not a photo, not 3D
Composition/framing: preserve a 16:9 wide eye-level shop view and open central aisle for character sprites; inspection counter and black-screen terminal are the focal point above the lower quarter because a dialogue window covers the bottom; surrounding shelves communicate a mixed used-electronics store at a glance
Lighting/mood: warm practical July afternoon, soft ceiling/store lights reflected in black screens, inviting and modest, careful inspection rather than luxury retail
Color palette: warm honey wood, coastal blue accents, charcoal and silver electronics, soft cream light
Constraints: remove the camera-store dominance; include monitor/terminal, visible rear ports, two speakers, cable/adapter/power items and inspection bench; cameras occupy no more than one small shelf; no people, hands or silhouettes; no readable brands, logos, prices, model names or text; no watermark; no captions; no UI; no dialogue box
Avoid: camera-specialist store, rows of cameras and lenses, generic computer showroom, brand-new luxury devices, pawn-shop grime, chaotic e-waste piles, futuristic sci-fi equipment, malformed screens or ports, photorealism, 3D rendering, glossy AI concept-art look
```

- Final 390px crop-centering prompt:

```text
Use case: precise-object-edit
Asset type: Japanese visual novel game environment background
Input images: Image 1 is the edit target
Primary request: preserve the used PC/AV/electronics shop, all objects, lighting, palette and anime/painterly style, but reposition the main inspection-counter grouping so the black-screen monitor/terminal, its left and right speakers, rear-port mini terminal, coiled cables/adapters and power strip are centered horizontally in the image
Composition/framing: the complete inspection grouping must fit inside the central 25 percent of the 16:9 frame so it remains clearly visible in a 390-pixel-wide center crop; keep shop shelves and glass cases around it as context, with open visual breathing room to either side for desktop character sprites; keep all essential scene cues above the bottom quarter used by the dialogue window
Invariants: keep the coastal window, July afternoon light, warm wooden architecture, used monitors/terminals on shelves, electronics bins, small secondary camera shelf, coherent object geometry and exact hand-painted anime visual-novel rendering
Constraints: change only the horizontal placement and counter layout needed to center the focal equipment group; do not turn it back into a camera shop; no people, hands or silhouettes; no readable brands, logos, prices or text; no watermark; no UI; no dialogue box
Avoid: focal monitor at far right or far left, cropped speakers, missing cables, camera-store dominance, photorealism, 3D rendering, futuristic showroom, cluttered e-waste
```
