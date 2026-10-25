import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const files=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(?:js|html|json)$/.test(p))files.push(p);}};
for(const e of fs.readdirSync('.',{withFileTypes:true}))if(e.isFile()&&/\.(?:js|html)$/.test(e.name))files.push(e.name);
for(const d of ['src','locales','concept','sensors','space','data'])if(fs.existsSync(d))walk(d);
const bad=files.filter(p=>fs.readFileSync(p,'utf8').includes('収録'));assert.deepEqual(bad,[],'Forbidden visitor vocabulary: '+bad.join(', '));console.log('PASS visitor vocabulary:',files.length,'runtime source/data files');
