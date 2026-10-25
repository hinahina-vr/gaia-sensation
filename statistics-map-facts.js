const finite=n=>typeof n==='number'&&Number.isFinite(n);
const ids=rows=>rows.map(r=>String(r.id));
export function mapMeasuredFact(dataset,rows,measured){
 const valid=rows.filter(r=>finite(r.value)&&r.provenance!=='IMPUTED'&&r.valueStatus!=='IMPUTED');if(valid.length<5)return null;
 const detail=measured.details;
 if(dataset.id==='co2-trend'&&detail?.window>=3&&detail.change>0&&detail.beyond===detail.window)return{headline:'最近の炭素濃度は、以前の変動の幅を越えている',fact:'最近の期間では、すべての濃度が初期の期間の最高値を上回っています。一時的な上下動を越えて、濃度の水準そのものが高くなっています。',factEvidence:{kind:'persistent-higher-level',recordIds:ids(valid),values:{window:detail.window,beyond:detail.beyond,change:detail.change},calculation:'同一系列の直近窓の全記録が初期窓の最大値を上回る場合だけ表示。比較窓は三時点以上。'}};
 if(['emissions-urban','population'].includes(dataset.id)&&valid.length>=10&&valid.every(r=>r.value>=0)){
 const ordered=[...valid].sort((a,b)=>b.value-a.value),count=Math.ceil(valid.length*.1),total=valid.reduce((s,r)=>s+r.value,0),top=ordered.slice(0,count),share=top.reduce((s,r)=>s+r.value,0)/total;
 if(share>.5)return{fact:dataset.id==='population'?'国・地域の数では少数の人口大国に、対象地域の人口の大半が暮らしています。':'排出量の大きい少数の国・地域だけで、対象地域の化石燃料由来の排出量の過半を占めています。',factEvidence:{kind:'small-country-group-majority',recordIds:ids(valid),values:{topCount:count,topIds:ids(top),share,total},calculation:'同じ年の非負値を降順に並べ、上位ceil(n×0.1)件の全体合計に対する割合を計算。国数による少数と総量による多数を比較。'}};
 }
 return null;
}
