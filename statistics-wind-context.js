// Interpret the sampled wind field itself. No unmeasured pressure gradient,
// parcel trajectory, heat transport or cause is inferred from these records.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const mean=rs=>rs.reduce((s,r)=>s+r.value,0)/rs.length;
const ids=rs=>rs.map(r=>String(r.id));
const zonal=r=>-r.value*Math.sin(r.windDirection*Math.PI/180); // meteorological FROM -> TO eastward component
const usable=r=>finite(r.lat)&&Math.abs(r.lat)<=90&&finite(r.lon)&&Math.abs(r.lon)<=180&&finite(r.value)&&r.value>=0&&finite(r.windDirection)&&r.windDirection>=0&&r.windDirection<=360;
export function windLatitudeFinding(rows){
 const rs=rows.filter(usable),tropical=rs.filter(r=>Math.abs(r.lat)<30),south=rs.filter(r=>r.lat>=-60&&r.lat< -30);
 const longitudeCoverage=group=>new Set(group.map(r=>Math.min(11,Math.floor((r.lon+180)/30)))).size;
 if(rs.length<80||south.length<12||tropical.filter(r=>r.lat<0).length<12||tropical.filter(r=>r.lat>=0).length<12||longitudeCoverage(south)<6||longitudeCoverage(tropical)<6)return null;
 const west=tropical.filter(r=>zonal(r)<-.5),east=south.filter(r=>zonal(r)>.5);
 const westShare=west.length/tropical.length,eastShare=east.length/south.length;
 if(westShare<2/3||eastShare<2/3)return null;
 const tropicalMean=mean(tropical),southMean=mean(south),stronger=tropicalMean>0&&southMean/tropicalMean>=1.2;
 const basis={kind:'latitude-wind-pattern',tropical:{count:tropical.length,westCount:west.length,westShare,meanSpeed:tropicalMean,recordIds:ids(tropical)},southMidlatitude:{count:south.length,eastCount:east.length,eastShare,meanSpeed:southMean,recordIds:ids(south)},stronger,
  rule:'赤道付近＝南緯30度以上〜北緯30度未満、南半球中緯度＝南緯60度以上〜南緯30度未満。各帯が十分な地点・経度幅を含み、東西成分の絶対値0.5m/s超の同方向の風が各帯の3分の2以上で成立。平均風速比1.2以上の場合だけ強弱にも言及。記述上の選択条件で、統計的有意差・気候帯の確定ではない。'};
 return {audience:'earth-context',takeawayLabel:'地球規模の風の流れ',status:'computed',
  headline:'風は、離れた地域をまたいで帯状にそろう',
  fact:'赤道付近では西向き、南半球の中緯度では東向きの風が、それぞれ多数を占めています。離れた地点を並べても、緯度帯ごとに流れがまとまっています。'+(stronger?'平均風速も、中緯度側のほうが高くなっています。':''),
  summary:'空気を運ぶ流れは、行政の境界を越えて広がっています。風上で出した物質が風下へ届くことを考えると、自分の街の排出も、離れた地域の暮らしとつながります。空気を共有する地域どうしの協力が、大気を守る取り組みになります。',
  logic:{evidence:'離れた地点でも緯度帯ごとに風向がそろい、帯によって反対向きとなる。',background:'風は熱・水蒸気・微粒子を輸送する。',inference:'地域の大気は、地域をまたぐ流れの中にある。',implication:'風上の排出対策を通じて、地域間の協力が風下の暮らしも守る。',limits:'表示地点間の実際の輸送経路や、特定地点への影響量は計算していない。',sources:['https://www.jma.go.jp/jma/kishou/know/whitep/1-1-1.html','https://atmosphere.copernicus.eu/guide-cams-visual-products-our-atmosphere-your-fingertips']},
  futurePerspective:{focus:'human-earth-co-creation-and-future',basis:'緯度帯ごとに広い範囲でそろう風向',evidenceRecordIds:ids([...tropical,...south]),limits:'特定地域間の汚染輸送量や排出削減効果は未計算。'},
  metrics:[['赤道付近の西向きの地点割合',westShare*100,'%'],['南半球中緯度の東向きの地点割合',eastShare*100,'%'],['赤道付近の平均風速',tropicalMean,'m/s'],['南半球中緯度の平均風速',southMean,'m/s']],
  recordIds:ids([...tropical,...south]),interpretationBasis:basis,
  calculation:basis.rule+' 風向は吹いてくる方位なので、東西成分u=−風速×sin(風向)。各地点を等重みで集計。',
  takeawayCaveat:'表示時点の地上の風速・風向モデル値を、対象地点の緯度帯で比較しています。別の時点も比べると、この流れの続き方を確かめられます。'};
}
export function windEarthInsight(dataset,candidate,rows,measured){
 if(candidate.id==='wind-latitude-pattern')return windLatitudeFinding(rows)||measured;
 const earth={...measured,audience:'earth-context',takeawayLabel:'対象地点の風の違い',takeawayCaveat:'表示時点の対象地点を比べています。気圧の空間勾配や、空気の移動経路は計算に含めていません。'};
 if(rows.length<2||measured.status==='insufficient')return {...earth,headline:'風を比べる記録が足りない',fact:rows.length?'現在は、ひとつの地点の記録を見ています。':'この選択には、読み取りに使える記録がありません。',summary:'風の地域差を説明できるだけの記録がそろっていません。'};
 if(candidate.id==='near-peers'&&candidate.comparison){
  const {points,metrics}=candidate.comparison,m=metrics.find(m=>m.highlight);
  const names=points.map(p=>p.name),high=m.values[0]>m.values[1]?0:1;
  return {...earth,interpretationBasis:{kind:'matched-pressure-different-wind',recordIds:measured.recordIds},headline:'気圧の近い地点にも、強さの異なる風が吹く',fact:names.join('と')+'では、気圧が近い一方、風速に差があります。',summary:'この組では、気圧の値が近くても、'+names[high]+'のほうが強い風を記録しています。気圧の値だけからは見えない風の地域差が、風速を重ねることで現れています。'};
 }
 const ordered=[...rows].sort((a,b)=>a.value-b.value),lo=ordered[0],hi=ordered.at(-1),same=hi.value===lo.value;
 return {...earth,headline:same?'対象地点の風速は同じ水準にある':'強い風と穏やかな風が、同じ地球に現れる',fact:same?'風速は同じ値として記録されています。':'選んだ地点には、強い風と穏やかな風が同時に記録されています。',summary:same?'今回の風速だけでは、地域ごとの強弱を分けられません。風向や別の時点の記録を合わせると、流れの違いを確かめられます。':'同じ時点にも、地上の空気の動き方には地域差があります。平均風速だけでは重なる強い風と穏やかな風が、地点ごとの比較では分かれて見えてきます。'};
}
