# 「地球温暖化を地図で見る」BGM変更

- 依頼原文: 「ストーリーモードの『地球温暖化を地図で見る』のBGMはこれにして」。添付画像は TRACK 10 / BLUE GLASS TIDE「青硝子の潮汐」。
- 対応: `map_mode01` 章を既存の `moonreopen`（`assets/audio/moonlit-reopen.mp3?v=gaia-blue-glass-tide-1`）に固定。章内の背景切替とCO₂・気温デモで曲を再開始せず、次章では既存の曲へ戻す。先読み・章タイトル・通常送り・保存読込で同じ章優先の選曲を使用する。
- 対象版: 公開済み `888c26b623151205f6b8ecf9f77951dbc9a425ae` 上のローカル変更。`novel-mode.js` SHA-256: `9f769f045a6d5db3b00324b556b66385d37b915b6f91f91a57f2a6b9217789ee`。配信キャッシュキーも更新。
- 音源は変更・追加していない。TRACK 10 MP3のSHA-256: `3c5f7411866d192420d2ce3f53a29e313cf3783972a3d7425c4ef17760f57cd7`。

## 実行結果

- 変更前: `888c26b` の検証済み展開物（localhost:4495）に前章末の保存位置を設定し、通常のクリック／タップで対象章へ進行。PC・スマホ幅とも従来曲 `mapambient` の実再生を確認。証跡: `artifacts/story-map-bgm-20260910/before-verified/report.json`。この試験は展開物を作業ディレクトリとして実行し、報告ハッシュも変更前の実ファイルと一致する。
- 変更後: localhost:4492、インストール済みChrome、1440×900 / 390×844、通常モーション。前章末→対象章→CO₂デモ→気温背景→気温デモ・2025年操作→会話復帰→出典背景→章末→次章をネイティブ操作で確認。8地点の再生時刻はPC 0.40→33.76秒、スマホ幅0.40→38.15秒と前進し、章内の巻戻り・曲変更なし。
- 同じ試験で次章 `story` への復帰、SAVE→次章→LOADで `moonreopen` への復帰、音量23%維持、ネイティブのミュート操作後のデモ・再読込でミュート維持と章BGM復元を確認。
- 実MP3のHTTP成功、実メディアの再生時刻、Web Audio解析で非ゼロPCMを確認。音声モックなし。ページ例外・404・適用CSP違反なし。証跡: `artifacts/story-map-bgm-20260910/after-v2/report.json` とPC・スマホ幅の画面画像。
- 既存の初対面シーン: `story` → `windowlight` → `story`、ミュート維持、PC・スマホ幅の既存ブラウザ回帰試験が合格。証跡: `artifacts/story-map-bgm-20260910/first-encounter/report.json`。
- 気温デモの既存回帰試験（スマホ幅）: 実データの地図・地点選択、閉じる操作、SAVE/LOAD、Markdown書き出しまで合格。証跡: `artifacts/story-map-bgm-20260910/temperature-save-export/report.json`。
- `npm run check` 全体合格。章優先の選曲・章外の従来曲を検証するアサーションを `scripts/check-map-ambient-score.mjs` に追加。ローダー検査・CSP生成物検査・構文検査・`git diff --check` も合格。全体ログ: `artifacts/story-map-bgm-20260910/npm-check.log`。
- 再実行: ローカルプレビュー起動後、`npm run check:story-map-bgm:browser`。`GAIA_BASE_URL` / `GAIA_OUTPUT_DIR` / `GAIA_BROWSER` で対象と出力先を指定可能。

## 検証範囲・保留

- 実Chromeのビューポート／タッチエミュレーションであり、物理スマホ・スピーカー出力の聴感評価ではない。章直前の分離された保存データを起点としており、物語全編の通読試験ではない。利用者の実セーブは変更しない。
- 初回の新規ブラウザ試験は、廃止済みの台詞ID `map_mode01_029` を待って次章まで進んだため停止した。現行ID `map_mode01_030` と存在検査に修正して全件再実行。失敗証跡 `after/` は保持。実装の追加修正は不要だった。
- 今回はローカル反映のみ。コミット・プッシュ・デプロイは未実施で、新BGMの本番反映は未確認。ZIP等の新規配布物も作成していない。
- 既知の通常会話の短い横画面での顔・会話領域重なりは未対応。今回のBGM変更ではレイアウトを変更していない。
