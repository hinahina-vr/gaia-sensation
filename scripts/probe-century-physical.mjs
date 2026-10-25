import {source} from './lib/atlas-century-source.mjs';
const queue=[];
for(const basin of ['a','p','i'])for(const depth of [700,2000]){const file=`h22-${basin}0-${depth}m.dat`;queue.push([file,`https://www.ncei.noaa.gov/data/oceans/woa/DATA_ANALYSIS/3M_HEAT_CONTENT/DATA/basin/yearly/${file}`,false]);}
queue.push(['ozone-annual.html','https://ozonewatch.gsfc.nasa.gov/statistics/annual_data.html',false],['mb_ref.csv','https://wgms.ch/data/faq/mb_ref.csv?db=2026-02-10',false]);
for(const [name,endpoint,pages,extra]of[['volcano','volcanoes',2,''],['tsunami','tsunamis/events',3,'&minEventValidity=4&maxEventValidity=4']])for(let page=1;page<=pages;page++)queue.push([`${name}-${page}.json`,`https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/${endpoint}?minYear=1980&maxYear=2024&itemsPerPage=200${extra}&page=${page}`]);
await Promise.all(Array.from({length:3},async()=>{while(queue.length){const args=queue.shift();try{const body=await source(...args);console.log(args[0],JSON.stringify(body).slice(0,220));}catch(e){console.error(args[0],e.message);process.exitCode=1;}}}));
