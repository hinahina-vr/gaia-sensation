import {descriptive} from './statistics-lab-core.js?v=whole-trends20-20261025';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const ids=rows=>rows.map(r=>String(r.id));
const frameChart=(rows,dataset)=>({type:'scatter',pairs:rows.map(r=>({x:r.x,y:r.value})),rows,xLabel:dataset.xLabel,yLabel:dataset.yLabel||dataset.valueLabel,unit:dataset.unit,yUnit:dataset.unit,observedPath:rows.map(r=>({x:r.x,y:r.value})),xTicks:rows.filter((_,i)=>i===0||i===rows.length-1||i%Math.max(1,Math.ceil(rows.length/4))===0).map(r=>r.x),tickLabels:Object.fromEntries(rows.map(r=>[String(r.x),dataset.xKind==='hour'?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(new Date(r.observedAt))+'時':r.label]))});
const groupChart=(groups,unit,xLabel,yLabel)=>({type:'scatter',pairs:groups.map((g,i)=>({x:i+1,y:g.mean})),rows:groups.map((g,i)=>({id:g.id,label:g.name,x:i+1,value:g.mean,y:g.mean,provenance:'SOURCE'})),xLabel,yLabel,unit,yUnit:unit,xTicks:groups.map((_,i)=>i+1),tickLabels:Object.fromEntries(groups.map((g,i)=>[String(i+1),g.name]))});
function result(dataset,rows,{headline,fact,summary,metrics,values,calculation,chart}){
 return{kind:'whole-trend',audience:'earth-context',status:'computed',takeawayLabel:'全体の推移・グループ比較',headline,fact,summary,metrics,recordIds:ids(rows),calculation,factEvidence:{kind:'whole-trend',recordIds:ids(rows),values,calculation},logic:{evidence:calculation,inference:fact,implication:summary,limits:dataset.comparisonNote||'対象データ内の記述的比較。因果・将来・被害は推定しない。'},futurePerspective:{focus:'human-earth-co-creation-and-future',basis:calculation,evidenceRecordIds:ids(rows),limits:'比較の対象・期間を越えた一般化や因果の断定はしない。'},takeawayCaveat:dataset.comparisonNote||'',chart};
}
function hourly(dataset,rows){
 const ctx=dataset.trendContext;if(ctx?.kind!=='fixed-site-hourly'||rows.length<12)return null;
 const ordered=[...rows].sort((a,b)=>a.x-b.x),n=ordered.length,w=Math.min(6,Math.floor(n/4)),first=ordered.slice(0,w),last=ordered.slice(-w),early=mean(first.map(r=>r.value)),late=mean(last.map(r=>r.value));
 const day=ordered.filter(r=>{const h=(new Date(r.observedAt).getUTCHours()+9)%24;return h>=9&&h<=15;}),night=ordered.filter(r=>{const h=(new Date(r.observedAt).getUTCHours()+9)%24;return h>=21||h<=3;});
 if(day.length<3||night.length<3)return null;
 const d=mean(day.map(r=>r.value)),nt=mean(night.map(r=>r.value)),index=new Map(dataset.rows.map((r,i)=>[r.id,i]));
 const earlyIndex=first.map(r=>index.get(r.id)),lateIndex=last.map(r=>index.get(r.id)),dayIndex=day.map(r=>index.get(r.id)),nightIndex=night.map(r=>index.get(r.id));
 const changes=ctx.panel.map(p=>({id:p.id,early:mean(earlyIndex.map(i=>p.values[i])),late:mean(lateIndex.map(i=>p.values[i])),day:mean(dayIndex.map(i=>p.values[i])),night:mean(nightIndex.map(i=>p.values[i]))}));
 const regions=ctx.regions.map(g=>{const v=ordered.map(r=>r.regional.find(x=>x.id===g.id)?.value);if(v.some(x=>!finite(x)))return null;return{id:g.id,name:g.name,mean:mean(v),amplitude:Math.max(...v)-Math.min(...v),early:mean(first.map(r=>r.regional.find(x=>x.id===g.id).value)),late:mean(last.map(r=>r.regional.find(x=>x.id===g.id).value)),day:mean(day.map(r=>r.regional.find(x=>x.id===g.id).value)),night:mean(night.map(r=>r.regional.find(x=>x.id===g.id).value))};}).filter(Boolean);
 if(regions.length<3)return null;
 const peak=ordered.reduce((a,b)=>a.value>=b.value?a:b),trough=ordered.reduce((a,b)=>a.value<=b.value?a:b),dayHigher=changes.filter(p=>p.day>p.night).length,lateHigher=changes.filter(p=>p.late>p.early).length,lateLower=changes.filter(p=>p.late<p.early).length;
 const values={siteCount:ctx.siteIds.length,periodStart:ordered[0].observedAt,periodEnd:ordered.at(-1).observedAt,window:w,early,late,day:d,night:nt,dayHigher,lateHigher,lateLower,regions,peak:{time:peak.observedAt,value:peak.value},trough:{time:trough.observedAt,value:trough.value}};
 const metrics=[['序盤の平均',early,dataset.unit],['終盤の平均',late,dataset.unit],['日中の平均',d,dataset.unit],['夜間の平均',nt,dataset.unit],['比較地点',ctx.siteIds.length,'地点']];
 const calculation='同じ代表地点を全時間で固定し、各時刻の等重み平均を計算。序盤・終盤は各'+w+'時間。日中は日本時間九〜十五時、夜間は二十一〜三時を比較。地域別も地点を固定。欠測は除外対象の地点ごと外し、ゼロで補わない。モデル値の一日内の比較で長期の気候トレンドではない。';
 if(ordered.every(r=>r.value===ordered[0].value)&&ctx.panel.every(p=>p.values.every(v=>v===p.values[0]))){const flat=result(dataset,ordered,{headline:'対象期間の全体平均は同じ水準で推移している',fact:'同じ代表地点を時間ごとに比べても、全体平均と各地点の値に変化は見られません。',summary:'この期間からは時間変化に基づく暮らしとの関係を読み取れません。別の期間も同じ対象で比較できます。',metrics,values,calculation,chart:frameChart(ordered,dataset)});flat.status='no-difference';return flat;}

 let headline,fact,summary;
 if(ctx.metric==='weatherWindSpeed'){
  const sorted=[...regions].sort((a,b)=>Math.abs(b.day-b.night)-Math.abs(a.day-a.night)),a=sorted[0],b=sorted.at(-1);
  headline=d>nt?'全体の風は昼に強まるが、地域ごとの変化はそろわない':'全体の風は夜に強まり、地域別の変化にも差がある';
  fact='同じ地点を一日追うと、全体の平均風速は'+(d>nt?'日中に高く、夜間に低く':'夜間に高く、日中に低く')+'なっています。昼夜差は'+a.name+'で大きく、'+b.name+'では小さくなっています。';
  summary='風を生かす街づくりでは、一日の中で風が強まる時間と、地域ごとの違いが関わります。建物や街路を通る風の実測とつなぐと、その土地の風に合わせて冷房への依存を減らす選択肢を考えられます。';
 }else if(ctx.metric==='forecastCo2'){
  const common=ctx.panel.length-dayHigher;
  headline=d<nt?'炭素濃度の昼の低下と夜の上昇が、広い地域に共通する':'炭素濃度は日中に高まり、夜間に低くなる';
  fact='代表地点の平均濃度は、'+(d<nt?'日中に下がり、夜間に戻る':'日中に高まり、夜間に下がる')+'動きを示しています。'+((d<nt?common:dayHigher)/ctx.panel.length>=2/3?'同じ向きの昼夜差が大半の地点で共通し、濃度の上下が広い地域でそろっています。':'地点ごとの昼夜差には逆向きの動きもあり、全体平均の変化と地域の変化は分かれています。');
  summary='濃度が日々変わる共通のリズムに、地域の排出対策を重ねて見ていく意味があります。同じ時間帯で地域を越えて比べることが、一時的な上下動に紛れる変化を追い、共有する大気を守る協力につながります。';
 }else if(ctx.metric==='weatherPrecipitation'){
  const down=late<early;headline=down?'広い地域で雨が弱まり、全体の雨量も下がっている':'広い地域で雨が強まり、全体の雨量も上がっている';
  fact='序盤と終盤の数時間を比べると、代表地点全体の平均降水量は'+(down?'低下':'増加')+'しています。'+((down?lateLower:lateHigher)/ctx.panel.length>=2/3?'その変化は大半の地点で共通し、全体平均と多くの地点の増減が同じ方向に動いています。':'一方、変化の向きは地点ごとに分かれ、雨の強まる場所と弱まる場所が入れ替わっています。');
  summary=down?'雨が弱まる時間を広い範囲で共有していても、街で使う水はそれ以前に降った雨にも支えられます。降る時刻と使う時刻をつなぐ貯水や流域の保全が、雨の波に合わせて暮らす社会の一部になります。':'雨が強まる時刻を広域で追うと、水が流れ込む土地どうしのつながりを考えられます。降った水を蓄え、安全に流す仕組みを流域で組み合わせることが、雨の波と共に暮らす社会を支えます。';
 }else if(ctx.metric==='weatherTemperature'){
  const sorted=[...regions].sort((a,b)=>b.amplitude-a.amplitude),a=sorted[0],b=sorted.at(-1);
  headline=d>nt?'日中の気温上昇は広く共通し、地域ごとの振れ幅はそろわない':'夜間に高い気温の流れにも、地域ごとの振れ幅がある';
  fact='全体の平均気温は'+(d>nt?'日中に上がり、夜間に下がる':'夜間に高まり、日中に低くなる')+'流れです。地域ごとの平均推移では、'+a.name+'の一日の振れ幅が大きく、'+b.name+'では小さく'+(b.amplitude>0&&a.amplitude/b.amplitude>=3?'、その差は三倍を超えています。':'なっています。');
  summary='同じ平均気温でも、昼夜の振れ幅が違えば、暮らしを快適に保つ方法も変わります。日よけ、通風、断熱を、その土地の一日の変化に合わせて組み合わせることが、エネルギーを使いすぎずに暮らす街を考える手がかりになります。';
 }else if(ctx.metric==='cloudCover'){
  const down=late<early,sorted=[...regions].sort((a,b)=>down?(a.late-a.early)-(b.late-b.early):(b.late-b.early)-(a.late-a.early)),a=sorted[0],b=sorted.at(-1);
  headline=down?'全体の雲量は下がり、地域ごとの減少幅が分かれている':'雲量は広く増えながら、地域ごとの変化に差が出ている';
  fact='同じ代表地点で追うと、全体の平均雲量は序盤から終盤へ'+(down?'下がって':'上がって')+'います。地域平均の変化は'+a.name+'で'+(down?'低下':'増加')+'が大きく、'+b.name+'では小さく、広域の変化の中に地域ごとの変化量の差があります。';
  summary='雲量の時間変化の地域差は、日射や電力需要の時間推移と合わせて考えられます。電気を蓄えたり地域で融通したりする仕組みは、一律の空模様を前提にせず、自然の時間差を暮らしの中で受け止める方法になります。';
 }else if(ctx.metric==='pm25'){
  const sorted=[...regions].sort((a,b)=>Math.abs(b.night-b.day)-Math.abs(a.night-a.day)),a=sorted[0],b=sorted.at(-1),highNight=nt>d;
  headline=highNight?'微粒子濃度は昼に下がり、夜の上昇が広い地域で重なる':'微粒子濃度は昼に高まり、広い地域で時間変化が重なる';
  fact='同じ地点を通して見ると、全体平均は'+(highNight?'日中に低く、夜間に高く':'日中に高く、夜間に低く')+'なっています。昼夜差は'+a.name+'で大きく、'+b.name+'では小さく、一日の濃度変化の強さが地域で分かれています。';
  summary='空気を守る取り組みは、場所に加えて時間帯にも関わります。広域で重なる濃度の上昇を、発生源や風の流れの情報とつなげると、地域どうしが協力して排出を減らす時刻や方法を考えられます。';
 }else return null;
 return result(dataset,ordered,{headline,fact,summary,metrics,values,calculation,chart:frameChart(ordered,dataset)});
}
export function wholeTrendInsight(dataset,rows){
 const valid=rows.filter(r=>finite(r.value)&&r.provenance!=='IMPUTED'&&r.valueStatus!=='IMPUTED');
 const live=hourly(dataset,valid);if(live)return live;
 if(dataset.id==='ocean-currents'){
  const region=valid.filter(r=>finite(r.lat)&&finite(r.lon)&&r.lon>=120&&r.lon<=165&&r.lat>=20&&r.lat<50);
  const bins=[[20,30,'南側'],[30,35,'南東沖'],[35,40,'東方沖'],[40,50,'北側']].map(([a,b,name],i)=>{const rs=region.filter(r=>r.lat>=a&&r.lat<b);return{id:String(i),name,rows:rs,mean:rs.length?mean(rs.map(r=>r.value)):NaN,east:rs.length?mean(rs.map(r=>r.uMs)):NaN,north:rs.length?mean(rs.map(r=>r.vMs)):NaN};});
  if(bins.some(b=>b.rows.length<4))return null;const max=bins.reduce((a,b)=>a.mean>b.mean?a:b),north=bins.at(-1),south=bins[0];
  return result(dataset,region,{headline:'日本周辺の平均流速は、'+max.name+'の帯で強くなる',fact:'日本周辺の海域全体を帯に分けると、平均流速は'+max.name+'で最も大きくなっています。'+(north.mean<max.mean?'そこから北側では平均流速が低下し、東西・南北の流れの成分も弱まっています。':'南側から北側へ平均流速が強まる分布です。'),summary:'海域ごとの流れの強さが変わる場所では、海へ出たものの広がり方も同じには扱えません。沿岸の利用や排出を、隣り合う海域の流れとつないで考えることが、共有する海を守る協力の出発点になります。',metrics:bins.map(b=>[b.name+'の平均流速',b.mean,'m/s']),values:{bounds:[120,165,20,50],bins:bins.map(b=>({name:b.name,count:b.rows.length,mean:b.mean,east:b.east,north:b.north}))},calculation:'同じ日の日本周辺の格子を固定した四つの緯度帯へ分け、流速と東西・南北成分を等重みで平均。全球平均や時間変化を装わない。対象格子数の差と陸域欠測を保持。',chart:groupChart(bins,'m/s','日本周辺の緯度帯','平均流速')});
 }
 if(dataset.id==='rainfall'){
  const paired=valid.filter(r=>finite(r.forestPercent)&&r.forestPercent>=0&&r.forestPercent<=100);
  const bins=[[0,25,'森林率低'],[25,50,'森林率中'],[50,101,'森林率高']].map(([a,b,name],i)=>{const rs=paired.filter(r=>r.forestPercent>=a&&r.forestPercent<b);return{id:String(i),name,rows:rs,mean:rs.length?mean(rs.map(r=>r.value)):NaN};});
  if(bins.some(b=>b.rows.length<10))return null;const rising=bins[0].mean<bins[1].mean&&bins[1].mean<bins[2].mean,falling=bins[0].mean>bins[1].mean&&bins[1].mean>bins[2].mean;
  return result(dataset,paired,{headline:rising?'森林率の高いグループほど、参照地点の雨も多い':falling?'森林率の高いグループほど、参照地点の雨は少ない':'森林率と参照地点の雨は、単調には対応していない',fact:rising?'国を森林率でグループ分けすると、森林率の低い側から高い側へ、参照地点の平均降水量が段階的に増えています。一部の多雨地点だけでなく、グループ全体の平均にも同じ関係が表れています。':falling?'国を森林率でグループ分けすると、森林率の低い側から高い側へ、参照地点の平均降水量は減っています。グループ全体の平均で、森の多さと雨の少なさが重なっています。':'森林率で国をグループ分けすると、参照地点の平均降水量はグループの順には変わっていません。中間のグループも含め、単調な関係にはなっていません。',summary:'森と水が重なる土地から、木材や食料などを受け取って暮らしています。土地の利用を変えるとき、森だけ、水だけを切り離さずに考えることが、生産地と離れた場所の暮らしを共に支える視点になります。',metrics:bins.map(b=>[b.name+'の平均降水量',b.mean,'mm/day']),values:{bins:bins.map(b=>({name:b.name,count:b.rows.length,mean:b.mean})),rising,falling},calculation:'森林率が四分の一未満、四分の一以上半分未満、半分以上の国を固定区分。各グループでNASA POWER参照地点の平均降水量を単純平均。降水は2001–2020年の平年値、森林率は国別の最新公表年。国全土の平均降水量や森林の降雨効果ではない。',chart:groupChart(bins,'mm/day','森林率のグループ','参照地点の平均降水量')});
 }
 if(dataset.id==='waste'&&dataset.trendContext?.kind==='fixed-country-annual'){
  const ordered=[...valid].sort((a,b)=>a.x-b.x);if(ordered.length<6)return null;const k=3,early=mean(ordered.slice(0,k).map(r=>r.value)),late=mean(ordered.slice(-k).map(r=>r.value)),earlyYears=ordered.slice(0,k).map(r=>r.year),lateYears=ordered.slice(-k).map(r=>r.year),ctx=dataset.trendContext;
  const changes=ctx.countries.map(c=>({id:c.id,change:mean(lateYears.map(y=>c.values[ctx.years.indexOf(y)]))-mean(earlyYears.map(y=>c.values[ctx.years.indexOf(y)]))}));const up=changes.filter(c=>c.change>1e-8).length,down=changes.filter(c=>c.change< -1e-8).length;
  return result(dataset,ordered,{headline:late>early?'同じ国を追うと、再資源化率は全体として上がっている':'同じ国を追うと、再資源化率は全体として下がっている',fact:'前の期間と後の期間を同じ国々で比較すると、各国を同じ重みで見た平均再資源化率は'+(late>early?'上昇':'低下')+'しています。'+((late>early?up:down)/changes.length>=2/3?'多数の国で同じ向きの変化があり、平均の動きが国々に広がる変化として表れています。':'国ごとの動きはそろわず、平均の変化の中に改善した国と低下した国が混在しています。'),summary:late>early?'同じ国々でも再資源化率が上がり、資源を循環させる暮らしを広げていく余地が見えてきます。伸びた地域の制度や製品設計をたどり、ほかの土地でも生かせる条件を探すことが、資源を繰り返し使う暮らしにつながります。':'同じ国々で再資源化率が下がっており、資源を循環させる仕組みを保つことが課題になります。回収から再利用までをつなぐ制度や製品設計を確かめることが、資源を繰り返し使う暮らしを支えます。',metrics:[['前の期間の平均',early,'%'],['後の期間の平均',late,'%'],['変化',late-early,'ポイント'],['上昇した国',up,'国'],['低下した国',down,'国']],values:{earlyYears,lateYears,early,late,up,down,countries:changes},calculation:dataset.comparisonNote+' 前後各三年の平均を比較。国別にも同じ年の平均差を計算。国別比率の平均で、ごみ量に重みを置いた世界平均ではない。',chart:frameChart(ordered,dataset)});
 }
 if(dataset.id==='earthquakes'){
  const annual=[...valid].filter(r=>Number.isInteger(r.x)).sort((a,b)=>a.x-b.x);if(annual.length<15||annual.some((r,i)=>i&&r.x!==annual[i-1].x+1))return null;
  const groups=[];for(let i=0;i+5<=annual.length;i+=5){const rs=annual.slice(i,i+5);groups.push({id:String(rs[0].x),name:rs[0].x+'–'+rs.at(-1).x,rows:rs,mean:mean(rs.map(r=>r.value))});}if(groups.length<3)return null;
  const first=groups[0].mean,last=groups.at(-1).mean,spread=descriptive(annual.map(r=>r.value)).sampleSd,down=last<first,peak=groups.reduce((a,b)=>a.mean>=b.mean?a:b);
  const fact='五年ずつにまとめた平均件数は、'+(peak!==groups[0]&&peak!==groups.at(-1)?'中盤で増えた後、後半では低い水準になっています。':down?'前の期間より最近の期間で低くなっています。':'前の期間より最近の期間で高くなっています。')+(spread>Math.abs(last-first)?'ただし年ごとの振れは期間平均との差より大きく、平均の変化よりも短期の増減が目立ちます。':'期間平均との差が年ごとの振れを上回り、発生水準の変化が目立ちます。');
  return result(dataset,annual,{headline:spread>Math.abs(last-first)?(down?'平均件数は後半に下がり、年々の変動はその差を上回る':'平均件数は後半に上がり、年々の変動はその差を上回る'):'期間平均の変化が、年々の変動を上回っている',fact,summary:'平均件数が低くなる期間にも、活動の大きな年が入り交じります。街の備えを平均の回数だけで決めず、活動の波を受け止められる建物や助け合う仕組みを長く保つことが、大地と暮らし続ける社会を支えます。',metrics:groups.map(g=>[g.name+'年の年平均',g.mean,'件/年']).concat([['年ごとの標準偏差',spread,'件/年']]),values:{groups:groups.map(g=>({period:g.name,mean:g.mean,count:g.rows.length})),spread,change:last-first},calculation:'選択期間の連続した年を先頭から五年ごとの同じ長さに区切り、年平均件数を比較。端の五年に満たない区間は期間比較から外す。年ごとの標準偏差と最初・最後の期間平均差を対比。発生予測や長期的危険度の推定はしない。',chart:groupChart(groups,'件/年','五年ごとの期間','大地震の年平均件数')});
 }
 return null;
}
