# ローカル不具合修正・プッシュ対象

2026-09-13。ユーザー指示: 音楽背景は案1、現時点で再現する不具合のみ修正、以前の依頼分も含めてコミット・プッシュ、デプロイ不要。独自データ再配布は保留継続。

## 今回の修正

- 音楽背景v3採用。v2を残し、背景とカバーURLを統一。素材台帳339点へ更新。データ・依存5ファイルは不変で、再配布の権利判断は変更しない。
- VM検査4か所のmatchMedia・document.addEventListener不足を修正。実アプリのブラウザAPI動作は変更しない。
- 公開データ入口、統計モジュールURL、共通明朝書体、5講義3層、指定の結び文に合わせて旧検査を更新。
- 背景位置検査は0.00013px程度の丸めを0.01px許容で処理。目に見える位置ずれを許す緩和ではない。
- スタッフロールの更新済み出典を台本エクスポーターへ同期し、現行統合台本を再生成。

## 今回の検証

- npm run check: 全体が終了コード0。ログ artifacts/local-check-20260913.log。
- npm run check:release-rights: 合格。記録・対象一致の検査で、第三者の許諾取得ではない。
- check-sound-browser.mjs: 12曲、PC/モバイル、再生・音量・シーク等に合格。
- check-sound-adoption.mjs: 1440px/390px、起動画面終了後のv3読込・再生。採用背景の確定画面を目視。画像 artifacts/sound-adoption-20260913/adopted-1440.png / adopted-390.png。
- check-picker-dismiss.mjs: 外へ移動で閉じる・内部移動・再表示・800msに合格。
- check-bi-calculations.mjs / check-chart-calculations.mjs: 計算回帰に合格。
- check-source-collapse.mjs: PC/モバイルで初期閉鎖・展開・再表示閉鎖・加工リンク保留・提供元リンク維持。
- git diff --check: 合格。秘密情報の既知形式検査: 1434ファイル、該当なし。

以前の個別UI・統計修正の証跡は既存 artifacts 各レポートを再利用。全条件を今回再実行したという意味ではない。ローカルChromeと同梱データの検証であり、実機Safari・LIVE実通信・本番動作は未確認。初期読込1MB予算超過は以前の保留を維持し、check:contestの合格は主張しない。デプロイは行わない。

未採用の画像候補・チラシ出力はGitに追加せずローカルに保持する。
