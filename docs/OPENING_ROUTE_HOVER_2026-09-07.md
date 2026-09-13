# PC入口のホバー説明・選択発光

依頼日: 2026-09-07（JST）。検証は同日の依頼から継続して実施。

## 対象

- 基点コミット: `63ec6ffdb495256fde6ad1e58c7c963954c741c3`。
- ローカル作業ツリーのみ。今回の依頼で push / deploy / ZIP 配布はしていない。
- 実装変更: `opening.js`, `opening.css`, `index.html`。
- 回帰試験: `scripts/check-opening-route-hover-browser.mjs`。
- 読み込み識別子: `gaia-route-hover-help-1`（CSS / JS 共通）。
- 既存の権利整理・MAP切替調査の変更はそのまま維持。

## 再現と変更

変更前の実ページを Chrome で開き、サウンドなし → スキップ → マウスを画面隅へ移動。メニュー表示後 340ms の時点で、未操作の左カードに `opening-route-glint` と `opening-route-focus-flash` が存在し、左カードが自動フォーカスされる症状を再現した。`artifacts/opening-route-hover-before/report.json` は「未操作カードに選択発光がないこと」の検査で失敗している。同条件の画像も保存した。

その変更前セッションでは、左カードのホバーを3回繰り返す操作自体は発光した。「再ホバーしても光らない」という報告の全条件が再現できた、とまでは扱わない。実装上は初期表示・hover・focusで同じCSSアニメーションを共有する状態を解消し、毎回の選択イベントで再生し直す方式へ変更した。

- `(hover: hover) and (pointer: fine)` では自動ガイドと「入口ガイド」ボタンを出さず、カードの hover / キーボードフォーカスで各説明を表示する。
- PCの説明は `role="tooltip"`。背景を暗くせず、カードのクリックを遮らない。
- 説明の上へマウスを移しても読む間は保持する。カード・説明・キーボードフォーカスから離れると閉じる。Escでも閉じられる。
- タッチ入力では、従来の2段階ガイドと再表示ボタンを維持する。
- 左カード専用の初期発光と自動フォーカスを撤去。入口のグループへ中立なフォーカスを移す。
- 発光は `is-route-glint` の付け直しで再生し、終了・離脱・ガイド終了時に除去する。左右とも、フォーカスが残った状態の再ホバーも対象にする。
- reduced motion では発光を行わない。

検証中には reduced motion の追加不具合を検出した。CSSの表示切替が終わる前にグループへのフォーカスが失敗し、bodyにフォーカスがあるため、opening要素内だけで受けるEscではホバー説明を閉じられなかった。説明表示中だけ有効なdocument側Esc処理と、グループの可視状態を確認する有界リトライを追加。同じブラウザー操作を回帰試験に残した。

## 検証

最終ブラウザー再試験: **合格**。下表6条件で全検査が通り、pageerrorは0件。説明のアニメーション完了後のopacityも検査し、保存画像を実際に開いて位置・文字の可読性を確認した。

| 条件 | 結果 | 最終記録 |
| --- | --- | --- |
| PC 1440×900 | 合格。反復ホバー・キーボード・両入口の実遷移・タイトル復帰 | `artifacts/opening-route-hover-pc-final/report.json` |
| PC 3840×2160 | 合格。反復ホバー・キーボード・説明の画面内配置 | 同上 |
| PC 2560×1392 / DPR1.5 | 合格。同上 | 同上 |
| PC reduced motion | 合格。発光抑制・説明・Esc・Tab順序 | 同上 |
| 390×844 タッチ | 合格。2段階ガイド・再表示・両入口の実遷移・タイトル復帰 | `artifacts/opening-route-hover-touch-final/report.json` |
| 844×390 タッチ | 合格。横画面の2段階ガイド・再表示・説明配置 | 同上 |

同一の最終実装を6条件まとめて実行した記録は `artifacts/opening-route-hover-final/report.json`。上表の分割再試験では、PCは220ms、タッチは850ms待ち、説明の文字と背景のopacityが0.99を超えることを追加確認した。PCの大きな画像は閲覧用にブラウザーからJPEGで保存し、画像編集による補正はしていない。

実行コマンド:

```powershell
node scripts/check-opening-route-hover-browser.mjs http://127.0.0.1:4447 artifacts/opening-route-hover-final
$env:GAIA_VIEWPORT = 'pc1440,pc4k,pc150pct,pc-reduced'
node scripts/check-opening-route-hover-browser.mjs http://127.0.0.1:4447 artifacts/opening-route-hover-pc-final
$env:GAIA_VIEWPORT = 'mobile390,mobile-landscape'
node scripts/check-opening-route-hover-browser.mjs http://127.0.0.1:4447 artifacts/opening-route-hover-touch-final
Remove-Item Env:GAIA_VIEWPORT
node scripts/check-opening-audio-integration-browser.mjs node_modules/playwright-core 'C:/Program Files/Google/Chrome/Application/chrome.exe' artifacts/opening-route-hover-audio-after http://127.0.0.1:4447 --setup-only
npm run check
node --check scripts/check-opening-route-hover-browser.mjs
git diff --check
```

新しい回帰試験は、初期発光、旧自動ガイド開始時刻を過ぎた放置、左右各3回ホバー、実疑似要素のanimation/opacity、発光終了、吹き出し上での保持、Esc、Tab/Shift+Tab、フォーカスを残した再ホバー、blur、画面内位置を検査する。1440px PC と390pxタッチでは、説明を表示した状態からのデータ画面への実クリック、実際のタイトル戻りボタン、物語への実クリックと表示まで確認する。アプリの遷移関数や完了イベントを試験側から代替発火しない。

対象は Chrome の実描画エンジンによるローカルページ。PC1440×900、PC3840×2160、2560×1392 / DPR1.5、PC reduced motion、390×844タッチ、844×390タッチを対象とする。OS全体の拡大率変更ではなくDPRエミュレーション、スマホは実機ではなくChromeのモバイル/タッチエミュレーションである。

関連するサウンド設定試験は `--setup-only` の11条件で合格。言語変更・音量変更・保存値復元・サウンド有無の確定・OPへの移行を検査する。旧テストの後半は過去の3入口ガイドを前提にしているため今回の確認には使用せず、現行2入口の動線は新しい回帰試験で検証する。音声の聴感評価を行ったとの意味ではない。

`npm run check`（precheck / postcheckを含む）は合格。出力中の503は既存のフォールバック単体試験が意図的に発生させるもの。実サービスの障害を確認したものではない。

## 検証対象ファイル SHA-256

| ファイル | SHA-256 |
| --- | --- |
| `opening.js` | `E0C35C0739884054D217BCE5730DD14CE4515ACC856438456C389321145E1C0D` |
| `opening.css` | `762B51C63DA22E29F2CDC08205CE29F498D5A399B7A52F9E69186CFC6D6482BC` |
| `index.html` | `7E173FA903E91926DBD5FD165517955259183D1233E9588C4A0FC709074B4F7A` |

## 範囲外・未確認

- 公開環境への反映、公開環境での今回の動作、Safari / Firefox、実機スマホ、スクリーンリーダーの読み上げ。
- 作品の全シナリオ走破、全機能の保存・書き出し。今回は入口操作と関連するサウンド/言語設定の保存値が対象。
- ZIP等の配布物は作成していないため、新規展開・導入試験は該当しない。
- 別件の「MAP 12の国選択や右側UI操作後にMAP 13へ切替えても表示が残る」症状は本修正の対象に含めず、解消したとは扱わない。
