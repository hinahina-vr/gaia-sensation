# 05 / 06 表示名交換

- 05: WELCOME / つながる世界、06: AFTER SCHOOL / 惑星の放課後。
- ローカル作業ツリー（基点 bd6c1c3）。章番号・ID・本文・進行順は変更なし。凍結原稿を保持し、ビルド時の表示名変換として適用。
- `node scripts/check-novel-story.mjs` 合格（6 章・380 step および既存 LOG 契約）。
- `node scripts/export-current-story-script.mjs --check` 合格（380 + 164 step）。
- `node scripts/check-chapter-name-swap-browser.mjs` 合格。インストール済み Chrome headless、1440 / 390 px の章ジャンプ画面で双方の名称を確認。両サイズのスクリーンショットを目視確認。
- 証跡: artifacts/chapter-name-swap-20260912。遷移アニメーション全体の再試験は未実施（共通の章データの名称のみ変更）。
- git diff --check 合格。未コミット・未公開。
