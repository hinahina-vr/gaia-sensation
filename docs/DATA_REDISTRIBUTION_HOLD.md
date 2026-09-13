# 独自データ配布の保留（2026-09-13）

ユーザー依頼：GAIA SENSEWAREとしてのデータ配布は、権利関係が確認できるまで保留。

画像の「Paired-country forest × urban comparison」のURLは `./scripts/build-gaia-data.mjs` であり、元データではなく生成スクリプトだった。出典台帳でGAIA SENSEWARE名義の「元データを開く」を外し、「作品内の加工・計算」と表示する。加工者表記と提供元への出典リンクは残す。

これはUI上の配布・内部ファイルへの導線の停止であり、公開サーバー上のファイル削除・アクセス制限ではない。ブラウザ表示用JSONは引き続き必要で、取得可能。リンクを隠すだけで再配布に関する権利問題が解決するとは扱わない。公開環境への変更は未実施。

## 確認結果

世界銀行のデータは原則CC BY 4.0＋追加条件。ただし個別メタデータに例外があり、第三者提供データには別条件・同意が必要な場合がある。加工後の独自名義にするだけでは提供元の条件がなくならない。

- https://data.worldbank.org/summary-terms-of-use
- https://databank.worldbank.org/metadataglossary/world-development-indicators/series/AG.LND.FRST.ZS （FAOSTAT由来）
- https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SP.URB.TOTL.IN.ZS

既存 docs/rights-review.json の確認範囲は非営利Web公開・展示で、データパッケージの一般再配布を一括承認した記録ではない。該当の加工データは権利台帳でtermsUrl未設定。全同梱データの再配布を「完全にOK」と結論づける証拠は不足している。

再開前に、配布対象を確定し、個別の利用条件、第三者由来データの例外、指定引用、加工表示、ライセンス添付、再配布先に引き継ぐ条件を確認する。現時点では適法性の包括的な保証はしない。
