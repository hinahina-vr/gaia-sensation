# QA — 2026-09-09 リアルタイム展示の下部パネル整列

## 変更内容

ユーザーの「05 雲と光の分け前」の添付画面を対象に、文字の上下位置を調整。

- `realtime-exhibits.css`：901px以上で展示名・測定値・補助数値・操作ボタンを共通の「ラベル行／値の行」に統一。行間は6px。番号と展示名も同じ高さに揃えた。
- 1800px以上では見出し＋接続状況の二段を左、時刻の二段を右に並べ、両ブロックを中央揃え。時刻だけが下段に落ちる配置を解消。
- 大画面の見出しを最大56pxから30pxに抑え、数値は最大28pxに統一。既存の色・見出しの下の接続状況・ライブバッジは維持。
- 狭い画面の震源名は折り返せる自然な行高を維持。文字列の長い地名には数値用の固定行高を適用しない。
- `gaia-mode-loader.js`／`index.html`：該当CSSとローダーのキャッシュ識別子を更新。
- `scripts/check-realtime-dock-alignment-browser.mjs`／`package.json`：座標・操作の回帰試験を追加。
- `scripts/check-realtime-exhibits-browser.mjs`：展示数が31に増えた現状でも開始できるよう待機条件を更新。元のCSSと比較する `--baseline-css` を追加。

データの取得・計算・値・保存・書き出し処理は変更していない。900px以下のモバイル用CSSも変更していない。既存の台本・コンセプト・BEYOND修正を保持。

## 修正前の再現

`node scripts/check-realtime-dock-alignment-browser.mjs --before` をCSS変更前に実行。

- 3771×2100：時刻のブロックが見出し＋補足の中心より41.30px下、時刻ラベルが測定ラベルより35.48px下にずれていた。
- 1920×1080：中心のずれ23.59px、ラベルのずれ22.91px。
- 実画面のPNGでも段違いの配置を確認。
- 証跡：`artifacts/realtime-dock-alignment-2026-09-09/before/report.json`（`reproduced`）。

## 合格した検証

- `npm run check:realtime-dock-alignment:browser`：3771×2100、2560×1440、1920×1080、1440×900、1280×800、1024×768、390×844、320×568、844×390の9条件合格。
- 同じ試験を1800×1080、1799×1080、1250×800、901×768で実行し、切り替え境界の4条件も合格。
- 大画面の時刻と見出しブロックの中心差は0px。時刻と測定値のラベル・値の行位置の差も0px。
- 展示名・測定値・ボタンの各ラベルと値、表示される補助数値の行位置はすべて1px以内。文字を個別に測るのではなく、実DOMの行ボックス座標で検証。
- 対象画面のはみ出しがないこと、PCで実際に出典パネルを開閉できること、前の展示へ切り替えられることを確認。
- 画面全体と下部パネルのPNGを保存。大画面／1920px／スマホ縦の見た目と、1024pxで震源名が折り返す出力を目視確認。
- `check-realtime-exhibits-browser.mjs`：最終CSSで3771・1920・1440・1024・390・320pxの各幅におけるMAP 01〜05の30展示ケース、凡例の開閉、MAP 06がリアルタイム表記にならないことを確認。1920・1440・390・320pxでは保存値・参考値・時刻遅延の計12状態も合格。全体実行は下記の既存横向き問題で最後に失敗しており、全体合格とは扱わない。
- ブラウザのpage errorは0件。変更した試験JSとローダーの構文検査、`check-realtime-exhibits.mjs`、`check-mode-loader-prefetch.mjs`、対象ファイルの `git diff --check` 合格。

証跡は `artifacts/realtime-dock-alignment-2026-09-09/` 内の `after/`、`breakpoints/`、`full-exhibits-final/`。

## 既存問題・検証範囲

総合試験の844×390・MAP 01（火災展示）では下部パネルの表示超過判定が失敗。`--baseline-css` で変更前の `HEAD:realtime-exhibits.css` を同じブラウザに配信し、同じ寸法・同じ失敗を再現した（`landscape-baseline/report.json`）。今回のCSS変更による回帰ではなく、未修正の別件として残している。対象のMAP 05は同じ横向き寸法でも合格。

Windows Chromeのローカル実ブラウザ検証。気象・地震・火災データは保存／合成フィクスチャを使用し、実配信APIの取得確認ではない。物理スマートフォン、Safari、Firefox、本番配信は未確認。保存・書き出し処理は今回の変更対象外で再試験していない。

## 対象版

既存の未コミット変更を保持。基点HEAD：`aaa9153116c704f14d82f48969a396b907388451`。

最終SHA-256：

- `realtime-exhibits.css`：`c2e62fab7a1a13ab95b3e007b3d75f347d0fe0071a7154a0aacb14d20a5f684d`
- `gaia-mode-loader.js`：`ba7d6221dc53f0f1eb6fc61dfe79f65589bd950189d8e7f1365b1c1b2280122d`
- `index.html`：`21e7b5cfd3d5c8fca1cf93b015cad6835c7866771e869c8c2e5369438349ccf2`

ローカル修正のみ。push・deploy・公開・ZIP作成はしていない。
