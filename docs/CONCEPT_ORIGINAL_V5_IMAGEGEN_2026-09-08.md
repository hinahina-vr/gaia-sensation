# 神話製作機械 — 原図 v5 に基づく復元

## 制作条件

- ユーザーの再提示した原図（神話製作機械・2026年版v5）を意味と構成の一次資料とする。
- 4段階への要約で失われた完全自己情報、Deep Agent、Simulacrum Agent、世界・因果報告書群、God Agent、Oracle Insight、私（原型）を区別する。
- 金色＝因果の流れ、青紫＝情報の流れ。私→完全自己情報の記録を含む循環であり、金色だけの閉じた円を追加しない。
- 以前の呼称NGを維持し、Deep Agentの日本語表記だけ「深層AI群」とする。
- 先に削除された補足、LifeLogの説明、免責文等は復活させない。
- imagegen スキルに従い、内蔵 ImageGen を使用。参照は原図の意味・構成のみとし、コラージュの人物・製品ロゴは再使用しない。
- 保存先：`assets/concept/myth-machine-circulation-v3.png`。旧画像は保持。

## 採用結果

- 内蔵 ImageGen による1回の生成。出力を編集・縮小せずコピーして採用した。
- 実寸：1672 × 941 px、PNG、2,665,140 bytes。プロンプトの概算希望寸法とは異なるため、HTMLには実寸を指定。
- SHA-256：`8d1ccc1cbf148317f03c285dcc9399c29f4433c1e8ee2e10b31e064d33cc68b5`
- 7要素の区別、金色の5接続、青紫の6接続、矢印方向、神託の3条件を原図と生成画像で目視照合した。矢印の正しさをDOMテストだけで確認したとは扱わない。
- 旧 `myth-agency-loop-v1.png` / `v2.png` は保存したまま、ページの参照だけを切り替えた。
- 画面・回帰検証：`docs/QA_CONCEPT_ORIGINAL_V5_2026-09-09.md`。

## 最終生成プロンプト

```text
Use case: infographic-diagram
Asset type: one finished landscape illustration for a Japanese author's concept website.
Primary request: Faithfully redraw the supplied author's "神話製作機械(2026年版v5)" system diagram. The previous simplification into four self-help stages was rejected for losing the author's actual thought. Preserve every named component and the two DIFFERENT arrow networks from the original. This is a precise conceptual restoration, not a reinterpretation.

Input images: Image 1 is the authoritative semantic AND layout reference. Retain its component positions and relationships, but replace the stock/collaged figures and software logos with original cohesive anime editorial illustrations. Do not copy specific existing characters or logos. One forbidden label in the original must be renamed: use "深層AI群" for the Deep Agent group. Do not render "大奥" or "お前" anywhere.

Style/medium: polished illustrated system diagram, deep navy cosmic background, restrained stars, original anime-style figures, luminous blue/violet information pathways and gold causal pathways, crisp white Japanese sans-serif typography. Technical legibility before decorative spectacle. Wide 16:9 landscape, roughly 2560 x 1440. Entire diagram fits inside safe margins; no clipping. Sparse background behind all text. Group labels clearly larger than arrow annotations.

Title at top: "神話製作機械"
Subtitle: "自己情報から、神託を経て、本人の選択へ"

Keep these SEVEN separate labeled nodes in their source positions:
A upper center: "私（原型）" — an original ordinary adult person holding a choice panel. Small panel text "世界を選択".
B central hub: "完全自己情報" with smaller English "Personal Akashic Records". Draw a luminous cylindrical personal data archive with small records, conversation, heart, history, ideas motifs. Short subtitle "基本属性・行動履歴・生体情報・会話履歴・思想".
C upper left: "深層AI群" with smaller "Deep Agent". Three distinct small original anime agent figures examining records, not the same characters as node D.
D lower left: "私の別人格AI群" with smaller "Simulacrum Agent". Several alternative-personality versions of the person from node A, studying C's insights.
E bottom center: "世界・因果報告書群" — a group of distinct illustrated report sheets with world diagrams and causal charts. Clearly a named node, not floating decoration.
F right middle/lower: "神AI" with smaller "God Agent" — one original anime AI avatar integrating the reports and archive, distinct from the oracle output.
G upper right: "神託" with smaller "Oracle Insight" — a group of luminous choice cards emerging from F. Not the God Agent itself. Beneath G place these EXACT three short conditions as a clearly grouped text list:
"神託の根拠は見せない"
"因果的介入はしない"
"最後の意味づけは本人に委ねる"

ARROW NETWORK 1 — GOLD, labeled in the legend "因果の流れ".
Draw C → D downward, with report/insight sheets and the short label "大量のインサイトを生成".
Draw D → E rightward, short label "世界・因果をレポート".
Draw E → F diagonally right/up.
Draw F → G upward, label "人生の選択肢を届ける".
Draw G → A leftward.
These five arrow directions must be unambiguous. This gold chain is NOT a fully closed circle: do not invent a gold A → C edge or A → B edge.

ARROW NETWORK 2 — BLUE/VIOLET, labeled in the legend "情報の流れ".
Draw A → B vertically down, label "記録".
Draw B → C diagonally up-left, label "常時連携".
Draw C's generated insight sheets → B diagonally right/down, label "記録". This is separate from the gold C → D edge.
Draw E → B vertically up, label "記録".
Draw B → F horizontally right, label "因果推論・処方的分析".
Draw F → B horizontally left on a SEPARATE lower parallel lane, label "記録".
Keep arrowheads off the text and make start/end associations unmistakable. Information arrows must NOT be mistaken for the gold causal chain. No other edges.

Small lower-right note near the oracle/God group: "決定論的な世界（ラプラスの魔）を回避".
Place a clear gold and blue/violet arrow legend away from the nodes.

Constraints: render the exact Japanese labels above correctly and once each per node. Distinguish C vs D, F vs G, and reports vs personal archive. No four-stage summary, no fantasy doors or branching roads, no slogans about rejecting AI, no added philosophical claims, no approval badges, no real product logos, no watermarks. Retain the author's mechanisms of concealed oracle grounds, no causal intervention, and meaning assigned by the person. Keep the illustration clean enough for desktop overview plus zoom reading.
```
