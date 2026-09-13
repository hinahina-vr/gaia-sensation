# 観客向けの比較表示

ローカル実装のみ。コミット・push・デプロイは行っていません。

## 変更

- `statistics-discovery.js`: 表示用の説明を、実際の記録・読み取れること・限界の順に整理。気圧・風速などの2対象比較は、元のIDと単位を保った構造化データを返す。
- `statistics-lab.js`: 対応する数値を比較表に表示。地点・国の記録を表から開ける。抽象的な課題設定を最初に見せず、選び方・計算方法は開いて確認する。記録を開く際のタブ選択も同期する。
- `statistics-workspace.css`: 「分かること」表示では、PC・スマホとも右側の同文と重複する大見出しを非表示。1つの読み物として表示する。
- `index.html`: タブを「分かること」に変更。`gaia-mode-loader.js` とモジュール依存のキャッシュキーを更新。
- `statistics-data-insights.js`: 更新された表示モジュールを参照。
- 統計量・候補の選び方・元データは変更していない。補完値を比較から除外し、比較不能時は差を作らない。既存のリアルタイム展示の分析禁止も維持。

## 確認

- `npm run check`: 成功。
- `npm run check:statistics-data-insights`: 成功。対応する地点ID・値・単位・並び替え・比較不足の検証を追加。
- `scripts/check-statistics-readable-comparison-browser.mjs`: 1920 / 1440 / 1024 / 390 / 320 px。比較表、非重複、記録リンク、タブ、絞り込み、補完値除外を確認。
- `scripts/check-statistics-data-insights-browser.mjs`: 全26手法、組み合わせ検査、PCから小型スマホまでの5画面サイズを確認。
- `scripts/check-statistics-discovery-browser.mjs`: 全30展示をPC・スマホで確認。現在の仕様で分析できないリアルタイム展示は、禁止が維持されていることを検証。
- `git diff --check`: 成功。

画像と結果は `artifacts/statistics-readable-comparison/` に保存。風速の専用テストとプレビューは明示した表示確認用データを使用し、現在の気象データとしては扱っていない。
