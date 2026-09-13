import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4492/');
 const result=await page.evaluate(async()=>{
  const {MAP_THEME_VERTEX,MAP_THEME_FRAGMENT}=await import('/src/exploration/map-theme-shaders.js');
  const run=source=>{
   const c=document.createElement('canvas');c.width=400;c.height=300;
   const gl=c.getContext('webgl2');
   const p=gl.createProgram();
   // Track the complete rain output, including every visible moving component.
   for(const [type,code] of [[gl.VERTEX_SHADER,MAP_THEME_VERTEX],[gl.FRAGMENT_SHADER,source]]){
    const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);
   }gl.linkProgram(p);gl.useProgram(p);
   gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
   const a=gl.getAttribLocation(p,'a_position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
   const u=n=>gl.getUniformLocation(p,'u_'+n);
   gl.uniform2f(u('resolution'),400,300);gl.uniform4f(u('geo_view'),80,65,100,75);
   gl.uniform1f(u('mask_ready'),1);gl.uniform1i(u('pattern'),7);gl.uniform1f(u('seed'),2.941);
   gl.uniform3f(u('accent'),.47,.69,.86);gl.uniform3f(u('secondary'),.66,.84,.88);
   gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
   const frame=t=>{gl.uniform1f(u('time'),t);gl.drawArrays(gl.TRIANGLES,0,3);const b=new Uint8Array(400*300*4);gl.readPixels(0,0,400,300,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;};
   const first=frame(1),next=frame(1.3);let best={score:Infinity};
   for(let dy=-14;dy<=14;dy++)for(let dx=-4;dx<=4;dx++){
    let score=0,count=0;for(let y=30;y<270;y++)for(let x=20;x<380;x++){
     const i=(y*400+x)*4;if(first[i+2]<15)continue;
     score+=Math.abs(first[i+2]-next[((y+dy)*400+x+dx)*4+2]);count++;
    }score/=count;if(score<best.score)best={dx,dy,score,count};
   }return best;
  };
  return {before:run(MAP_THEME_FRAGMENT.replace('vec2(0,t*2.0)','vec2(0,-t*2.0)')),after:run(MAP_THEME_FRAGMENT)};
 });
 assert(result.before.dy>0,JSON.stringify(result));assert(result.after.dy<0,JSON.stringify(result));
 fs.mkdirSync('artifacts/rain-direction',{recursive:true});fs.writeFileSync('artifacts/rain-direction/report.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
