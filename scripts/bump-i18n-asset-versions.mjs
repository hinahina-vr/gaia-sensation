// Mechanical cache-key propagation for the local i18n candidate.
// Read-only by default; --write updates only known project text assets.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),tag='i18n-20260913';
const list=args=>execFileSync(args[0],args.slice(1),{cwd:root,encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/u).filter(Boolean);
const files=list(['rg','--files','-g','*.js','-g','*.css','-g','*.html','-g','!scripts/**','-g','!artifacts/**','-g','!node_modules/**','-g','!output/**','-g','!sensor-platform/**']);
const changed=new Set([...list(['git','diff','--name-only']),...list(['git','ls-files','--others','--exclude-standard'])].filter(f=>/\.(?:js|css|html)$/u.test(f)).map(f=>path.resolve(root,f).toLowerCase()));
const originals=new Map(files.map(file=>[file,fs.readFileSync(file,'utf8')])),next=new Map(originals);
const reference=/((?:\.\.?\/)[^"'`\s<>]+?\.(?:js|css))(?:\?v=([^"'`\s<>]+))?/gu;
let passChanged=true;
while(passChanged){
 passChanged=false;
 for(const [file,source]of originals){
  const value=source.replace(reference,(whole,url,version)=>{
   const target=path.resolve(path.dirname(path.resolve(root,file)),url).toLowerCase();
   if(!changed.has(target)||version?.endsWith(tag))return whole;
   return url+'?v='+(version?version+'-':'')+tag;
  });
  if(value!==next.get(file)){
   next.set(file,value);changed.add(path.resolve(root,file).toLowerCase());passChanged=true;
  }
 }
}
const updates=[...next].filter(([file,source])=>source!==originals.get(file));
console.log(JSON.stringify({tag,files:updates.map(([file])=>file)},null,2));
if(process.argv.includes('--write'))for(const [file,source]of updates){
 const target=path.resolve(root,file),relative=path.relative(root,target);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Outside workspace');
 fs.writeFileSync(target,source);
}
