# 後半可視UI handoff

入力は `54250c8a041ca23c72fd5d11cffd98ebce7a0e8d` の `SCENE_SPEC_BACK_HALF_STAGING_CUES.md`。この文書は35 UIと60 rendererの責任境界を固定する。

## 運営スマホ

- 35は `#novel-operations-phone-surface` と、その内側の単一 `.novel-operations-phone` を提供する。学内チャットとは別surfaceである。
- 60は `storyDevice === "portrait-operations-phone"` の間だけsurfaceの `hidden` を解除する。`final_record_008`で開始し、`return_to_start_001`で解放する。
- phaseは `#novel-layer[data-story-device-phase]` に `prepare`、`official-notice`、`incoming-audio` のいずれかを設定する。phase変更時にsurfaceや子要素を作り直さない。
- `final_record_016→017`では同じDOMを保ち、外枠のentry animationを再実行しない。CSSは内部viewのopacityだけを切り替える。
- 60は正本metadataから次の全項目を設定する。所有端末名と通知送信元を混同しない。
  - 時刻: `#novel-operations-phone-clock`
  - 通知時刻: `#novel-operations-phone-notice-time`
  - 通知送信元: `#novel-operations-phone-notice-sender`
  - 通知本文: `#novel-operations-phone-notice-body`
  - 音声話者: `#novel-operations-phone-audio-speaker`
  - 音声状態: `#novel-operations-phone-audio-status`
- 15:52通知の送信元は大学学生支援窓口。本人同意に基づく安全確認と中央入口での面談希望だけを表示し、展示休止の操作や私的事情・推測を本文へ追加しない。

## 中央入口の人物preset

- `archived-voice-no-cast`、`remote-sakuya-no-cast`、`sakuya-unseen`では `#novel-layer.is-cast-suppressed` を使う。
- `return_to_start_020`表示中まで `is-cast-suppressed`。`_021`からだけ `is-central-entrance-distance` を設定する。
- `is-central-entrance-distance`はSakuyaだけを小さめに右奥へ置き、全身寄りのcrop、低い彩度、広い余白を保つ。他人物は同preset内で非表示。
- 60はclassとstep gateだけを結線する。35 CSSはstep ID、保存状態、進行ロジックを判断しない。

## 受入境界

- PC/390ともスマホ外枠は1つ、横overflow 0、会話枠と非交差。
- `official-notice→incoming-audio`でsurface node identityと外枠矩形が不変。
- `_020`は大型cast不可視、`_021`はSakuyaだけ可視。会話枠と非交差し、抱擁距離・中央大写しにしない。
- GX保存音声、finalの通知／通話、他人物の通常表示へ大型castを波及させない。
