// Measured comparisons, not a catalogue of social questions. No inference of
// causal effects, risk thresholds, or missing business dimensions.
import {descriptive, simpleRegression} from './statistics-lab-core.js';
const num=x=>typeof x==='number'&&Number.isFinite(x);
const fmt=x=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:Math.abs(x)<.01&&x!==0?5:2}).format(x);
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const avg=xs=>sum(xs)/xs.length;
const name=r=>String(r.countryJa||r.label||r.name||r.id||'対象');
const period=r=>/^\d{4}$/.test(String(r.label))?`${r.label}年`:name(r);
const span=rs=>rs.length===1?period(rs[0]):`${period(rs[0])}〜${period(rs.at(-1))}`;
const sorted=rs=>[...rs].sort((a,b)=>b.value-a.value||String(a.id).localeCompare(String(b.id)));
const ids=rs=>rs.map(r=>String(r.id));
const result=(headline,summary,metrics,records,extra={})=>({headline,summary,metrics,recordIds:ids(records),status:'computed',...extra});

function contributions(dataset,domain,rows) {
 const rank=sorted(rows),total=sum(rank.map(r=>r.value));
 if(rows.some(r=>r.value<0)||!(total>0))return null;
 const top=rank.slice(0,Math.min(3,rank.length)),topTotal=sum(top.map(r=>r.value)),share=100*topTotal/total;
 let cumulative=0,count80=0;while(cumulative<total*.8&&count80<rank.length)cumulative+=rank[count80++].value;
 const unit=dataset.unit||'',names=top.map(name).join('・');
 const label=domain==='prtr'?'届出質量':dataset.valueLabel||dataset.yLabel||'収録量';
 const details=top.map(r=>`${name(r)} ${fmt(r.value)}${unit}（${fmt(r.value/total*100)}%）`).join('、');
 let conclusion=domain==='emissions'
  ? `排出総量への寄与からみた重点対象は${names}です。仮にこの${top.length}対象だけが各10%削減し、他が不変なら、収録全体は${fmt(topTotal*.1)}${unit}、${fmt(share*.1)}%減ります（効果予測ではなく条件付き試算）。`
  : domain==='population'?`${names}だけで、収録人口の${fmt(share)}%に相当します。人口を基準としたサービスの対象規模は、この${top.length}対象で合計${fmt(topTotal)}${unit}です。`
  : domain==='prtr'?`質量ベースで届出内訳を点検する際、まず${names}を押さえると全届出質量の${fmt(share)}%を説明できます。毒性や危険度の寄与率ではありません。`
  : domain==='lodging'?`宿泊実績の規模では${names}が主要な受け入れ先です。この${top.length}地域を除く残りの実績は全体の${fmt(100-share)}%です。`
  : domain==='housing'?`着工実績は${names}に計${fmt(topTotal)}${unit}集中しています。施工・供給の動きを追う対象を総量から絞るなら、この${top.length}地域が全体の${fmt(share)}%を占めます。`
  : `強い熱放射の記録は${names}に集まっています。上位${top.length}検知の記録FRP合計が全記録の${fmt(share)}%です。同時出力・被害規模ではありません。`;
 return result(`${names}が${label}の${fmt(share)}%を占める`,`${details}。${conclusion} 合計の80%に達する最少の上位対象数は${count80}/${rows.length}件です。`,
  [['上位3件の構成比',share,'%'],['80%に達する上位対象数',count80,'件'],['収録合計',total,unit]],top,
  {calculation:'非負の有効値を降順に並べ、上位3件と累積80%到達件数を計算。分母は絞り込み後の有効値合計。',scenario:domain==='emissions'?{assumedReductionRate:.1,selectedRecordIds:ids(top),absoluteReduction:topTotal*.1,totalReductionPercent:share*.1}:null});
}

function temporal(dataset,domain,rows,key) {
 let ordered=[...rows].filter(r=>num(r.x)).sort((a,b)=>a.x-b.x||String(a.id).localeCompare(String(b.id)));
 if(new Set(ordered.map(r=>r.x)).size!==ordered.length||ordered.length<2)return null;
 const source=r=>r.sourceSeries||'';
 const mixed=new Set(ordered.map(source)).size>1;
 if(mixed)ordered=ordered.filter(r=>source(r)===source(ordered.at(-1)));
 if(ordered.length<2)return result('同一系列での比較結果は未成立','出典・方式の異なる記録を除くと比較相手が不足します。系列をまたぐ増減は算出していません。',[],ordered,{status:'insufficient'});
 const k=Math.max(1,Math.min(10,Math.floor(ordered.length/3)));
 const early=ordered.slice(0,k),late=ordered.slice(-k),a=avg(early.map(r=>r.value)),b=avg(late.map(r=>r.value)),delta=b-a;
 const stats=descriptive(ordered.map(r=>r.value)),last=ordered.at(-1);
 const unit=dataset.unit||'',diffUnit=unit==='%'?'ポイント':unit,label=dataset.valueLabel||dataset.yLabel||'値';
 const higher=delta>0,changed=Math.abs(delta)>1e-9;
 const beyond=late.filter(r=>higher?r.value>Math.max(...early.map(r=>r.value)):r.value<Math.min(...early.map(r=>r.value))).length;
 const direction=changed?(higher?'上昇':'低下'):'同水準';
 const ratioAllowed=changed&&!['temperature','temperature-high','temperature-low','ph','migration'].includes(key)&&a>0&&b>=0;
 let conclusion=changed?`初期の平均を現在の基準値として使うと、直近${k}記録の平均を${fmt(Math.abs(delta))}${diffUnit}${higher?'低く':'高く'}見積もります。`:'比較した両期間の平均には差がありません。';
 if(key==='sunshine')conclusion=`直近の年間日照の実績は初期基準より平均${fmt(Math.abs(delta))}時間${higher?'多く':'少なく'}、日照時間の年間計画値にはこの差が生じています。`;
 if(key==='co2')conclusion=`${higher?'濃度の蓄積は続いており、初期水準へ戻っていません。':'この選択期間の濃度水準は初期より低くなっています。'}`;
 if(key==='food_import')conclusion=`穀物輸入依存度は${fmt(a)}%から${fmt(b)}%へ${direction}し、供給に占める国外への依存が${fmt(Math.abs(delta))}ポイント${higher?'大きく':'小さく'}なっています。`;
 if(key==='food_balance')conclusion=`直近${k}記録中、自給率100%未満は${late.filter(r=>r.value<100).length}記録。各期の比率の単純平均は${fmt(b)}%で、期間を合算した生産量／供給量の比ではありません。`;
 if(key==='food_energy')conclusion=`直近平均の供給充足率は${fmt(b)}%で、平均必要量に対し${fmt(Math.abs(b-100))}ポイント${b>=100?'上':'下'}です。国平均の供給比であり個人の摂取充足率ではありません。`;
 if(key==='biology')conclusion=`確認分類群数の記録は直近平均${fmt(b)}${unit}で、初期より${fmt(Math.abs(delta))}${unit}${higher?'多く':'少なく'}なっています。調査記録内の差であり、個体数や生物多様性の変化ではありません。`;
 if(key==='ph')conclusion=`pH値の平均差は${fmt(Math.abs(delta))}です。pH値の差として比較し、水素イオン濃度の平均や変化率へは換算していません。`;
 return result(`${label}：${span(early)}→${span(late)}で${fmt(Math.abs(delta))}${diffUnit}${direction}`,
  `${mixed?'出典・方式をまたがず、最新記録と同じ系列内で比較。':''}${span(early)}の平均${fmt(a)}${unit}に対し、${span(late)}は${fmt(b)}${unit}${ratioAllowed?`（${fmt(Math.abs(delta/a*100))}%${higher?'増':'減'}）`:''}。${conclusion} ${changed?`直近${k}記録中${beyond}記録が初期期間の${higher?'最大':'最小'}値を${higher?'上回り':'下回り'}、${beyond===k?'両期間の範囲も分離しています':'両期間の値域には重なりがあります'}。`:''}`,
  [['初期期間の平均',a,unit],['直近期間の平均',b,unit],['平均差',delta,diffUnit]], [early[0],late[0],last],
  {calculation:`同一系列内の最初・最後各${k}記録の平均差と値域の重なりを計算。窓は事前固定ルール min(10,floor(n/3))、最低1。因果・予測・有意差検定ではない。`,details:{baseline:span(early),recent:span(late),window:k,change:delta,beyond,range:stats.range}});
}

function distribution(dataset,rows,key) {
 const stats=descriptive(rows.map(r=>r.value)),rank=sorted(rows),top=rank[0],low=rank.at(-1),unit=dataset.unit||'',du=unit==='%'?'ポイント':unit;
 const gap=top.value-low.value,above=rows.filter(r=>r.value>stats.q3+1.5*(stats.q3-stats.q1));
 const topGap=top.value-stats.median;
 const observation=`${name(top)}は${fmt(top.value)}${unit}、${name(low)}は${fmt(low.value)}${unit}で、差は${fmt(gap)}${du}。中央値${fmt(stats.median)}${unit}に対し${name(top)}は${fmt(topGap)}${du}高く、中央の半数は${fmt(stats.q1)}〜${fmt(stats.q3)}${unit}です。`;
 const consequence=above.length?`上側の四分位基準を超えるのは${above.length}/${rows.length}件（${above.slice(0,3).map(name).join('・')}${above.length>3?'など':''}）で、高値は全対象に共通せずこの層に偏っています。`:`上側の四分位基準を超える記録は0/${rows.length}件で、最大値だけが上側に孤立した分布ではありません。`;
 return result(`${name(top)}と${name(low)}で${fmt(gap)}${du}の差`,observation+consequence,
  [[`${name(top)}`,top.value,unit],[`${name(low)}`,low.value,unit],['中央値',stats.median,unit]],[top,low],
  {calculation:'対象名付きの最大・最小・中央値とQ3+1.5×IQR超過件数を計算。順位・四分位基準は安全性や政策評価ではない。',details:{gap,median:stats.median,upperTailCount:above.length,upperTailRecordIds:ids(above)}});
}

export function buildDecisionInsight(dataset,domain,candidate,rows,profileKey) {
 const unit=dataset.unit||'';
 if(!rows.length)return result('分析できる記録がありません','有効な記録が0件のため、差・寄与・変化の結果は出せません。',[],[],{status:'insufficient'});
 if(rows.length===1)return result('比較結果は未成立',`${name(rows[0])}は${fmt(rows[0].value)}${unit}。有効値が1件のため、増減・順位・寄与率は算出できません。`,[[name(rows[0]),rows[0].value,unit]],rows,{status:'insufficient'});
 if(candidate.id==='near-peers'&&candidate.comparison) {
  const {points,metrics}=candidate.comparison,m=metrics.find(m=>m.highlight),gap=Math.abs(m.values[0]-m.values[1]);
  const high=m.values[0]>=m.values[1]?0:1,low=1-high;
  const pairs=candidate.chart?.pairs||[];
  const fit=pairs.length>=8?simpleRegression(pairs.map(p=>p.x),pairs.map(p=>p.y)):null;
  const association=fit&&num(fit.rSquared)&&num(fit.correlation)?` 比較可能な${pairs.length}件全体でも、${metrics[0].label}と${m.label}の相関はr=${fmt(fit.correlation)}、単回帰のR²=${fmt(fit.rSquared*100)}%。${metrics[0].label}の直線だけで捉えられる${m.label}のばらつきは${fmt(fit.rSquared*100)}%です（標本内の関係で、因果寄与ではありません）。`:'';
  return result(`${points[high].name}は${points[low].name}より${m.label}が${fmt(gap)}${m.unit==='%'?'ポイント':m.unit}高い`,
   `${metrics.filter(m=>!m.highlight).map(m=>`${m.label}は${points[0].name} ${fmt(m.values[0])}${m.unit}／${points[1].name} ${fmt(m.values[1])}${m.unit}`).join('、')}。それに対し${m.label}は${fmt(m.values[0])}${m.unit}／${fmt(m.values[1])}${m.unit}。${points[low].name}より${points[high].name}の方が${fmt(gap)}${m.unit==='%'?'ポイント':m.unit}高くなっています。${association}`,candidate.evidence,rows.filter(r=>candidate.recordIds.includes(String(r.id))),{calculation:candidate.calculation+(association?' 加えて全有効ペアの切片付き単回帰からrとR²を計算。':''),details:fit?{correlation:fit.correlation,rSquared:fit.rSquared,n:pairs.length}:null});
 }
 if(['opposing-currents','haze-ground-mismatch','shared-rise','two-sided-migration','same-magnitude-depth','uneven-event-years'].includes(candidate.id)) {
  // These extractors already contain a named, computed multi-variable finding.
  // Keep their evidence, not the old profile-level research prompt.
  const headline=candidate.id==='shared-rise'?'3観測所の期間上昇は、同年の地点差より大きい':candidate.signal.split('。')[0];
  return result(headline,candidate.signal,candidate.evidence,rows.filter(r=>candidate.recordIds.includes(String(r.id))),{calculation:candidate.calculation});
 }
 if(domain==='pollination') {
  const links=rows.filter(r=>r.sourceTaxon&&r.targetTaxon&&r.interaction==='pollinates');
  if(!links.length)return result('送粉関係の比較結果は未成立','現在の選択には送粉者と植物の対応記録がありません。生息記録だけから送粉関係は推定しません。',[],[],{status:'insufficient'});
  const taxa=new Map();for(const r of links){if(!taxa.has(r.sourceTaxon))taxa.set(r.sourceTaxon,new Set());taxa.get(r.sourceTaxon).add(r.targetTaxon);}
  const [taxon,plants]=[...taxa].sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0]))[0];
  return result(`${taxon}は${plants.size}分類群の植物と送粉関係が記録されている`,`${[...plants].slice(0,4).join('・')}など、${taxon}は${plants.size}分類群の植物を結ぶ共通の送粉者です。植物別に別々の関係として見るだけでは、この共通性を見落とします。収録された送粉者は${taxa.size}分類群で、関係の有無を示す記録です。送粉の依存率や、この種が減った場合の収量損失は算出していません。`,[['結び付く植物分類群',plants.size,'分類群'],['収録送粉者',taxa.size,'分類群']],links.filter(r=>r.sourceTaxon===taxon).slice(0,4),{calculation:'送粉者別に重複しない相手植物分類群を集計。生息記録と整理番号は集計対象に含めない。'});
 }
 if(domain==='culture') {
  const mixed=rows.filter(r=>r.category==='Mixed');
  if(mixed.length)return result(`自然と文化が重なる複合遺産は${mixed.length}件`,`${mixed.map(name).join('・')}は自然・文化の両区分を持つ複合遺産で、収録${rows.length}件の${fmt(mixed.length/rows.length*100)}%です。自然だけ／文化だけの二択では、この${mixed.length}件の両面を表せません。所在は${[...new Set(mixed.map(r=>r.region||r.group))].join('・')}にまたがります。展示用に選んだ事例内の結果で、全世界の遺産の構成比ではありません。`,[['複合遺産',mixed.length,'件'],['収録事例に占める割合',mixed.length/rows.length*100,'%']],mixed,{calculation:'複合区分の実際の遺産名・地域を抽出し、選択範囲内の構成比を計算。'});
  const counts=new Map();for(const row of rows){const key=row.category||'分類記載なし';counts.set(key,(counts.get(key)||0)+1);}
  const rank=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),[top,n]=rank[0],last=rank.at(-1);
  return result(`収録記録は「${top}」が${fmt(n/rows.length*100)}%`,`${rows.length}件中「${top}」が${n}件、「${last[0]}」が${last[1]}件。差は${n-last[1]}件です。${rank.slice(0,3).map(([k,v])=>`${k} ${v}件`).join('、')}という構成で、${domain==='culture'?'この展示で提示される文化の事例':'この標本で確認できる記録'}は${top}が最も多くなっています。現実世界の普及率・個体数の順位ではありません。`,[['最多カテゴリ',n,'件'],['最多カテゴリ構成比',n/rows.length*100,'%']],rows.filter(r=>r.category===top).slice(0,3),{calculation:'カテゴリ別の記録件数と構成比。整理番号を測定値として集計しない。'});
 }
 const isTime=dataset.xKind==='year'||dataset.xKind==='month'||dataset.insightContext?.axis==='time-series'||/^(観測)?(年|月|年月)$/.test(dataset.xLabel||'');
 if(isTime){const computed=temporal(dataset,domain,rows,profileKey);if(computed)return computed;}
 if(['emissions','population','lodging','housing','fire','prtr'].includes(domain)&&!isTime){const c=contributions(dataset,domain,rows);if(c)return c;}
 if(rows.every(r=>r.value===rows[0].value))return result('記録上の差はありません',`${rows.length}件すべて${fmt(rows[0].value)}${unit}。最大と最小の差は0${unit}で、今回の値から優先順位は付けられません。`,[['共通値',rows[0].value,unit],['対象数',rows.length,'件']],rows.slice(0,2),{status:'no-difference'});
 return distribution(dataset,rows,profileKey);
}
