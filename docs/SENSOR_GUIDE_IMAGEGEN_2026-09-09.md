# みずとあめのセンサー紹介：ImageGen制作記録

- 制作日：2026-09-09。ユーザーの明示依頼で内蔵 image_gen を使用。CLI/API fallbackは不使用。
- 用途：「センサーで参加」の紹介ポップアップ。既存の「世界を観測する」と同じ、みずとあめの明るいイラスト3枚。実測画面や配線図ではない装飾として、文字・数値・説明はHTMLへ分離。
- 参照画像：既存の `assets/modes/guide-map-live-mizu-ame-v1.webp` と `assets/modes/guide-map-discovery-mizu-ame-v1.webp`。スタイルとキャラクター同一性の参照であり、編集対象ではない。第三者画像は追加していない。
- 3枚とも1536×1024。PNG原稿はそのまま `artifacts/sensor-feature-imagegen-2026-09-09/imagegen-sources/` へコピー。同解像度WebP quality 90への形式変換のみ。切り抜き・色補正・描き直しなし。
- 生成出力を目視確認：2人の髪型・衣装・髪飾りを維持し、各2本の腕と手、文字やロゴなしを確認。生成初稿3枚を採用。
- 実装・37ケースのローカル検証結果と未確認範囲は [検証記録](QA_SENSOR_GUIDE_IMAGEGEN_2026-09-09.md) を参照。本番への配信は未実施。

| 配信ファイル | 生成原稿ファイル名 |
| --- | --- |
| assets/modes/guide-sensor-live-mizu-ame-v1.webp | exec-cdb8fabf-251b-4317-bf56-a450124611fc.png |
| assets/modes/guide-sensor-connect-mizu-ame-v1.webp | exec-b5563807-7f6b-44cd-9e89-e2ed1d191414.png |
| assets/modes/guide-sensor-analysis-mizu-ame-v1.webp | exec-008cc19c-c298-4279-85fb-19abcaab1254.png |

## 使用したプロンプト全文

### 1. みんなの観測

```text
Use case: illustration-story.
Asset type: final decorative illustration for GAIA SENSEWARE's SENSOR introduction popup, part of the same bright onboarding series as the supplied MAP illustrations.
Input images: Image 1 and Image 2 are STYLE and CHARACTER IDENTITY references only, not edit targets. Match their polished original anime chibi rendering, delighted expressions, lighting, clothing, hair and accessories.
Characters: Exactly two girls, Mizu on the left with long dark slate-blue half-up braided hair, white infinity hair clip, teal eyes, cream blouse and mint bow, dark navy-teal belted pinafore dress; Ame on the right with pale sky-blue bob, white cloud hair clip, blue-violet eyes, light blue cardigan, white collared pleated dress and blue bow. Keep their modest original outfits, 3-head-tall proportions and cute large faces.
Composition: horizontal 3:2 landscape, 1536x1024. Complete heads, hair clips, and both hands of each girl comfortably within the central 85%. Medium-full view, large legible faces, clear uncluttered silhouettes. Background fills edge to edge with bright luminous pastel daylight and soft fluffy clouds. No card border.
Constraints: Correct anatomy, exactly two arms and two hands per character. No extra people. No letters, words, numerals, logos, watermarks, UI buttons or labels. Not a real data visualization or technical wiring instruction. No dark control room, no imitation of a named game.
Primary request: Mizu and Ame happily discovering public environment observations together. Between them floats a small rounded mint-blue miniature island map with THREE friendly orange/cyan location pins; above it are a simple thermometer symbol and a blue water droplet, without numbers. Mizu points toward one map pin with one hand and rests her other hand near her chest. Ame holds a small plain tablet with both hands showing only a large droplet icon. A gentle luminous connection line between pins evokes observations arriving from different places. Cheerful blue/aqua sky and cream clouds, a few tiny gold sparkles. Keep the map pins and sensor symbols large and readable. This is a fresh pose and sensor-map subject, not the globe scene in the references.
```

### 2. 自分の機器をつなぐ

```text
Use case: illustration-story.
Asset type: final decorative illustration for GAIA SENSEWARE's SENSOR introduction popup, part of the same bright onboarding series as the supplied MAP illustrations.
Input images: Image 1 and Image 2 are STYLE and CHARACTER IDENTITY references only, not edit targets. Match their polished original anime chibi rendering, delighted expressions, lighting, clothing, hair and accessories.
Characters: Exactly two girls, Mizu on the left with long dark slate-blue half-up braided hair, white infinity hair clip, teal eyes, cream blouse and mint bow, dark navy-teal belted pinafore dress; Ame on the right with pale sky-blue bob, white cloud hair clip, blue-violet eyes, light blue cardigan, white collared pleated dress and blue bow. Keep their modest original outfits, 3-head-tall proportions and cute large faces.
Composition: horizontal 3:2 landscape, 1536x1024. Complete heads, hair clips, and both hands of each girl comfortably within the central 85%. Medium-full view, large legible faces, clear uncluttered silhouettes. Background fills edge to edge with bright luminous pastel daylight and soft fluffy clouds. No card border.
Constraints: Correct anatomy, exactly two arms and two hands per character. No extra people. No letters, words, numerals, logos, watermarks, UI buttons or labels. Not a real data visualization or technical wiring instruction. No dark control room, no imitation of a named game.
Primary request: Mizu and Ame joyfully setting up their own small environment observation station on a little rounded tabletop between them. At the center is one friendly small green ESP32-like circuit board with a generic metal module and attached USB cable, connected to a little white vented temperature/humidity sensor case. No labels or detailed wiring diagram. Mizu gestures toward the board with one open hand and keeps the other hand resting on the table edge; Ame points excitedly toward a softly glowing tiny green indicator with one hand while holding her other hand near her chest. A tiny potted sprout stands next to the sensor, conveying familiar everyday surroundings. Warm luminous cream/apricot/pale gold cloud background, high-key daylight. Hardware is simple but recognizable, a cozy welcoming experiment; no soldering tools, electricity sparks or dangerous loose wires. Show exactly two hands per girl, uncluttered hand poses.
```

### 3. 記録の分析・質問

```text
Use case: illustration-story.
Asset type: final decorative illustration for GAIA SENSEWARE's SENSOR introduction popup, part of the same bright onboarding series as the supplied MAP illustrations.
Input images: Image 1 and Image 2 are STYLE and CHARACTER IDENTITY references only, not edit targets. Match their polished original anime chibi rendering, delighted expressions, lighting, clothing, hair and accessories.
Characters: Exactly two girls, Mizu on the left with long dark slate-blue half-up braided hair, white infinity hair clip, teal eyes, cream blouse and mint bow, dark navy-teal belted pinafore dress; Ame on the right with pale sky-blue bob, white cloud hair clip, blue-violet eyes, light blue cardigan, white collared pleated dress and blue bow. Keep their modest original outfits, 3-head-tall proportions and cute large faces.
Composition: horizontal 3:2 landscape, 1536x1024. Complete heads, hair clips, and both hands of each girl comfortably within the central 85%. Medium-full view, large legible faces, clear uncluttered silhouettes. Background fills edge to edge with bright luminous pastel daylight and soft fluffy clouds. No card border.
Constraints: Correct anatomy, exactly two arms and two hands per character. No extra people. No letters, words, numerals, logos, watermarks, UI buttons or labels. Not a real data visualization or technical wiring instruction. No dark control room, no imitation of a named game.
Primary request: Mizu and Ame delightfully finding a pattern in their own sensor records. A large translucent rounded panel between them shows only a simple cyan line connecting five round observation dots and three pastel bars, no axes labels or numbers. Beneath it sits a small generic white vented environment sensor with a gentle connection ribbon leading to the chart. Mizu holds an open notebook with BOTH hands, notebook pages contain only one simple abstract line with dots. Ame points to the chart with one hand and holds her other hand near her chest, delighted. One small empty pastel speech bubble beside the chart evokes asking a question; no glyph or question mark inside. Luminous lavender, rosy pink, and creamy-white clouds with subtle gold sparkles. Different poses from the references. Friendly discovery, not an actual measured result.
```
