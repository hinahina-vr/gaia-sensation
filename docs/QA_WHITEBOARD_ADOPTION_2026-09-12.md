# ホワイトボード背景の採用 — 2026-09-12

- ユーザーが画像付きで「採用」と指定した②ホワイトボード＋マーカー案を組み込み。
- 採用画像: `assets/architecture/gaia-field-sensor-whiteboard-20260912.png`（1672×941、1,917,338 bytes）。候補 `output/imagegen/sensor-background-candidates-20260912/02-whiteboard.png` の無加工コピー。双方のSHA-256は `1505b98161b090534c8a7c9ff6a7e495b55ec872ad679c6b3aeccbe74a171443`。
- 出自: このタスクのbuilt-in image_genで2026-09-12生成。実行プロンプトは候補ディレクトリのPROMPTS.md。画像中の追加コピーも含め、採用指定された画像を維持。
- `novel-background-cues.js` の `esp32-system-design`（ESP32説明019～026）のPC／モバイル参照を更新。元SVGと他の2候補は削除しない。
- PCは画像全体を表示。スマホは横長画像の中央を画面いっぱいに表示し、旧縦長ノート用の小さな右寄せ立ち絵を通常配置へ戻した。スマホでは図の両端はクロップされる。画像編集・再生成はしていない。
- ローダー／CSSのキャッシュキーを更新。

## 検証

- 既存 `check-esp32-connection-background-browser.mjs` を採用PNGの検査へ更新。表示完了待ちと画像デコードを検査。
- インストール済みChrome headlessの1440×900／390×844で019の実表示を確認。PCで前後の018・019・025・028の背景参照も確認。これは各場面への直接読込であり、連続再生のトランジション試験ではない。
- 6件合格。横／縦の画面はみ出し0、console error・page error・404なし。PCの立ち絵＋セリフ合成、スマホの最終画面を目視確認。
- 証跡: `artifacts/whiteboard-adopted-20260912/final/`。親フォルダーの旧スマホ画像は改善前の記録で、最終合格の対象ではない。
- 背景cue全380step、ローダーprefetch、構文、CSPハッシュ、差分空白チェック合格。
- 実スマホ・本番配信・ZIP導入は未確認。保存形式／セリフ／書き出し機能は今回変更していない。ローカル反映のみ、未コミット・未公開。
