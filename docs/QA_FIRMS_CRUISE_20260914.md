# 展示01 クルージングのアニメーション修正

- 対象: a410248 をベースとするローカル変更、2026-09-14。
- 依頼: 「地図の01、クルージングモードにしても動かないんだけど　再現する？直して」。
- 再現: Chromeで01のクルージングをクリック。スライダーは約0.09→0.93へ進むが、描画は `scrub`、炎の柱は全期間0本。時間進行そのものの停止ではなく、クルージングが手動スクラブを呼び出し、炎と背景の動きを止めていた。
- 修正: 通常再生と同じ時間軸を使う専用のseekを追加。出現・保持・消灯の36.9秒を再生し、3秒待って次へ進む。クルージング側のガイド・非表示中の停止を維持し、描画もその時計に従う。

## 検証

- `node scripts/check-firms-cruise-browser.mjs`: Chrome headless、1440×900 / 390×900。PCのボタン、スマホの「操作」→クルージングを実クリック。炎の実描画、時刻進行、消灯、02への移動、通常の自動表示の停止・再開を確認する回帰テスト。
- スクリーンショットを目視確認: `artifacts/firms-cruise-20260914/1440-igniting.png`、`390-igniting.png`。数値証跡は同ディレクトリの `results.json`。
- `node scripts/check-map-cruise.mjs`: 71展示の制御ループ、一時停止、終端保持、退出の単体テスト合格。71展示全てを実時間で巡るブラウザ試験ではない。
- `node scripts/check-firms-active-fire-snapshot.mjs`: 保存データ1263点の検査合格。
- 構文検査 / `git diff --check`: 合格。
- 旧 `check-firms-exhibit-browser.mjs` は入口の `#japan-firms-mode-list` 待機でタイムアウト。今回の動作検証には、現行の `#world-01` 入口と実ボタンを使う上記回帰テストを使用。
- ローカル保存データでの描画確認。ライブ配信、全展示の長時間巡回、本番反映は未検証。コミット・プッシュ・デプロイは実施していない。

## 追加依頼: 外部リンクからキャラクターページ

- `/#character` は既存ルーティングで対応済み。不要なルーティング変更は加えていない。
- `node scripts/check-character-direct-link.mjs`: 1440×900 / 390×900で、未訪問状態の別文書からのリンク、再読み込み、閉じてトップへ戻る、再度ハッシュから開く動作が合格。立ち絵読込と表示も確認。証跡: `artifacts/character-direct-link-20260914/`。
- 公開URL `https://gaia-senseware.pages.dev/#character` もChromeで読み取り確認済み。ブート終了、`character-mode-open`、キャラクター領域の `aria-hidden=false` を確認。新しいデプロイなしで共有可能。
