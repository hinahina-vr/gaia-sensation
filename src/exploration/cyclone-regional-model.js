import { format, windMS } from './climate-history-model.js?v=whole-trends20-20261025';

export function regionalSummary(region, year) {
  const row = region.years.find(item => item.year === year);
  if (!row) return null;
  const months = Array(12).fill(0), decades = [];
  for (const item of region.years) {
    item.months.forEach((count, i) => { months[i] += count; });
    const start = Math.floor(item.year/10)*10;
    let decade = decades.find(d => d.start === start);
    if (!decade) { decade = {start, end:item.year, seasons:0, count:0}; decades.push(decade); }
    decade.end = Math.max(decade.end,item.year); decade.seasons++; decade.count += item.count;
  }
  for (const decade of decades) decade.average = decade.count / decade.seasons;
  const total = months.reduce((a,b) => a+b,0), average = total / region.years.length;
  const maximumMonth = Math.max(...months);
  const peakMonths = maximumMonth ? months.flatMap((count,i) => count === maximumMonth ? [i+1] : []) : [];
  const speed = row.hours > 0 ? row.distanceKm / row.hours : null;
  const complete = decades.filter(d => d.seasons === 10), previous = complete.at(-2), latest = complete.at(-1);
  const difference = latest && previous ? latest.average-previous.average : null;
  const sentence = `${year}シーズンは${row.count}件が${region.name}の300 km圏内に接近。1980–2024シーズンの平均は${format(average)}件です。`;
  const each = peakMonths.length > 1 ? '各' : '';
  const seasonality = peakMonths.length ? `全期間で最も接近が多いのは${peakMonths.join('・')}月（${each}${maximumMonth}件、全${total}件の${each}${format(maximumMonth/total*100)}%）。` : '全期間で圏内への接近記録は0件です。';
  const comparison = difference === null ? '' : `${latest.start}–${latest.end}は平均${format(latest.average)}件、${previous.start}–${previous.end}の${format(previous.average)}件に対して${difference === 0 ? '同数' : `${format(Math.abs(difference))}件${difference>0?'増加':'減少'}`}しています。`;
  return {row, months, decades, total, average, speed, wind:windMS(row.peak?.windKnots), insight:`${sentence} ${seasonality} ${comparison}`};
}
