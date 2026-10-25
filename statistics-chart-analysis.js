import {studentTQuantile} from './statistics-lab-core.js';
const f=n=>Number.isFinite(n)?Number(n.toPrecision(4)).toString():'算出不可';
export function prepareStatisticalChart(result,method) {
 const c=result.chart;if(!c)return;
 const m=result.model;
 if(c.identity)c.annotations=[];
 c.annotations=(result.metrics||[]).filter(m=>Number.isFinite(m[1])).slice(0,3).map(m=>`${m[0]}=${f(m[1])}${m[2]||''}`);
 if(c.identity)c.annotations.push('線：観測値＝当てはめ値（重回帰そのものを1本の単回帰線にしない）');
 if(m?.coefficients?.length===2 && c.type==='scatter') {
  const [a,b]=m.coefficients,xs=m.pairs.map(p=>p[0]),n=xs.length;
  c.line=[a,b];c.annotations=[`n=${n}　r=${f(m.correlation)}　R²=${f(m.rSquared)}`,`ŷ=${f(a)} ${b<0?'−':'+'} ${f(Math.abs(b))}x`];
  if(m.df>0){
   const mean=xs.reduce((s,x)=>s+x,0)/n,sxx=xs.reduce((s,x)=>s+(x-mean)**2,0),se=Math.sqrt(m.rss/m.df),t=studentTQuantile(.975,m.df),prediction=method==='prediction';
   c.band=Array.from({length:61},(_,i)=>{const x=Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*i/60,y=a+b*x,margin=t*se*Math.sqrt((prediction?1:0)+1/n+(x-mean)**2/sxx);return {x,lower:y-margin,upper:y+margin};});
   c.annotations.push(prediction?'実線：単回帰　帯：新しい1観測の95%予測区間':'実線：単回帰　帯：平均応答の点ごとの95%信頼区間','区間は独立・等分散・正規誤差を仮定');
   result.metrics.push(['傾き95%下限',b-t*m.standardErrors[1],''],['傾き95%上限',b+t*m.standardErrors[1],'']);
  }
  if(method==='diagnostics'){
   c.pairs=m.fitted.map((x,i)=>[x,m.residuals[i]]);c.line=null;c.band=null;c.xLabel='当てはめ値 ŷ';c.yLabel='残差（観測値 − 当てはめ値）';c.residual=true;
   c.annotations=[`残差 vs 当てはめ値　n=${n}　R²=${f(m.rSquared)}`,`残差標準誤差=${f(Math.sqrt(m.rss/m.df))}　基準線：残差0`,'曲線状・漏斗状の偏りを確認（独立性はこの図だけでは判断不可）'];
  }
 }
 if(c.type==='interval'){c.lower??=c.interval?.[0];c.upper??=c.interval?.[1];c.xLabel=c.unit||'推定値';c.yLabel='区間推定';c.annotations=[`${method==='unbiased'?'n割りとn−1割りの比較（信頼区間ではない）':'95%信頼区間'}：${f(c.lower)}〜${f(c.upper)}`,`点推定=${f(c.estimate)}${c.unit||''}`];}
 if(c.type==='test'){c.xLabel=c.unit||'観測値';c.yLabel='群（縦方向は重なり回避）';if(c.interval)c.annotations.push(`平均差の95%区間：${f(c.interval[0]??c.interval.lower)}〜${f(c.interval[1]??c.interval.upper)}`);c.annotations.push(`青：${c.leftLabel||'第1群'}　紫：${c.rightLabel||'第2群'}`);}
 if(c.type==='anova'){c.xLabel='群';c.yLabel=`観測値（${c.unit||''}）`;c.categoryLevels=c.labels;c.annotations.push('横線：群平均　点：各観測');}
 if(c.type==='categorical'){c.annotations.push((c.groupLevels||[]).map((s,i)=>`${['青','紫','緑','黄'][i%4]}：${s}`).join('　'));if(method==='bh')c.yLabel='p値 / BH補正値（無次元）';}
 if(c.type==='logistic'){c.yLabel='観測結果 / 推定確率（0〜1）';c.annotations.push('曲線：ロジスティック推定確率　点：0/1の観測');}
 if(c.type==='sampling')c.annotations.push(`基準線：元の標本平均 ${f(c.populationMean)}`);
 if(c.type==='distribution')c.annotations.push(c.curve?.length?'棒：観測度数　破線：モデル期待度数':'収録値の分布');
 if(c.type==='discrete')c.annotations.push('青：観測度数　破線：モデル期待度数');
 if(c.type==='bayes'){c.xLabel='成功確率';c.yLabel='事後確率密度';c.annotations.push(`95% HDI：${f(c.hdi?.[0]??c.hdi?.lower)}〜${f(c.hdi?.[1]??c.hdi?.upper)}`);}
 if(c.polynomial)c.annotations.push('紫の破線：2次多項式（当てはまりの比較用）');
}
