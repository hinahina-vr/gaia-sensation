# QA — 2026-09-09 BEYOND / WebGLキャラクターの瞬間消失修正

## 症状・原因・変更

会話切り替え時、描画が遅れるとキャラクターがフェードアウトせず、次の1フレームで消える症状を修正。

変更前は `performance.now()` と独立したタイマーでフェード進行・完了を判定していた。描画停止中にも380msの遷移が終了扱いになり、実際には中間フレームを描かないまま次の台詞が確定する場合があった。

- `true-end-webgl.js`：実際に描画するフレームでのみフェードを進め、1フレームあたりの進行を最大50msに制限。最初の描画では直前のキャラクターの表示量を維持。
- 最終フェードフレームの `gl.drawArrays` 後に完了を通知し、その完了を待って次の台詞を表示。描画とは別の完了タイマーを削除。
- フェード中の同一話者への再要求は、同じ完了Promiseを共有して待つ。連続要求でフェードをキャンセルしない。
- 非表示状態ではフェードを進めない。WebGLコンテキスト喪失・破棄時は待機をキャンセルし、復帰時の既存再生成経路を維持。
- 目標時間は通常380ms、AIVAからの退出760msを維持。負荷時は中間フレームを確保するため、実際の完了時刻が延びる。動きを減らす設定では従来どおり中間アニメーションを省くが、描画完了は待つ。
- シェーダー、キャラクターの形・色、背景の動き、台詞、台本データ、保存形式、CSSは変更していない。
- `gaia-mode-loader.js` と `index.html` のキャッシュ識別子を更新。`package.json` に回帰試験コマンドを追加。

## 変更前の再現

`node scripts/check-true-end-presence-fade-browser.mjs --before` を修正前に実行。

通常のAIVA→地の文では途中の描画がある一方、ルウ→あめ（`beyond_01_004` → `beyond_01_005`）の切り替え直後に650msの前景スレッド停止を入れると、1440×900／390×844の両方で次を記録した。

- 最初の描画時点で退出側の表示量が0。
- フェードアウト中間フレームは0回。
- ブラウザの実WebGL描画で再現。状態変数だけのモック試験ではない。

証跡：`artifacts/true-end-presence-2026-09-09/before/report.json`（`status: reproduced`）。

## 合格した検証

- `npm run check:true-end-presence-fade:browser`：1440×900／390×844、20ケース合格。390pxでは低能力デバイス条件も模擬。
- 同じ650ms停止での回帰試験：両画面とも最初の退出側表示量1を維持し、途中4フレームを実際に描画してから消える。AIVAは途中8フレームを確認。
- AIVA・ルウ・みず・あめ・saku・あなた・地の文の全7種類の退出、同一話者の連続台詞、ページ送り、遷移中の連打を確認。
- 実WebGLのuniformと描画済みピクセルを採取。実キャンバスの段階別PNGを保存し、ルウの模様が段階的に薄くなる出力を目視確認。
- フェード中は前の台詞・話者を維持し、最終描画後に次の台詞が確定することを確認。
- 章切り替え：暗転、黒幕の裏でのキャラクター準備完了、幕の解除後の台詞確定をPC／スマホ幅で確認。
- ライフサイクル：同一要求の待機共有、非表示／復帰の模擬、動きを減らす設定と通常設定への復帰、実WebGLコンテキストの喪失・再生成、破棄時の待機解放を確認。
- `node scripts/check-true-end-presence-fade-browser.mjs --lifecycle-only`：復帰完了を実際の最終描画と照合する条件で再試験し、両画面合格。復帰後の画面も目視確認。
- `node scripts/check-beyond-log-comments-browser.mjs http://127.0.0.1:4447 artifacts/true-end-presence-2026-09-09/reduced-full-story 1440,390`：BEYOND全164メッセージの全ページ・話者・表示領域・フィナーレまで、両画面で合格。
- `node scripts/check-story-log-followup-browser.mjs http://127.0.0.1:4447 artifacts/true-end-presence-2026-09-09/main-save-export 1440,390`：実SAVE／LOAD、旧セーブ読込、再読込、全544件のLOG表示とMarkdownダウンロードを両画面で再確認。
- `node --check true-end-webgl.js`、回帰試験の構文検査、`node scripts/check-novel-story.mjs`、BEYOND生成物照合、現行台本の生成物照合、`node scripts/check-mode-loader-prefetch.mjs`、`git diff --check`：合格。
- 合格したブラウザ試験のpage errorは0件。直前の台本修正12件とその他532件を維持。

## 証跡・制限

`artifacts/true-end-presence-2026-09-09/` 配下：

- `after/report.json`：フェード・章・ライフサイクル20ケース。
- `after/*-lou-stalled-gl-0.png` 〜 `*-gl-4.png`：停止後の段階別実WebGL画像。
- `after-lifecycle/report.json`：最終描画まで待った復帰試験。
- `reduced-full-story/report.json`：全BEYOND再生。
- `main-save-export/report.json` と実ダウンロードMarkdown：保存・読込・書き出し。

既存の総合試験 `check-true-end-browser.mjs --separator-only` は、このQAサーバーが `/story` を提供しないため404から開始待機タイムアウトとなった（`sections/report.json`）。合格扱いしていない。章の動作は、利用可能な `/#story` 経路から入る新しい焦点試験で実際に検証した。

Windows上のChromeと画面幅・低能力条件のエミュレーションによるローカル検証。650ms停止と非表示状態は意図的に模擬し、コンテキスト喪失はWebGL拡張で発生させたもの。物理スマートフォン、実GPU障害、本番配信、実データ提供APIの試験ではない。

ローカル修正のみ。push・deploy・公開・ZIP作成はしていない。既存の公開権利チェックの不一致を承認済みに変更していない。

## 対象版 SHA-256

- 修正前 `true-end-webgl.js`：`e7cd1d6730b1405d97a2c61e319c25bfae73c49fd245c7b13886fa91ff2df844`
- 修正後 `true-end-webgl.js`：`47a4860493218296d42879a8846177273b6266d465d5b3e609bb6bdf1e66731d`
- `gaia-mode-loader.js`：`9bd432703892b91fdd993c294066ee4f9f7f06b1beab743a3fa29c78e0aefabf`
- `index.html`：`53007d5d39030bbacca10f9519c76b122610b7c14f66217db30bb4d093047a40`
- 未変更 `true-end-mode.js`：`6f4c5b572f69ae05329a9c14c217402aa72df7a9a5cf25ee520aeba021381fa4`
- 未変更 `true-end.css`：`d381788e86ba7f5904e9a29cb63959ef36d4bf1d753dfdc155efbc587713f648`
