import {mapCoCreationInsight} from './statistics-map-co-creation.js?v=insights75-scope-20261026';
import {windEarthInsight} from './statistics-wind-context.js?v=insights75-scope-20261026';
import {stationEarthInsight} from './statistics-station-context.js?v=insights75-scope-20261026';
import {environmentEarthInsight} from './statistics-environment-context.js?v=insights75-scope-20261026';
import {finalEarthInsight} from './statistics-final-context.js?v=insights75-scope-20261026';
// Visitor-facing readings for map 01–05. Numerical evidence, source IDs and
// calculations remain on the measured result; this layer explains their meaning.
const TOPIC = Object.freeze({
  'planet-global-wind-pressure':'wind',
  'planet-usgs-earthquake-ripples':'quake',
  'planet-global-aerosol-light':'air',
  'nasa-firms-active-fire-24h':'fire',
  'planet-global-cloud-radiance':'cloud',
});
const READING = Object.freeze({
  wind:{label:'空気の動きと暮らし',
    scope:'代表地点の風を、表示中の時点や対象期間の条件に沿って比べています。'},
  quake:{label:'大地の動きと暮らし',
    scope:'観測された地震の規模と、記録のある震源の深さを比べています。'},
  air:{label:'空と、身近な空気',
    scope:'同じ時点のモデル値を使い、代表地点の霞と地表付近の微粒子を比べています。'},
  fire:{label:'地表の熱と土地の使い方',
    scope:'衛星が通過したときに捉えた、火災・熱異常の記録を比べています。'},
  cloud:{label:'光と暮らしのつながり',
    scope:'雲に覆われる割合と地表に届く光を、同じ時点のモデル値で見ています。'},

});
const numeric = value => typeof value==='number' && Number.isFinite(value);

function observedReading(topic,dataset,candidate,rows,measured) {
  const first=rows[0].value;
  const same=rows.every(r=>Math.abs(r.value-first)<=Math.max(1,Math.abs(first),Math.abs(r.value))*1e-9);
  if(topic==='quake'){
    if(candidate.id==='same-magnitude-depth')return ['地震の規模が近くても、震源の深さは大きく違う','規模が近い地震の中にも、震源の深さが大きく違う組があります。'];
    return same?['記録された地震の規模は、同じ水準にある','選んだ地震は、同じ規模として記録されています。']
      :['地球の動きは、さまざまな規模で現れる','記録された地震には、規模に幅があることが読み取れます。'];
  }
  if(topic==='air'){
    if(candidate.id==='haze-ground-mismatch')return ['空の霞と、地表の微粒子は重なり方が違う','空全体で霞が目立つ地点と、地表付近の微粒子が多い地点がずれていることが読み取れます。'];
    if(candidate.id==='near-peers')return ['霞の見え方が似ていても、地表の空気は違う','空を通る光の弱まり方が近い地点にも、地表付近の微粒子の量に差があることが読み取れます。'];
    if(measured.details?.upperTailCount>0)return ['平均値だけでは、微粒子が多い場所を見落とす','大半の地点に比べ、微粒子の濃度が特に高い地点が少数あります。'];
    return same?['微粒子は、近い濃さで記録されている','地表付近の微粒子の濃度は、比べた地点で同じ水準にあります。']
      :['地表の微粒子は、場所によって濃さが違う','同じ時点の記録でも、地表付近の微粒子が多い地点と少ない地点があることが読み取れます。'];
  }
  if(topic==='fire')return same?['熱は、同じくらいの強さで捉えられている','衛星が捉えた熱の強さは、選んだ地点で同じ水準として記録されています。']
    :['地表の熱は、場所ごとに違う強さで現れる','同じ火災・熱異常の記録の中にも、捉えた熱の強さに違いがあることが読み取れます。'];
  if(topic==='cloud'){
    if(candidate.id==='near-peers')return ['雲の多さが似ていても、地上に届く光は違う','雲に覆われる割合が近い地点でも、地表に届く光の強さに差があることが読み取れます。'];
    return same?['光は、同じ水準で記録されている','地表に届く光は、選んだ地点で同じ水準として記録されています。']
      :['地表に届く光は、場所ごとに違う','同じ時点でも、地表に届く光の強さに地点ごとの違いがあることが読み取れます。'];
  }

}

function interpretFinding(topic,candidate,rows,measured) {
  if(topic==='quake'){
    return candidate.id==='same-magnitude-depth' ? {
    headline:'地震の規模だけでは、暮らしへの影響を読めない',
    fact:measured.metrics?.[0]?.[2]==='km'&&measured.metrics?.[1]?.[2]==='km'&&Math.min(measured.metrics[0][1],measured.metrics[1][1])<40&&Math.max(measured.metrics[0][1],measured.metrics[1][1])>=200?'規模が近い地震に、地表近くで起きたものと、地下数百キロで起きたものがあります。規模がそろっても、地表から震源までの距離は大きく隔たっています。':'規模が近い地震どうしを比べても、震源の深さには大きな差があります。規模がそろっても、地表から震源までの距離はそろっていません。',
    summary:'同じ大きさの地震に備えるという考え方だけでは、土地ごとの揺れる条件が抜け落ちます。震源の位置や地盤と、建物や街のつくり方を結びつけることが、大地の活動とともに暮らし続けるための備えになります。',
    logic:{evidence:'規模の近い地震に、震源の深さが大きく異なる組がある。',background:'地表の揺れは震源からの距離・地盤にも左右される。',inference:'地震の規模だけでは揺れる条件を一律に扱えない。',implication:'土地ごとの揺れる条件に合わせた街づくりを、人と大地の共生という視点で考える。',limits:'実際の震度・建物被害を計算した結果ではない。',sources:['https://www.jma.go.jp/jma/kishou/know/faq/faq27.html']},
    interpretationBasis:{kind:'matched-magnitude-different-depth',recordIds:measured.recordIds},
  } : {
    headline:'目立つ地震と、日々の大地の活動を一緒に読む',
    summary:'大きな地震を追う見方と、小さな地震も含めて活動を見る見方では、大地の捉え方が変わります。今回の規模の幅は、目立つ出来事と日々の活動を、同じ地図で読む意味を示しています。',
  };
  }
  if(topic==='air'){
    if(candidate.id==='haze-ground-mismatch')return {
      headline:'目立つ空と、暮らしに近い空気はずれる',
      summary:'空全体の霞と、地表付近の微粒子は、濃くなる場所がずれています。同じ大気を見ていても、高さによって微粒子の分布が異なっています。',
      interpretationBasis:{kind:'column-surface-ranking-mismatch',recordIds:measured.recordIds},
    };
    if(candidate.id==='near-peers')return {headline:'似た空の下にも、生活の高さでは違いがある',summary:'似た霞の空にも、地表付近では異なる濃さの空気があります。遠くから一様に見える環境の中に、生活の高さでは違いがあると分かります。'};
    return measured.details?.upperTailCount>0?{
      headline:'微粒子は、一部の地点で突出して濃い',
      fact:'大半の地点がつくる濃度の分布から、大きく離れた高濃度の地点が少数あります。微粒子の濃さは全体で一様に高いのではなく、一部の地点に偏っています。',
      summary:'空気の問題を平均値だけで評価すると、負担が集中する場所が見えにくくなります。濃度が高い地域に暮らす人の環境を変えることまで含めて、地球全体の改善を考えられます。',
    }:{headline:'暮らす場所によって、接する空気の濃さが違う',summary:'地表付近の微粒子の濃度は、場所によって異なります。人が接する空気の状態にも、地域ごとの違いが現れています。'};
  }
  if(topic==='fire'){
    const ordered=[...rows].sort((a,b)=>b.value-a.value||String(a.id).localeCompare(String(b.id)));
    const total=ordered.reduce((s,r)=>s+r.value,0),count=Math.ceil(ordered.length*.1);
    const eligible=rows.length>=10&&total>0&&rows.every(r=>r.value>=0);
    const share=eligible?ordered.slice(0,count).reduce((s,r)=>s+r.value,0)/total:null;
    const interpretationBasis={kind:'record-intensity-concentration',fraction:.1,count:eligible?count:null,share,recordIds:eligible?ordered.slice(0,count).map(r=>String(r.id)):[],calculation:'FRPを降順に並べ、強い側の1割（端数切上げ）の記録値が、選択中の記録値合計に占める割合を計算。異なる観測時刻の記録分布であり、同時出力・放出エネルギー・被害の割合へ換算しない。'};
    if(!eligible)return {headline:'選んだ検知の強さを、周囲の記録と一緒に読む',summary:'少ない検知を選んだ範囲では、一つの点が全体の印象を左右します。この範囲だけでは、熱放射がどこに偏っているかを説明できません。',interpretationBasis};
    return eligible&&share>=.5 ? {
      headline:'熱放射の過半が、強い側の約一割に集まる',
      fact:'強い側の約一割の検知点が、記録された熱放射の過半を占めています。検知の大部分より、少数の強い点が合計を大きく左右しています。',
      summary:'点の数で火を見ると、強い熱を出す少数の検知点を軽く見てしまいます。その強さに、人の暮らしや生きもののすみかを重ねて考えると、何をどこで守るかという判断につながります。',interpretationBasis,
    } : {headline:'ひとつの強い検知から、火の全体像は決まらない',summary:'今回の記録では、熱放射が少数の検知点だけに極端に偏る傾向は弱いものです。熱の活動は、多くの場所に分かれて現れています。',interpretationBasis};
  }
  if(topic==='cloud'){
    const r=measured.details?.correlation,r2=measured.details?.rSquared;
    if(candidate.id==='near-peers'&&numeric(r)&&numeric(r2)&&r2<.1)return {
      headline:'曇り空の感覚を、地球全体へ広げすぎない',
      summary:'雲量が近い地点でも、地表に届く光には大きな差があります。今回の地点間の比較では、雲の多さだけでは光の分布を説明しきれていません。',
      interpretationBasis:{kind:'cross-location-association',correlation:r,rSquared:r2,calculation:'既存の全有効ペアの相関・単回帰を参照。地点間の関係を、同じ地点の時間変化や雲の因果効果へ読み替えない。'},
    };
    if(numeric(r)&&r<0&&numeric(r2)&&r2>=.1)return {headline:'雲の違いが、受け取るエネルギーの違いにも現れる',summary:'対象地点全体でも、雲の多い場所ほど地表に届く光が弱い傾向があります。雲の違いは、空の景色に加えて、その土地が受け取るエネルギーの違いとしても現れています。'};
    return {headline:'同じ「曇り」の中にも、違う光の環境がある',summary:'地表に届く光は、同じ時点でも場所によって異なります。地球上の土地が受け取る太陽エネルギーには、地域ごとの違いがあります。'};
  }
}

export function mapEarthInsight(dataset,candidate,rows,measured) {
  if(measured.kind==='whole-trend')return measured;
  if(dataset.modeId==='food-balances'&&measured.audience==='earth-context')return {...measured,futurePerspective:{focus:'human-earth-co-creation-and-future',basis:'同じ出典・同じ品目の需給構造と既存の期間比較',evidenceRecordIds:measured.recordIds}};
  const station=stationEarthInsight(dataset,measured);if(station)return station;
  const environment=environmentEarthInsight(dataset,measured);if(environment)return environment;
  const final=finalEarthInsight(dataset,rows,measured);if(final)return final;
  const topic=TOPIC[dataset.id];if(!topic)return mapCoCreationInsight(dataset,candidate,rows,measured);
  if(topic==='wind')return windEarthInsight(dataset,candidate,rows,measured);
  if(topic==='cloud'&&candidate.id==='cloud-day-night'&&candidate.earthResult)return candidate.earthResult;
  const reading=READING[topic];
  let headline,fact,summary='';
  if(measured.status==='insufficient'||rows.length<2){
    headline='比べる記録を選ぼう';
    fact=rows.length?'現在は、ひとつの地点・時点の記録を見ています。':'この選択には、読み取りに使える記録がありません。';
    summary='今ある記録だけでは、地域差や時間の変化を説明できません。';
  }else [headline,fact]=observedReading(topic,dataset,candidate,rows,measured);
  const same=rows.length>=2&&rows.every(r=>r.value===rows[0].value);
  const hasComparison=measured.status!=='insufficient'&&rows.length>=2;
  const interpreted=hasComparison&&(!same||candidate.id==='same-magnitude-depth')?interpretFinding(topic,candidate,rows,measured):null;
  if(hasComparison&&same&&!interpreted)summary='選んだ範囲の値は同じ水準で、強弱の差は現れていません。';
  if(interpreted&&!interpreted.logic)interpreted.logic={
    evidence:topic==='air'?(candidate.id==='haze-ground-mismatch'?'AODと地表PM2.5の上位地点がずれる。':measured.details?.upperTailCount>0?'Q3+1.5×IQRを超える高濃度地点が少数にある。':'地点間でPM2.5が異なる。'):topic==='fire'?'記録FRP合計に占める強い側の一割の構成比を計算。':'対象地点の変数を比較。',
    inference:topic==='air'?'全体の代表値や大気全体の量だけでは地表の局地差が隠れる。':topic==='fire'?'検知件数を同じ重みで数える見方と熱放射強度の偏りは異なる。':'対象地点の条件に違いがある。',
    implication:interpreted.summary,
    limits:topic==='air'?'発生源・人口曝露・健康被害・過去からの改善量は計算していない。':topic==='fire'?'異時刻の検知記録であり、同時出力・総エネルギー・火災被害を推定していない。':'別変数の因果効果は推定していない。'};
  const futurePerspective=interpreted&&hasComparison?{focus:'human-earth-co-creation-and-future',evidenceRecordIds:topic==='fire'?(interpreted.interpretationBasis?.recordIds||measured.recordIds):topic==='air'?(measured.details?.upperTailRecordIds||measured.recordIds):measured.recordIds,
    basis:topic==='quake'?'同規模の地震における深さの違い':topic==='air'?'地点別の微粒子濃度の偏り':topic==='fire'?'検知記録の熱放射強度の集中':'地点別の日射の違い',
    interpretation:interpreted.summary,proposalOnly:topic==='fire'?'人口・生態系との位置関係は未解析。重ね合わせは将来の問い。':null}:null;
  return {...measured,audience:'earth-context',takeawayLabel:reading.label,headline,fact,summary,...interpreted,futurePerspective,takeawayCaveat:reading.scope};
}
