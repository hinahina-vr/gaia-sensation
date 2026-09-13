# OPの4番目「ともに選ぶ。」が出ない不具合

対象: 通常再生のOP、「感じる。／測る。／つなぐ。／ともに選ぶ。」の4行。
基点: `63ec6ffdb495256fde6ad1e58c7c963954c741c3` のローカル作業ツリー。既存変更は保持。push/deployはしていない。

## 再現と原因

サウンドなしを実クリックし、スキップせずOPを通常再生。変更前のChrome 1440×900で、再生15.6秒・16.2秒の両方で4行目の本文だけ `is-opening-focus-pending`、opacity 0、blur 14pxになることを再現した。番号04・YOUと他の3文は表示されていた。

`[data-opening-focus]` の表示対象は18個だが、`opening.js` のDOM順に対応する時刻配列は17個。REAL EARTHの説明文追加で後続が1つずれ、4行目には最終タイトル用の17.404秒の表示開始時刻が割り当たっていた。次画面は16.703秒から始まるため、この場面で本文を読めなかった。

変更前の実描画と状態: `artifacts/opening-four-voices-before/pc1440-16200.png`、同ディレクトリの `report.json`。

## 修正

- `index.html`: 全18対象の `data-opening-focus` に「開始時刻・表示時間」を明示。文言、並び順、CSSは変更しない。JSキャッシュ識別子は `gaia-route-hover-help-1-sound-jewel-1-four-voices-1`。
- `opening.js`: DOM順に対応する配列を廃止し、それぞれの要素自身にある時刻を読む。新たな文章が追加されても、別の文章の時刻はずれない。不正な時刻は即時表示のフォールバックにする。
- 4行目は14.790秒から表示し、約15.453秒に本文のフェードが完了する。
- 途中のREAL EARTHの3文目も、本来の場面内で読める時刻に割り当てた。OP全体の長さ、次画面への切替、音声設定・保存処理は変えていない。

## 最終検証

`scripts/check-opening-four-voices-browser.mjs` を追加。実クリックからCSSアニメーションの実際の再生時刻を読み、15.6秒・16.2秒の状態を検査する。アニメーションの時刻変更、一時停止、アプリの完了イベントの代替発火は行わない。

- **PC1440×900: 合格。** `artifacts/opening-four-voices-pc-final/report.json`。
- **PC3840×2160・390×844・320×568: 合格。** `artifacts/opening-four-voices-responsive-final/report.json`。
- 4文すべての本文opacity 1、pending解除、本文のぼかし0、親行の表示、画面内の文字位置、次画面に覆われていないことを確認。15.6秒は行そのものの登場演出が完了直前なので親のblur 0.1px以下、16.2秒は親も0pxを検査。
- REAL EARTHの3文がその場面内で表示されること、最後の入口メニューが通常再生で表示されること、全対象の遅延解除も確認。
- 4条件の16.2秒画像を保存。PC・4K・390pxの保存画像を実際に開き、4文目の表示を確認した。
- 関連するサウンド設定の回帰: **6条件合格**（1440・4K・390・320・844×390・reduced motion）。キーボード／タッチ、繰り返し発光、確定反応、ミュートでのOP開始を検査。`artifacts/opening-four-voices-sound-regression/report.json`。
- 上記成功したブラウザー試験はいずれも実行時エラー0。
- `npm run check`、`node --check opening.js`、新規ブラウザー試験の構文検査、対象ソースの `git diff --check` は合格。

実行例:

```powershell
$env:GAIA_VIEWPORT='pc1440'
node scripts/check-opening-four-voices-browser.mjs http://127.0.0.1:4447 artifacts/opening-four-voices-pc-final
$env:GAIA_VIEWPORT='pc4k,mobile390,mobile320'
node scripts/check-opening-four-voices-browser.mjs http://127.0.0.1:4447 artifacts/opening-four-voices-responsive-final
Remove-Item Env:GAIA_VIEWPORT
```

途中の試験記録は削除していない。試験側の過剰な「登場演出中の親blurも厳密に0」「メニュー初出時点で最終文の遅延もすべて解除済み」という前提を調整した。また4KのPNG保存に600ms以上かかって2回目の測定が場面終了後になる問題は、2回の状態測定の後だけ画像を保存することで解消した。アプリの演出を止めて試験を通したものではない。

別の実行では初期サウンド画面の表示待ちが30秒でタイムアウトした（`artifacts/opening-four-voices-final-pass/report.json`）。この起動時の揺れの原因は本修正では確定していない。最終試験は新しいブラウザーで表示待ちの上限を60秒とし、実際にクリックできた状態から通常再生を検証して合格した。

## 検証対象SHA-256

- `index.html`: `10c16c18e3a737d3069ffc7df4bf0193ba0a91dbfa77745a716680edc722024d`
- `opening.js`: `55a3187f8e61b7613d0c97e74448c00a35107ba3f28b1dea2b758848dc59950c`
- `opening.css`（今回変更なし）: `d312185a20138ade724eac1ba4e56fdcee060408cd34710a2f16eb1fee96c2ba`

各最終JSONにも同じハッシュを保存。実機スマホ、Safari/Firefox、公開配信、音声の聴感、全シナリオ・保存書き出しの網羅確認ではない。今回は音声・保存処理の変更はなく、配布ZIPも作成していない。
