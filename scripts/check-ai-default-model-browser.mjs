import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/ai-default-model';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:4492/?exhibit=7#world');await page.locator('[data-feature-start]').click();
 await page.evaluate(()=>GaiaModeLoader.load('statistics'));
 await page.evaluate(()=>GaiaStatisticsLab.open({datasetId:'ocean-currents'}));
 await page.locator('#gaia-statistics-ai-open').click();
 const dialog=page.locator('#gaia-statistics-ai-dialog');await dialog.waitFor({state:'visible'});
 assert.equal(await dialog.locator('[name="provider"]').inputValue(),'openrouter');
 assert.equal(await dialog.locator('[name="model"]').inputValue(),'deepseek/deepseek-v4-flash');
 await page.screenshot({path:`${out}/${width}.png`});
 await dialog.locator('[name="provider"]').selectOption('openai');
 await dialog.locator('[name="provider"]').selectOption('openrouter');
 assert.equal(await dialog.locator('[name="model"]').inputValue(),'deepseek/deepseek-v4-flash');
 const saved=await page.evaluate(async()=>{const ai=await import('/byok-ai.js?v=gaia-hardening-1');ai.saveAiConfiguration({provider:'openrouter',endpoint:ai.aiProviderPresets.openrouter.endpoint,model:'user-chosen-model',apiKey:'',rememberKey:false});return ai.readAiConfiguration().model;});
 assert.equal(saved,'user-chosen-model');
 console.log('PASS',width,'default, provider switch, saved model preserved; no API request');await page.close();
}}finally{await browser.close();}
