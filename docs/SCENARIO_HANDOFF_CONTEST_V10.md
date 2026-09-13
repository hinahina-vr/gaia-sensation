# コンテスト短尺版 v10｜正本・移行・演出境界

## freeze正本

- 入力: `contest-limited/story/limited-feature-script.md`
- 正本: `story/物語台本.md`
- UTF-8 / LF / 56,528 bytes / 992 content lines
- SHA-256: `27db292fbcfd2fc5130c9dcef8f33532ee0956abb559729347aa055dc5cd6b0c`
- scene IDと後続step IDを維持したまま、展開へ影響しないGX後の三択・端末内投票を2026-08-20 owner指示で撤去済み。

## scene順とmetadata

| sceneId | chapter | playback duration | in-world date/time | location | step |
|---|---|---|---|---|---:|
| `festival_concept` | `01 / CONCEPT` | `0:00–1:45` | `10月3日（土） AM 9:20–9:40` | オンライン大学・年次対面イベント／海側広場・学生作品展示 | 76 |
| `map_mode01` | `02 / MAP 01` | `1:45–3:25` | `10月3日（土） AM 9:40–9:45` | 展示端末・地図MODE 01 | 43 |
| `gx_experience` | `03 / DEEP TIME` | `3:25–5:35` | `10月3日（土） AM 9:45–9:53` | 展示端末・GX／太古の海 | 48 |
| `esp32_pitch` | `04 / PROPOSAL` | `5:35–7:15` | `10月3日（土） AM 9:53–10:00` | 年次対面イベント・GAIA SENSEWARE展示ブース | 43 |
| `circle_invitation` | `05 / AFTER SCHOOL` | `7:15–9:05` | `10月3日（土） AM 10:00–10:07` | 年次対面イベント・GAIA SENSEWARE展示ブース | 81 |
| `welcome_chat` | `06 / WELCOME` | `9:05–11:30` | `10月3日（土） AM 10:07–10:45` | 学内チャット「惑星の放課後」／午前展示枠終了後の海側広場 | 95 |

`duration`は10〜12分版の再生尺であり、作中の時計ではない。可視見出しはowner指定の土曜日とAM時刻を持つscene-metaから`date time｜location`として生成し、各sceneは`CURRENT / MINUTE`とする。

## interaction境界

| scene | PREP | interaction | return | POST | kind / target |
|---|---|---|---|---|---|
| `map_mode01` | `_001`〜`_003` | `map_mode01_004` | `_005` | `_005`〜`_022` | `map01` / MODE index 0 / `breathing-earth` / 3倍速自動再生 / `#japan-layer` |
| `map_mode01` | `_015`〜`_022` | `map_mode01_023` | `_024` | `_024`〜`_043` | `map01` / `temperature-anomaly` / 年代＋地点操作 / `#japan-layer` |
| `gx_experience` | `_001`〜`_016` | `gx_experience_017` | `_018` | `_018`〜`_044`, `_055`〜`_058` | `gx` / `#gx-layer` |

`map_mode01_004`は生成時に挿入するmetadata-only step、`map_mode01_023`は正本の`［操作｜気温偏差を重ねる］`から生成する。どちらも物語の上にモーダルとして自動openし、前者は2050年到達、後者は年代スライダーと地点タップの完了後に、保存・戻るボタンなしで本文へ自動復帰する。ほかのinteraction kindは本編に置かない。

旧`gx_experience_045`〜`_054`の三択・端末内投票は撤去済み。`_044`から`_055`へ直接進み、旧saveが撤去範囲を指す場合も`_055`へ安全復帰する。

## welcome_chat presentation境界

- `_001`〜`_054`: 学内chat surface（wide）。人物のlarge cast / portrait / voiceは出さない。
- 学内chatのサークル名は「惑星の放課後」、チャネル名は `# 惑星の放課後_雑談` と `# 惑星の放課後_esp32`。
- `_055`〜`_077`: 会場で隣にいるミズハ／アマネとの物理会話。通常の展示画面へ戻す。
- `_078`〜`_095`: 帰路のスマートフォン（mobile）。desktopでも縦型、390pxでは二重frameを作らない。
- sakuは`chat` stepだけ。cast / portrait / avatar / voiceは全区間0。

## v9以前のsave移行

- `storyVersion`は10。
- v9以前の`stepId`、旧scene到達、既読、interaction完了、選択、clear、archiveは新routeへ持ち込まず、進行だけ`festival_concept_001`へ移す。
- 音量・muteと、別storageの表示設定は保持する。
- v10の有効な`stepId`はそのまま復帰する。撤去した`gx_experience_045`〜`_054`は`_055`へ、それ以外の未知`stepId`は`festival_concept_001`へ安全復帰する。
- 未知のsave fieldは利用せず、loadを失敗させない。manual saveも同じnormalize経路を使う。

旧1022step本文はgit履歴にのみ残し、本編route・JUMP・SCRIPT・LOGへ混入させない。
