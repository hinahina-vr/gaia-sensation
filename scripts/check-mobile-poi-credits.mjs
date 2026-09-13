import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='artifacts/mobile-poi-credits-20260913';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const width of [390,628]){
 const p=await b.newPage({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'});
 await p.route('https://**',r=>r.abort());
 await p.goto('http://127.0.0.1:4492/#world-15');
 await p.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
 await p.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
 await p.waitForTimeout(800);
 const provider=p.locator('.gaia-live-weather-credit');
 const readCreditTop=()=>provider.evaluate(n=>({top:n.getBoundingClientRect().top,parent:n.closest('.japan-credits').getBoundingClientRect().top,scroll:n.closest('.japan-credits').scrollTop}));
 assert(!(await p.locator('.japan-credits').isVisible()),'No persistent mobile credit band');
 const tiles=p.locator('#japan-tiles');
 assert.equal(await p.locator('.map-mobile-osm-attribution').isVisible(),await tiles.evaluate(n=>!n.hidden),'OSM attribution follows tile usage');
 // Controlled visible-card fixture uses the actual card, source and credit nodes.
 await p.evaluate(()=>{const card=document.querySelector('#japan-poi-card');card.hidden=false;card.setAttribute('aria-hidden','false');document.querySelector('#japan-poi-type').textContent='観測地点';document.querySelector('#japan-poi-meta').textContent='Open-Meteo / CC BY 4.0 / 加工表示';});
 await p.waitForTimeout(250);
 const card=p.locator('#japan-poi-card');
 assert.deepEqual(await p.locator('#japan-poi-close').evaluate(n=>{const s=getComputedStyle(n),i=getComputedStyle(n,'::after');return [s.width,s.height,s.borderTopWidth,i.width];}),['44px','44px','0px','18px']);
 assert(await card.evaluate(n=>n.scrollTop===0&&n.getBoundingClientRect().top>=0),'Card opens at its top');
 assert(await card.evaluate(n=>Math.abs(n.getBoundingClientRect().top-parseFloat(getComputedStyle(document.querySelector('#japan-layer')).getPropertyValue('--mobile-heading-bottom')))<2),'Card aligned below heading');
 const source=p.locator('#japan-poi-source');await source.scrollIntoViewIfNeeded();
 assert(await card.locator('.japan-credits').count());
 const disclosure=card.locator('.map-poi-credits-disclosure');
 assert.equal(await disclosure.getAttribute('open'),null,'Credits start collapsed');
 assert(!(await card.locator('.japan-credits').isVisible()),'Credit body hidden until requested');
 await disclosure.locator('summary').click();
 assert(await card.locator('.japan-credits').isVisible(),'Click expands credits');
 const gap=await p.evaluate(()=>document.querySelector('.japan-credits').getBoundingClientRect().top-document.querySelector('#japan-poi-source').getBoundingClientRect().bottom);
 assert(gap>=8,`source/credit gap ${gap}`);
 await p.screenshot({path:`${out}/${width}.png`});
 await p.locator('#japan-poi-close').click();
 await p.waitForTimeout(200);assert.equal(await card.locator('.japan-credits').count(),0);
 await p.close();console.log(`PASS ${width} credit flow and restore`);
}}finally{await b.close();}
