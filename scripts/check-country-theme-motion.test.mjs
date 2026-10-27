import {test} from 'node:test';import assert from 'node:assert/strict';
import {countryThemeSignal} from '../src/exploration/country-theme-motion.js';
test('sanitation uses the displayed service observation even when safe data is absent',()=>{
 const definition={id:'sanitation'};assert.deepEqual(countryThemeSignal({definition,value:0,access:null,mode:'open'}),[0,0,0]);assert.deepEqual(countryThemeSignal({definition,value:35,access:null,mode:'open'}),[.35,0,0]);assert.equal(countryThemeSignal({definition,value:null,access:50,mode:'safe'}),null);
});
test('forest density uses source share while signed colors follow the selected change',()=>{
 const definition={id:'foresthistory'};assert.deepEqual(countryThemeSignal({definition,value:-5,access:60,mode:'change'}),[.6,.25,0]);assert.deepEqual(countryThemeSignal({definition,value:5,access:60,mode:'change'}),[.6,.75,0]);assert.deepEqual(countryThemeSignal({definition,value:60,access:60,mode:'share'}),[.6,.6,0]);assert.equal(countryThemeSignal({definition,value:null,access:60,mode:'change'}),null);assert.equal(countryThemeSignal({definition,value:0,access:null,mode:'share'}),null);
});
test('only the color range clips, without altering source readings or other exhibit signals',()=>{
 const input={definition:{id:'foresthistory'},value:35,access:80,mode:'change'};assert.deepEqual(countryThemeSignal(input),[.8,1,0]);assert.equal(input.value,35);assert.equal(countryThemeSignal({...input,definition:{id:'drinking'}}),null);
});
