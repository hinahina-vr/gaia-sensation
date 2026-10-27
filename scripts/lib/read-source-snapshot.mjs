import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

// Preserve the archived response bytes (and their SHA-256) in compact fixtures.
// CI never depends on the author's ignored artifacts directory or a live API.
export function readSourceSnapshot(file){
  if(typeof file==='string'&&file.startsWith('artifacts/')){
    const fixture=new URL(`../../data/sources/map-exhibit-snapshots/${file.slice(10)}.gz`,import.meta.url);
    if(fs.existsSync(fixture))return gunzipSync(fs.readFileSync(fixture));
  }
  return fs.readFileSync(file);
}
