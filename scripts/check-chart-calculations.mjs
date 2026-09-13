import assert from 'node:assert/strict';
import {analyzeCorrelation,analyzeInterval} from '../statistics-lab-core.js';
import {prepareStatisticalChart} from '../statistics-chart-analysis.js';
const input={x:[1,2,3,4,5],y:[2,5,5,9,9],xLabel:'x',yLabel:'y'};
const ci=analyzeCorrelation(input),pi=analyzeCorrelation(input),res=analyzeCorrelation(input);
prepareStatisticalChart(ci,'regression');prepareStatisticalChart(pi,'prediction');prepareStatisticalChart(res,'diagnostics');
assert.equal(ci.chart.band.length,61);assert.equal(ci.chart.line[1],ci.model.coefficients[1]);
for(let i=0;i<61;i++){const a=ci.chart.band[i],b=pi.chart.band[i];assert(b.upper-b.lower>a.upper-a.lower);assert(Math.abs((a.lower+a.upper)/2-(ci.model.coefficients[0]+ci.model.coefficients[1]*a.x))<1e-10);}
assert.deepEqual(res.chart.pairs,res.model.fitted.map((x,i)=>[x,res.model.residuals[i]]));assert(!res.chart.line&&!res.chart.band);
const interval=analyzeInterval({values:[1,2,3,4,5],label:'test',unit:'m'});prepareStatisticalChart(interval,'interval');assert(interval.chart.lower<interval.chart.estimate&&interval.chart.upper>interval.chart.estimate);
console.log('PASS coefficient alignment, 61-point CI/PI arithmetic, prediction wider than mean CI, residual pairs, interval endpoints');
