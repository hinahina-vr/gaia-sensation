# 入口下部の説明更新

- 対象: ローカル作業ツリーの index.html、ABOUT GAIA TRANSFORMATION以下の作品構成・データ取得・制作条件・出典紹介。
- 現行入口名に統一。固定の旧展示数を撤去。国内年次データ、総務省統計局・環境省・気象庁、38官署の対象範囲、欠測・集計期間の注意を追記。分析・AI質問は今後実装予定。
- 照合: src/exploration/japan-sensor-open-catalog.js、annual-observation-years.js、estat-exhibit-catalog.js、既存データ取得方針。
- 公開版と提出コードが同一であるとの断定を撤去。描画ライブラリ不使用とサーバー・開発依存を区別。
- Chrome headlessで check-data-access-copy-browser.mjs http://127.0.0.1:4492 が合格。1440×1000、390×844の表示・横はみ出し・説明文・JavaScriptエラーを確認。外部通信は遮断、オーロラ応答は保存データで代替した表示試験。
- 証跡: artifacts/data-access-copy/report.json と画面PNG。公開・外部API実接続の試験ではない。
- 継続残件: ポップアップの「以後表示しない」指定まで毎回表示、フォーカス時0.5秒の光演出は未対応。利用規約ボタン・本文は内容判断待ち。これらを本変更の完了に含めない。
