// 再評価の6件を修正後の実ブラウザ証跡と照合し、比較画像付きの報告を生成する。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const out='artifacts/responsive-followup-20260913';
const read=f=>JSON.parse(fs.readFileSync(`${out}/${f}`,'utf8'));
const current=read('verified/results.json'),regression=read('verified-regression/results.json'),charts=read('verified-charts-final/results.json');
const manifest=read('verified-analysis/manifest.json'),analysis=read('verified-analysis/results.json');
assert.equal(analysis.results.length,9);assert(analysis.results.every(r=>r.passed));assert.equal(analysis.errors.length,0);
const settled=read('verified-poi/results.json');
assert.equal(settled.results.length,3);assert(settled.results.every(r=>r.passed));assert.equal(settled.errors.length,0);
current.results=current.results.map(r=>({...((r.id.startsWith('E03')?analysis.results:r.id.startsWith('E02')?settled.results:[]).find(n=>n.id===r.id)||r),source:r.id.startsWith('E03')?'verified-analysis':r.id.startsWith('E02')?'verified-poi':'verified'}));
fs.mkdirSync(`${out}/accepted`,{recursive:true});fs.writeFileSync(`${out}/accepted/results.json`,JSON.stringify(current,null,2));
const imagePath=(i,name)=>`${i.id==='E03'?'verified-analysis':i.id==='E02'?'verified-poi':'verified'}/${name}`;
const suites=[['6件の受入・境界幅・多言語','accepted',current.results,69],['旧9件の関連回帰','verified-regression',regression,25],['グラフと記録参照の回帰','verified-charts-final',charts.results,6]];
for(const [,name,results,count] of suites){assert.equal(results.length,count,name);assert(results.every(r=>r.passed),`${name}: failed checks`);}
assert.equal(current.errors.length,0);assert.equal(charts.errors.length,0);
for(const [file,hash]of Object.entries(manifest.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,`${file}: changed since final test`);
const base=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync(`${out}/manifest.json`,JSON.stringify({...manifest,base,evidence:'accepted/results.json',lastChange:'幅600px以下の分析ヘッダーのみ行分け。影響する軸名・回転9ケースとグラフ6ケースを再試験し、その他の通過済み証跡を再利用。'},null,2));
const originals=JSON.parse(fs.readFileSync('artifacts/responsive-reevaluation-20260913/issues.json','utf8'));
const changes={
 E01:{fix:'901〜1399pxでは見出しを独立した行に配置。凡例の上端を見出し・展示ナビの実寸に連動させ、前後の矢印を塞がない配置にしました。',test:'900/901/1024/1199/1200/1201/1399/1400px × 日英中 × 展示08/70の48条件。見出しの両矢印と大きな前後ボタンを、強制クリックを使わず操作して展示番号の変化を確認。',after:'E01-1200-en-8.png',extra:'E01-901-en-70.png'},
 E02:{fix:'同じ地点・年・値を表示する追随吹き出しを、通常の展示地図では数値凡例と観測パネルに集約しました。物語内の地図には適用しません。',test:'1024×768の日英中。自動再生で異なる3地点への遷移を待ち、停止後は北海道・東京・沖縄の3地点をキーボード選択。凡例の表示と、重複吹き出しが出ないことを確認。',after:'E02-en.png',extra:'E02-ja.png'},
 E03:{fix:'翻訳済みの軸名をCanvasの実際の文字幅で折り返し、その行数に合わせてグラフの描画余白を確保しました。小型画面の分析見出しとAIなどの操作ボタンも別の行に分けました。数値の計算は変更していません。',test:'320/375/390px × 日英中の9条件。文字幅・プロット高さを計測し、844×390への回転後も再検査。ヒストグラム・散布図のキーボード操作から元の記録に到達する6ケースも合格。',after:'E03-320-en.png',extra:'E03-320-zh-CN.png'},
 E04:{fix:'高さ600px以下では保存カードを低いリストに変更。小幅では内容の高さに合わせて伸ばし、日時・場面・操作を分離。閉じるボタンには音量ボタンと干渉しない余白を設けました。保存の注意書きは残しています。',test:'英語の844×390／1024×500／320×568。保存1件が一覧内に収まり、日時・タイトル・抜粋が重ならないこと、閉じる操作、保存→ページ再読み込み→LOADによる進行位置の一致を確認。',after:'E04-844.png',extra:'E04-320.png'},
 E05:{fix:'画面上の出典リンクを11pxに拡大したうえで、読みやすい出典一覧を開くボタンを追加。一覧内のリンクは15px、閉じる操作は44px。Tabの循環とEscapeの処理を地図のショートカットから分離しました。',test:'1024×768の日英中で出典5リンクの表示・キーボード到達・クリック可能領域を確認。Escapeで閉じた後は地図を閉じず、出典ボタンへフォーカスを戻します。外部リンク先の通信は対象外。',after:'E05-ja.png',extra:'E05-en.png'},
 E06:{fix:'幅920px以下に曲名と再生／一時停止の固定ミニプレイヤーを追加。既存の音声・再生状態を共有し、一覧の表示領域とは分けて最後の曲を覆わない配置にしました。',test:'英語の320×568／390×844／844×390。1・6・12曲目を通常選択し、スクロールを戻さず一時停止。本体とミニプレイヤーの状態一致、選択曲と操作ボタンの表示・ヒット領域を確認。',after:'E06-320.png',extra:'E06-844.png'},
};
const issues=originals.map(i=>({...i,status:'受入条件で修正確認',...changes[i.id]}));
const save=current.results.find(r=>r.id==='E04-844').evidence;
const total=suites.reduce((n,s)=>n+s[2].length,0);
const intro=`再評価で残った6件（中4・低2）をローカルで修正しました。最終受入69ケース、旧指摘の関連回帰25ケース、グラフ回帰6ケースの合計${total}ケースに合格。これは全端末・全画面の無欠陥を保証する数ではありません。`;
const scope='依頼原文:「じゃそれ直して」。対象は直前の再評価で確定したE01〜E06。製品コードの修正と関連経路の再試験を実施し、コミット・push・デプロイは行っていません。以前のレポートと試行中の証跡も保存しています。';
const environment=`Windows / 実Chrome ${manifest.browser}（headless、Playwrightによる操作）。CSSピクセルでの画面サイズ変更と、モバイルのtouch・DPRエミュレーションです。基準コミット ${base} + 既存変更を含む未コミットの作業ツリー。検証はローカル静的プレビュー、外部HTTPSを遮断した同梱データで実施しました。`;
const motion='E01の幅・言語マトリクスは動きを減らす設定、E02〜E06は通常アニメーション。E01の報告条件は通常アニメーションでもprobeで確認済み（その後の修正は出典ダイアログのキーボード処理・保存画面・音楽画面）。待機前の初期描画を最終表示として扱っていません。';
const limitations='未確認: スマホ・タブレット実機、Safari／Firefox、OS文字拡大・200%ブラウザズーム、ブラウザバー伸縮・ソフトキーボード、実端末性能、実音の聴感、外部API／AI通信、全物語・全曲・71展示の全端末総当たり、公開版、新規clone・依存再導入。実機・公開環境で確認したとはしていません。';
const remaining='UIとは別に、提出準備の確認で残っている3件（初期転送量の予算超過、権利台帳stale、総合checkのmatchMediaスタブ不足）は今回の修正対象外で、未解消です。提出全体の合格を意味しません。';
const history='途中のfinalには7ケースの失敗がありました。出典ダイアログでEscapeが地図まで閉じる問題、保存画面の閉じるボタンと音量ボタンの重なり、横向き音楽一覧と固定バーの重なりです。追加修正と、保存カード内部の重なりも検出する検査を加え、verifiedで69ケースを通し直しました。E02の比較画像は同じ製品版で数値アニメーション完了後まで待ったverified-poiの再確認を使用しています（同一3ケースの再実施は100ケースに重複加算しません）。最後に幅600px以下の分析見出しと操作ボタンを別行にした後、E03の9ケースとグラフ6ケースを再試験。他画面の変更はないため、通過済みの影響しないケースを再利用しました。accepted/results.jsonに各ケースの証跡フォルダーを記録しています。途中の結果は削除していません。';
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const table=(heads,rows)=>`<div class="table"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const figure=(src,label)=>{assert(fs.existsSync(path.resolve(out,src)),src);return `<figure><a href="${src}"><img src="${src}" loading="lazy" alt="${esc(label)}"></a><figcaption>${esc(label)} · クリックで原寸</figcaption></figure>`;};
const sections=issues.map(i=>`<section id="${i.id}"><h2>${i.id} ${esc(i.title)}</h2><p class="muted">修正前の重要度: ${i.severity} / ${esc(i.conditions)}</p><p>${esc(i.fix)}</p><p class="check">確認: ${esc(i.test)}</p><div class="pair">${figure(`../responsive-reevaluation-20260913/${i.image}`,'修正前')}${figure(imagePath(i,i.after),'修正後')}</div><details><summary>別条件の確認画像</summary>${figure(imagePath(i,i.extra),'修正後・別条件')}</details></section>`).join('');
const coverage=suites.map(([title,name,results])=>[title,`${results.length}/${results.length} 合格`,`${name}/results.json`]);
const summary=issues.map(i=>[i.id,i.severity,i.title,i.status]);
let md=`# レスポンシブ残件6件・修正確認\n\n2026-09-13\n\n${intro}\n\n${scope}\n\n## 確認環境\n\n${environment}\n\n${motion}\n\n[対象ファイルのSHA-256](manifest.json)\n\n## 検証結果\n\n`;
for(const [name,folder,results]of suites)md+=`- ${name}: ${results.length}/${results.length} 合格 — [結果JSON](${folder}/results.json)\n`;
md+=`\n横向きSAVEは一覧の高さが約93pxから${Math.round(save.list.h)}pxへ増え、${Math.round(save.card.h)}pxの保存1件を全体表示できます。\n\n`;
for(const i of issues)md+=`## ${i.id} ${i.title}\n\n修正前の重要度: ${i.severity}。${i.conditions}\n\n${i.fix}\n\n確認: ${i.test}\n\n![修正前](../responsive-reevaluation-20260913/${i.image})\n\n![修正後](${imagePath(i,i.after)})\n\n[別条件の確認画像](${imagePath(i,i.extra)})\n\n`;
md+=`## 未確認・残件\n\n${limitations}\n\n${remaining} [提出準備の記録](../../docs/SUBMISSION_STATUS.md)\n\n## 証跡の履歴\n\n${history}\n\n静的構文チェックと統計計算の単体試験も実施。単体試験を実画面検証の代わりにはしていません。レポート生成時に最終試験の対象7ファイルのSHA-256が現在と同じことを照合しています。成果物はGit管理外のローカル証跡です。\n`;
fs.writeFileSync(`${out}/REPORT.md`,md);
fs.writeFileSync(`${out}/issues.json`,JSON.stringify(issues,null,2));
fs.writeFileSync(`${out}/REPORT.html`,`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GAIA SENSEWARE / レスポンシブ修正確認</title><style>*{box-sizing:border-box}body{margin:0;background:#eaf1f3;color:#173542;font:16px/1.85 system-ui,sans-serif}header{background:#113e49;color:#f1faf6;padding:36px max(20px,calc((100vw - 1120px)/2))}h1{font-size:clamp(24px,3vw,38px);line-height:1.45;margin:12px 0}main{max-width:1160px;margin:auto;padding:28px;background:white}h2{font-size:22px;line-height:1.6;margin:28px 0 14px}p{overflow-wrap:anywhere}a{color:#08757c}header a{color:#b9efde}nav{display:flex;gap:16px;flex-wrap:wrap}.muted{color:#536d77;font-size:14px}.check{padding:14px;background:#edf6f1;border-left:4px solid #338d71}.notice{padding:16px;border-left:4px solid #c89a40;background:#fff4df}.table{overflow:auto}table{width:100%;min-width:620px;border-collapse:collapse;font-size:14px}th,td{padding:12px;border:1px solid #c6d9df;text-align:left;vertical-align:top}th{background:#edf5f6}section{border-top:1px solid #cedee3;margin-top:32px;padding-top:10px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;padding:10px;border-radius:8px;background:#eaf0f4}figure img{display:block;width:100%;height:380px;object-fit:contain}figcaption{text-align:center;font-size:13px;margin-top:8px}details{margin:16px 0;padding:14px;border:1px solid #cedee3}summary{cursor:pointer;font-weight:600}details figure{margin-top:12px}code{overflow-wrap:anywhere}footer{margin-top:28px;color:#546c76;font-size:14px}@media(max-width:650px){main{padding:18px}.pair{grid-template-columns:1fr}h2{font-size:20px}figure img{height:330px}}</style></head><body><header><p>GAIA SENSEWARE · LOCAL QA · 2026-09-13</p><h1>再評価の残件6件を修正<br>比較画像と回帰確認</h1><p>${esc(intro)}</p><nav><a href="#results">検証結果</a><a href="#E01">比較画像</a><a href="REPORT.md">Markdown</a><a href="manifest.json">対象版</a></nav></header><main><p>${esc(scope)}</p><h2 id="results">最終確認</h2><p class="muted">${esc(environment)}</p><p>${esc(motion)}</p>${table(['試験','結果','証跡ファイル'],coverage)}<nav>${suites.map(([name,folder])=>`<a href="${folder}/results.json">${esc(name)} JSON</a>`).join('')}</nav><p class="check">横向きSAVEの一覧: 約93px → ${Math.round(save.list.h)}px。${Math.round(save.card.h)}pxの保存1件を全体表示できます。保存して再読み込みした後のLOADも確認済みです。</p>${table(['ID','修正前重要度','問題','状態'],summary)}${sections}<h2>未確認の範囲</h2><p>${esc(limitations)}</p><p class="notice">${esc(remaining)} <a href="../../docs/SUBMISSION_STATUS.md">提出準備の記録</a></p><h2>検証履歴・再現性</h2><p>${esc(history)}</p><p>構文チェックと統計計算の単体試験も実施。最終試験の対象7ファイルはレポート生成時にSHA-256の一致を検査しています。画面上のリンクの到達性と、リンク先サービスの稼働確認は区別しています。</p><nav><a href="../responsive-reevaluation-20260913/REPORT.html">修正前の再評価</a><a href="final/results.json">途中の失敗記録</a><a href="issues.json">対応一覧JSON</a></nav><footer>このレポートはローカルの証跡です。コミット・push・デプロイは未実施。既存のユーザー変更・過去の監査証跡は保持しています。</footer></main></body></html>`);
console.log(`Report generated: ${issues.length} fixes, ${total} passing cases; product hashes unchanged.`);
