# Story visual redraw v2: provenance and rights

- Production date: 2026-08-20
- Production method: OpenAI built-in ImageGen (`image_gen`)
- Use case: original visual-novel event CG, key art and environment illustration
- External source assets: none
- Third-party reference images: none
- Project image references supplied to ImageGen: none
- Rejected predecessor supplied to ImageGen: **no**
- Post-processing: generated rasters were normalized to 1672×941. Five runtime WebP targets were encoded at quality 94; PNG targets use lossless PNG encoding.
- Supersedes: the listed files in `ILLUSTRATION-V8-RIGHTS.md` and `AUTUMN-MORNING-FESTIVAL-BACKGROUNDS-V1-RIGHTS.md`. Those documents remain as historical records only.

## Art direction

All 36 assets were generated independently from text. The rejected straight-on, symmetric blue exhibition image was inspected only to identify the files that needed replacement and was never passed to ImageGen. The new set uses asymmetrical three-quarter views, foreground occlusion, varied camera height, physical student-built equipment, a populated seaside university festival and clear early-autumn morning light. It explicitly excludes centered shrine-like stages, giant glowing globes, circular HUD rings, generic corporate holograms, empty halls and screen-swap reuse of one booth.

Named characters follow the project design registry: Mizuha has long wavy deep-ocean hair, a wave clip and a navy/teal jumper outfit; Amane has a pale sky-blue bob, cloud clip, yellow-blue reflected eyes, pale cardigan and a small visible canine when smiling. Both are adult university students with natural youthful proportions around six heads tall, never chibi. The shared finish is high-end 2020s Japanese bishoujo visual-novel art with organic pressure-sensitive lines, restrained cel shading, soft gouache/colored-pencil texture and selective highlights rather than generic glossy rendering.

Every prompt prohibited readable text, letters, numbers, logos, signatures, watermarks, photorealism, 3D rendering and malformed hands. Background prompts also reserved a calm lower quarter for the dialogue UI and retained a center-safe story cue for mobile cover crops.

## Final assets

| Asset | ImageGen source | SHA-256 | Scene brief |
| --- | --- | --- | --- |
| `event-cg-festival-map-transition-five-plane-v2.png` | `exec-f29ee4eb-ea88-4c31-9d82-e6aa64fd67c3.png` | `191548edc687bd13167fbb8051382e244ec0baa045305d2f80d0955713376e12` | Mizuha and Amane explain a physical map projection from an oblique aisle view. |
| `event-cg-first-encounter-five-plane-v2.png` | `exec-25bedcd2-ea66-4ecb-9836-9541e1142991.png` | `973828ebd5492793dbbfa1938dc9db17dd68649bd76eb79bbf50fe28262a8d2d` | Visitor-eye first encounter at an active booth threshold. |
| `event-cg-amane-closeup-five-plane-v2.png` | `exec-bc7222aa-af93-40ea-8c86-a49fd12d532f.png` | `484e717473011c20095439c4734a302893b4aca8c786717e439746690a079207` | Amane turns from a cable table in a side-angle close-up. |
| `event-cg-mizuha-closeup-five-plane-v2.png` | `exec-92420120-cb18-4c11-8c64-1c0e421c7bb4.png` | `8c30befac59efa86c3e35472881e5243b01987a107d177eeaf5531fe5094ed54` | Mizuha looks over a tablet from an oblique high angle. |
| `event-cg-esp32-collaboration-v1.png` | `exec-ce4a2685-7f20-4c5d-81d0-13cfcb9310a4.png` | `bc057bb723e9f79c990777c3bff3be86196fe9720aa55b53ced422a925888292` | Two heroines and viewer hands collaborate around a real sensor board. |
| `event-cg-circle-invitation-card-v2.png` | `exec-3e6232a3-c514-4ce1-9086-a7657e8b4c3e.png` | `04c631338a496b0de06660357cfa0c5967ec8595aeafaa7a4f8e45ce9c5c7c26` | Amane offers a textless handmade invitation from a corridor angle. |
| `event-cg-circle-welcome-v1.png` | `exec-0c383e4b-99e8-4077-95c1-c1d50a394179.png` | `0d191c928ccd36c4d0e1d38ff0eaff32ede4e204aa98972759aaf918bb79d1f1` | Mizuha opens the curtain while Amane welcomes the visitor inside. |
| `event-cg-exhibition-finale-v1.png` | `exec-ece0a5b4-5d30-44cd-acb0-af1ad197fd8d.png` | `2c99d899bcb5ab7c51a345069683ca0899f9881ac4962ad2a949e932148b3f14` | The pair carry equipment out through a populated late-morning aisle. |
| `opening-keyvisual-v1.webp` | `exec-ab630ea7-2755-4d9b-bfb9-12d411246896.png` | `fb41837aa68d74e4f10731ae93a8bd310350ce527a2a37e698af2620a2aeeb5a` | Heroines approach the seaside campus along a diagonal autumn path. |
| `gateway-keyvisual-v1.webp` | `exec-334d3256-9eea-46bb-8a08-50141a0ded18.png` | `5514507b46b583a5a6018a0452aa4d45a7f4a81823d950b3b095ade4d64c3d32` | A high atrium view presents four physical observation paths. |
| `mode-abstract-v1.webp` | `exec-a14612f0-1e0a-43e1-91b5-12da8b70e25a.png` | `be589ad2fd084284d967e2fd873c8565ac4ceb468820a4eca9b87d6815b67b68` | Hand-painted primordial ocean sensing field without UI. |
| `mode-map-v1.webp` | `exec-100055e3-84c4-4a1d-8e34-2c9c958c137f.png` | `1a245a6af41d7b4dd5621cf0673b5b44284932c64d7b12c192c885c0f579e1d5` | Tactile cartographic table observed over a visitor's shoulder. |
| `novel-background-v1.webp` | `exec-6e624727-d5de-4e84-804e-51712b034f47.png` | `933900ea6c5d9dca04861d551d25e67fb7fffd33085f3a4abe43ff102a8b4d02` | Quiet worktable and partial figures beside sea-facing windows. |
| `novel-title-keyvisual-v2.png` | `exec-b6d05cd5-f28c-4066-8e68-ed0ecd8c54a9.png` | `d3dc2134da05b1e077f42e8406d8be99501b2a42a90ad4baaea6a4dbb92af12f` | Amane leads Mizuha across a curtain threshold into the festival. |
| `novel-bg-coastal-venue-v3.png` | `exec-d5c91849-7438-4b16-9fcb-03b6ed3c19f0.png` | `89ff0f5d42cfb068af8724515d4392cb1c0428f8e96eaa5ac79b6e887b562c61` | Populated seaside entrance from a low planter-side angle. |
| `novel-bg-exhibition-v2.png` | `exec-e2359776-624c-4830-9c30-0108fc388c0f.png` | `e95c65e957209273db5caf99e6d0510c9a195983dc04609716bc0356b26392fc` | Busy student-booth aisle framed by hanging paper fish. |
| `novel-bg-exhibition-v3.png` | `exec-3720cc95-3da1-40c8-8c04-38766b4e6609.png` | `424d03553db9a0c82be64acecaaff470cdd675553447be78becd5288b3db567c` | Close student workbench and offset aisle opening. |
| `novel-bg-festival-b-hall-overview-v1.png` | `exec-91697447-07e9-4349-9f35-a932acca4e69.png` | `d8876b775624d38bd2bf17b14efd23ce7b71c738aa8cd873f56d266a3722586a` | High escalator view over a populated B Hall. |
| `novel-bg-festival-five-plane-projection-v1.png` | `exec-441b68eb-cbf5-47d0-b386-f158724a224d.png` | `8a79b7bc434546a0020761b0d920acb23d866ad496ff8cd2ac451f4bd070002d` | Five-plane booth from its low rear corner. |
| `novel-bg-gx-ancient-ocean-five-plane-v1.png` | `exec-1307e4c9-d342-4fb9-84e4-94f36246f0ca.png` | `1281d347795e43f779c04e4a87907b2781b27d0afee1100d4828546689627020` | Primordial ocean projection viewed through the threshold. |
| `novel-bg-gx-breathing-points-five-plane-v1.png` | `exec-2a217acf-4afd-423a-84ff-5e6f0edbbef2.png` | `77aa36d5f05254482e3517602c119e1f04adb965884d78f8f4314ee0a87159f9` | Ground-level branching living points across fabric seams. |
| `novel-bg-gx-temperature-anomaly-five-plane-v1.png` | `exec-08290a4a-eae9-4a44-a5ee-e8215febc5da.png` | `840791970c2904d55db59af47dd569c1b290a5aba7669a3976d45cfa101cb6c1` | Over-shoulder warm/cool coastal current field. |
| `novel-bg-gx-mode-gateway-five-plane-v2.png` | `exec-4b67eb72-b7ae-46ba-81ec-73d944f6769a.png` | `e0057b17a95a9ca1bbed2a6c8f773b83ef3fe622968af014a4132b17eae65d78` | Ten irregular study windows distributed across separate planes. |
| `novel-bg-map01-data-provenance-five-plane-v1.png` | `exec-e3c911e2-3037-4ad7-bdf7-3cdb0302a442.png` | `8bec85968d715ba5baf93d17411ba3c630ff84ceb51cfe16779e1284a775dd6a` | Tactile coastline, sensor tokens and routes from behind a visitor. |
| `novel-bg-zushi-coast-night-v2.png` | `exec-1232f315-5f86-44b7-a7de-41b055a87e5d.png` | `0d5658c82eee40fec1ac7da4fc951ce378868420fe939e4a5f9e396f9ad80f83` | Inhabited after-festival coastal nocturne. |
| `novel-bg-coastal-venue-autumn-morning-v1.png` | `exec-55102040-918c-42d5-b6e9-f6c0c954a721.png` | `972adf6beac6b3ac51e9e132b81c7ca61acb24e9f795600153ec021b7c9d1654` | Active registration canopy and arriving families. |
| `novel-bg-festival-b-hall-autumn-morning-v1.png` | `exec-dc28c012-bb9d-439b-b9ce-5047ca23df71.png` | `47c4b03ca464db0df64b5a0f055f862bc63f7bc697d40ffe374cdce4d6dac519` | Long-lens mezzanine view across the festival floor. |
| `novel-bg-festival-five-plane-projection-autumn-morning-v2.png` | `exec-70e865b4-a5a8-4e3c-a38b-e282e098c3be.png` | `42821b8efb82deb36075a9164d04d60bb52e284a2ca0ad3ac72d9f0b1a65ee1f` | Booth exterior corner and offset projection entrance. |
| `novel-bg-map01-data-provenance-autumn-morning-v2.png` | `exec-ff2aacf5-3f13-4298-82bb-647714dfab78.png` | `f8d790382472b9f0c77bad60e48ca17a943a5f0b34099fe939b58b692396a6fc` | Map table, threads and projection from a close side wall. |
| `novel-bg-gx-ancient-ocean-autumn-morning-v2.png` | `exec-09770751-b9f7-49e7-9310-20842f64a8f4.png` | `4c1ad6438f49230df897c9eb39db0a2c1b224274022b391a4cf26ca2c0994727` | Primordial ocean layers through translucent fabric. |
| `novel-bg-gx-breathing-points-autumn-morning-v2.png` | `exec-db9e56a3-856a-485a-a931-b4de25cbbea0.png` | `c1730e84c3728c021ada5f5c92360492cf70fed76a1b8cb64235c7d651ece381` | Elevated audience view of branching living points. |
| `novel-bg-gx-temperature-anomaly-autumn-morning-v2.png` | `exec-18b82190-eaab-4257-b3a4-6649ce2dfc78.png` | `4937a2451e9da1df89675e2c074f6a3fb4f5f40cdf135d1c4aa138d6d9bca30b` | Sensor-side warm/cool projection with an off-center audience. |
| `novel-bg-gx-mode-gateway-autumn-morning-v3.png` | `exec-6af58c81-bebb-43f1-b732-b2b5a97b9383.png` | `85c3bd80ca39983f911183a5822fed0d0702663c7bf190d32e574434830037eb` | Low side-angle ten-vignette projection with real beams. |
| `novel-bg-exhibition-autumn-morning-wide-v4.png` | `exec-dd1b60d4-50ae-495b-986a-78a487cd48a2.png` | `9dc2b6db1bb35274842128b81a4e0bf09257be43727b472ec0ff5b06d7ad5ea4` | Long-lens populated aisle with open sprite space. |
| `novel-bg-exhibition-autumn-morning-close-v4.png` | `exec-49dd5b4f-7494-4e2b-bab7-67d8de601182.png` | `7395fdf68129209f51e2eb1fea26e478627b4fbf03525a7ecb9cdc3d58c45f69` | Intimate equipment corner with an offset bright entrance. |
| `novel-bg-zushi-coast-autumn-day-v3.png` | `exec-ac4b9337-6e16-4561-9e27-15df19c928bd.png` | `f8017fc5902cbae1df2f9e037b7009179a5bf924e5d943f73e76005d60c1467e` | Populated late-morning promenade behind pampas grass and bicycle. |

All generated sources are retained under `C:\Users\wdddi\.codex\generated_images\01a018de-1f19-7d80-b301-ee77d2125e38`.
