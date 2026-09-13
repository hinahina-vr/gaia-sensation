# 利用規約の入口とたたき台

- 入口ガイドの左に利用規約ボタンを追加。native dialog で本文を開く。
- 本文は確認用のたたき台。閲覧・閉じるを同意と扱わない。公開前に連絡窓口、個人情報の取扱い、施行日・変更案内の確定と法務確認が必要。
- 消費者庁の消費者契約法逐条解説を参考に、一律の責任免除は設けていない: https://www.caa.go.jp/policies/policy/consumer_system/consumer_contract_act/annotations
- 既存センサー利用条件を読み、公開内容、機器管理、バックアップの注意を要約。全文へ別タブでリンク。
- Chrome headless、1440/390幅で check-site-terms-browser.mjs 合格。ボタンの左右配置、表示、8項目、横はみ出し、Escape、フォーカス復帰、Enter再開、閉じるボタンを検証。390pxの本文スクリーンショットを目視確認。
- 証跡: artifacts/site-terms-20260912。スマホはエミュレーション。ローカルのみ、未公開。
