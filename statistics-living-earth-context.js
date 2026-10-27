// Read the comparison already calculated for the chart. Do not calculate a
// second trend, pool countries, infer causes, or turn access into consumption.
const modes=new Set(['waterstore']);
const finite=Number.isFinite;
const choose=(direction,down,flat,up)=>direction<0?down:direction>0?up:flat;
export function livingEarthInsight(dataset,rows,measured){
 if(!modes.has(dataset.modeId))return null;
 const detail=measured.details,a=measured.metrics?.[0]?.[1],b=measured.metrics?.[1]?.[1],change=detail?.change;
 const wrap=(headline,fact,summary,label,values)=>({...measured,audience:'earth-context',headline,fact,summary,takeawayLabel:label,takeawayCaveat:dataset.comparisonNote||'',factEvidence:{kind:'existing-analysis-reading',recordIds:measured.recordIds,calculation:measured.calculation,values},logic:{evidence:measured.calculation,inference:fact,implication:summary,limits:dataset.comparisonNote||''},futurePerspective:{focus:'human-earth-co-creation-and-future',basis:'表示中の期間比較と、対象指標の定義',evidenceRecordIds:measured.recordIds}});
 if(!finite(a)||!finite(b)||!finite(change)||!detail?.window)return wrap('この期間の変化は、まだ比べられない','期間の前後をそろえた比較結果がなく、増減を読み取れません。','この結果からは、変化を踏まえた暮らしの方向を判断できません。比較できる期間を選ぶと、何が変わったかを確かめられます。','変化を確かめる',{supportedComparison:false});
 const tolerance=['%','ポイント'].includes(dataset.unit) ? .25 :dataset.unit==='年' ? .1 :Math.max(1e-12,detail.range*.01);
 const direction=Math.abs(change)<=tolerance?0:Math.sign(change),relative=/-change$/.test(dataset.id),gap=/-gap$/.test(dataset.id),safe=/SMDW/.test(dataset.sourceUrl||''),basicOnly=dataset.modeId==='sanitation'&&/-basic$/.test(dataset.id),open=dataset.modeId==='sanitation'&&/-open$/.test(dataset.id),limited=dataset.modeId==='sanitation'&&/-limited$/.test(dataset.id);
 let headline,fact,summary,label;
 const movement=subject=>`${subject}の平均は、${choose(direction,'初期より後期に低くなっています。','初期と後期で近い水準です。','初期より後期に高くなっています。')}`;
 const persistence=()=>direction&&detail.beyond===detail.window?' 後期のすべての年で、初期の'+(direction>0?'最高値を上回っています。':'最低値を下回っています。'):direction&&detail.range>Math.abs(change)*3?' 期間の平均差より、年ごとの変動幅が大きくなっています。':'';
 switch(dataset.modeId){
 case 'waterstore':
  label='水を使う暮らしを、土地の蓄えに合わせる';
  headline=choose(direction,'大地に蓄えられた水が、以前より減っている','水の蓄えは、期間の前後で近い水準にある','大地に蓄えられた水が、以前より増えている');
  fact=movement('地表・土壌・地下を合わせた水の蓄え')+persistence();
  summary=choose(direction,'水の蓄えが減る土地では、暮らしや農業で使う量と、雨から戻る量の釣り合いが問われます。取る量を抑え、雨が土にしみ込む場所を残すという選択を、同じ土地の水の変化から考えられます。','前後の平均が近くても、年ごとの水の蓄えには変動があります。水が少ない年にも人と生きものの分を残せるよう、使う量と蓄える場所を考えることが、この土地で暮らし続ける備えになります。','後期には、土や地下を含む水の蓄えが多くなっています。この変化を一時的な増水で終わらせず、水が少ない年にも使える蓄えとして守れるか。雨を受け止める土地と、そこから水を得る暮らしを一緒に考えられます。');break;
 }
 return wrap(headline,fact,summary,label,{baseline:a,recent:b,change,window:detail.window,beyond:detail.beyond,range:detail.range,presentationTolerance:tolerance});
}
