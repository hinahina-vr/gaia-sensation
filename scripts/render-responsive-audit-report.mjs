import fs from 'node:fs';
const out='artifacts/responsive-audit-20260913';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const inline=s=>esc(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
const lines=fs.readFileSync(out+'/REPORT.md','utf8').split('\n');let html='',list=false,table=false;
for(const l of lines){
 if(!l.startsWith('- ')&&!/^\d+\. /.test(l)&&list){html+='</ul>';list=false;}
 if(!l.startsWith('|')&&table){html+='</tbody></table></div>';table=false;}
 if(!l.trim())continue;
 if(l.startsWith('|')){if(/^\|[-| ]+\|$/.test(l))continue;const cells=l.split('|').slice(1,-1).map(c=>inline(c.trim()));if(!table){html+='<div class="table-wrap"><table><thead><tr>'+cells.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>';table=true;}else html+='<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';continue;}
 const head=l.match(/^(#{1,3}) (.*)$/);if(head){const level=head[1].length;html+=`<h${level}>${inline(head[2])}</h${level}>`;continue;}
 const img=l.match(/^!\[(.*?)\]\((.*?)\)$/);if(img){html+=`<figure><a href="${esc(img[2])}" target="_blank"><img loading="lazy" src="${esc(img[2])}" alt="${esc(img[1])}"></a><figcaption>${esc(img[1])} · クリックで原寸画像</figcaption></figure>`;continue;}
 if(l.startsWith('- ')||/^\d+\. /.test(l)){if(!list){html+='<ul>';list=true;}html+='<li>'+inline(l.replace(/^(- |\d+\. )/,''))+'</li>';continue;}
 html+='<p>'+inline(l)+'</p>';
}
if(list)html+='</ul>';
const reports=fs.readdirSync(out+'/final').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(out+'/final/'+f)));
let gallery='<h2 id="gallery">全378画面・条件別ギャラリー</h2><p>条件を開くと21状態を表示します。画像クリックで原寸。各JSONには操作結果とUI矩形が含まれます。</p>';
for(const r of reports){gallery+=`<details class="profile"><summary>${esc(r.id)} — ${r.width} × ${r.height} / ${esc(r.lang)} / ${r.touch?'タッチ設定':'マウス設定'}</summary><p><a href="final/${r.id}.json">測定JSON</a> · ${r.states.length}状態 / ${r.actions.filter(a=>a.passed).length}操作成功</p><div class="gallery">`;
for(const s of r.states)gallery+=`<figure><a target="_blank" href="final/${esc(s.file)}"><img loading="lazy" src="final/${esc(s.file)}" alt="${esc(r.id+' '+s.name)}"></a><figcaption>${esc(s.name)}</figcaption></figure>`;gallery+='</div></details>';}
const page=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GAIA SENSEWARE レスポンシブ監査 cb5e443</title><style>
:root{color-scheme:light;font-family:system-ui,-apple-system,"Yu Gothic",sans-serif;color:#193343;background:#edf3f6}body{margin:0}header{background:#102b3b;color:#edf9ff;padding:36px max(24px,calc((100vw - 1160px)/2));border-bottom:5px solid #41b3ad}header h1{font-size:clamp(23px,3vw,36px);margin:8px 0}header p{color:#c4dce5}nav{display:flex;flex-wrap:wrap;gap:20px}header a{color:#8fe4dd}main{max-width:1160px;margin:0 auto;padding:30px 24px 80px;background:white}h1{font-size:28px}h2{margin-top:44px;padding-bottom:10px;border-bottom:2px solid #cde4e8}h3{margin-top:36px;color:#07585e}p,li{font-size:15px;line-height:1.85}li{margin:7px 0}a{color:#006b79}code{background:#edf2f5;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}strong{color:#153e50}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:780px;font-size:14px}th,td{border:1px solid #d4e0e6;padding:12px;text-align:left;vertical-align:top;line-height:1.7}th{background:#e6f2f3}td:nth-child(2){white-space:nowrap;font-weight:700}figure{margin:24px 0;padding:14px;background:#edf2f5;border:1px solid #d6e2e8;border-radius:10px}figure img{display:block;max-width:100%;max-height:650px;width:auto;height:auto;margin:auto;border-radius:5px}figcaption{text-align:center;color:#425d6a;font-size:13px;margin-top:10px}.profile{border:1px solid #b9d2dc;border-radius:8px;padding:14px;margin:12px 0}.profile summary{cursor:pointer;font-weight:700}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.gallery figure{margin:0;padding:8px}.gallery img{height:170px;width:100%;object-fit:contain}footer{padding:25px;text-align:center;color:#536b78}@media print{header{background:white;color:black}.gallery,nav{display:none}figure{break-inside:avoid}h2,h3{break-after:avoid}}
</style><header><p>GAIA SENSEWARE · UI QUALITY AUDIT · 2026-09-13</p><h1>画面に収まることと、使えることは別。</h1><p>18条件 / 378画面 / 通常導線180操作 / 問題9件 / 対象 cb5e443</p><nav><a href="#report">問題と対応方針</a><a href="#gallery">全スクリーンショット</a><a href="REPORT.md">Markdown版</a><a href="blocked-control.json">追加クリック検証</a></nav></header><main id="report">${html}${gallery}</main><footer>ローカルChromeによる監査。製品未修正・未公開。実機/Safari/Firefox検証は別途必要。</footer></html>`;
fs.writeFileSync(out+'/REPORT.html',page);
console.log('Report rendered',reports.length,'profiles',reports.reduce((n,r)=>n+r.states.length,0),'screenshots');
