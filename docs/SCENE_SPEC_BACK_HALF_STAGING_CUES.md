# 後半297step｜演出cue正本

入力正本は `5a5bf370→59c3dab→1820e179`。対象は `festival_build` から `return_to_start` までの12 scene・297 stepである。選択肢の文面・ID・重み・R01→R36順は演出側で変更しない。

## 背景・日時・場所

| scene / step | context・日時 | 場所 / 背景 | 境界 |
|---|---|---|---|
| `festival_build_001`〜`_018` | CURRENT 2026-11-01 14:40 | 展示ブース・端末前 / `novel-bg-exhibition-v3.png` | scene内固定 |
| `gx_deep_time_001`〜`_026` | CURRENT 14:44 | 展示ブース・端末前 / exhibition-v3 | MODEは背景上のモーダル。`_002`開始、`_003`復帰 |
| `mode03_map_001`〜`_020` | CURRENT 14:53 | 展示ブース・端末前 / exhibition-v3 | `_002`開始、`_003`復帰 |
| `mode07_abstract_001`〜`_008` | CURRENT 15:00 | 展示ブース・端末前 / exhibition-v3 | `_008→_009`でCURRENT→RECORD、一度だけfade |
| `mode07_abstract_009`〜`_054` | RECORD 2026-10-31 18:00→22:00→23:00 | 前夜の共用作業室 / `novel-bg-production-shared-meeting-v3.png` | `_002`MODE復帰とは別。現在背景へ戻さない |
| `interlude_sea_001`〜`_007` | RECORD 23:20 | 共用作業室から廊下 / shared-meeting-v3 | `_007→_008` fade |
| `interlude_sea_008`〜`_045` | RECORD 23:31〜23:43 | 逗子海岸夜 / `novel-bg-zushi-coast-night-v2.png` | `_045→_046` fade |
| `interlude_sea_046`〜`_067` | RECORD 23:58→翌00:00→00:26 | 共用作業室 / shared-meeting-v3 | scene終端までRECORD |
| `mode08_map_layers_001`〜`_019` | CURRENT 15:22 | 展示ブース・端末前 / exhibition-v3 | scene入口でRECORD→CURRENT。`_002`開始、`_003`復帰 |
| `mode10_space_001`〜`_018` | CURRENT 15:30 | 展示ブース・端末前 / exhibition-v3 | `_002`開始、`_003`復帰。`_009`〜`_014`は横長展示端末 |
| `choice_editorial_001`〜`_007` | CURRENT 15:38 | 展示ブース・端末前 / exhibition-v3 | 固定 |
| `epilogue_reflection_field_001`〜`_002` | CURRENT 15:42 | 展示ブース・端末前 / exhibition-v3 | 固定 |
| `choice_reflection_001`〜`_003` | CURRENT 15:44 | 展示ブース・端末前 / exhibition-v3 | R01→R36固定 |
| `final_record_001`〜`_007` | CURRENT 15:47 | 展示ブース・端末前 / exhibition-v3 | 固定 |
| `final_record_008`〜`_016` | CURRENT 15:52 | 展示ブース・端末前 / exhibition-v3 | 運営スマホ準備→公式通知 |
| `final_record_017`〜`_027` | CURRENT 15:54 | 展示ブース・端末前 / exhibition-v3 | 同じ運営スマホの音声着信。二重フレーム・再入場animation禁止 |
| `return_to_start_001`〜`_017` | CURRENT 15:55 | 展示ブース・端末前 / exhibition-v3 | 休止札と展示ブースの実見。ここまで主人公視点 |
| `return_to_start_018`〜`_031` | CURRENT 16:00 | 中央入口 / `novel-bg-coastal-venue-v2.png` | `_017→_018`でfade。以後は作品／カメラ視点 |
| `return_to_start_032`〜`_036` | CURRENT 16:03 | 中央入口 / coastal-venue-v2 | `_036`が唯一のEND |

既承認 `production_year` のstepは不変であり、背景mappingを再制作しない。後半でも `novel-bg-production-night-v2.png`、無印room-v1、開催中展示背景の時制違い流用をしない。

## 人物・視点・プライバシー

- `gx_deep_time_017`〜`_019`は保存音声。話者に合わせて大型立ち絵を出さない。
- `final_record_009`〜`_027`のサクヤは通知／通話先。大型立ち絵を出さず、物理的に展示ブースへ配置しない。
- `return_to_start_020`の表示で初めて中央入口のサクヤを物理視認する。`_020`中は非表示、`_021`から大型表示を解禁可能。`_029`以後の会話も、数歩の距離、視線、余白を維持する。
- `return_to_start_017`までは主人公の実見記録。`_018`以後は作品／カメラ視点とし、主人公avatar、追跡表示、主観LOGを追加しない。
- `return_to_start_033`〜`_035`は私的会話を展示しないこと自体を示す区間。私的な理由・会話本文・推測をUI、字幕、LOGへ追加しない。
- 16:00後に即時和解、抱擁、制作復帰、カメラを構える演出を足さない。

## 端末・音声・通知

- `final_record_008`でportrait運営スマホを準備し、`_009`〜`_016`で公式通知、`_017`〜`_027`で同一端末の音声着信を連続表示する。学内チャットUIではない。
- Desktop Chromeでも縦長パネル。390pxでは実viewport内へ一重で収める。`_017`で別端末として再animationしない。`return_to_start_001`で端末を解放する。
- 音cue: GX保存録音 `_016`開始 / `_017`音声 / `_020`foley / `_021`停止。MODE10十一秒録音 `_005`開始 / `_006`foley / `_007`現展示音へcrossfade / `_008`停止。
- final: `_004`踏切音1回、`_005`現在ホール、`_009`振動、`_018`着信、`_019`接続、`_021`館内PAとの遅延、`_027`終話。
- return: `_017`展示画面fade、`_018`中央入口環境音、`_035`海風。和解を示す感情的な音楽swellは追加しない。

## 35 / 60 handoff

- 35: `portrait-operations-phone` の一重縦型surface、公式通知→音声通話の同一端末内切替、PC/390レイアウト、中央入口での距離を保つ人物preset。
- 60: `novel-back-half-cues.js` の `storyDevice/storyDevicePhase/storyViewpoint/storyCastMode/storyAudioCue` をrendererへ結線。既存272f0c1の学内チャット縦型判定は独立維持し、finalの運営スマホと混同しない。
- 60: 背景cueをstep activation時に一度だけ適用し、次cueをpreload。MODE復帰、SAVE/LOAD、巻き戻し、reduced-motionでも正しいcontext・背景・端末へ戻す。
- 02再受入対象: 15:52→15:54の同一スマホ、15:55休止、16:00中央入口、`_020→_021`サクヤ物理視認gate、16:03私的内容非描写。新背景制作は不要。
