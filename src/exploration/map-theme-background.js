import {mapBackgroundTheme, MAP_BACKGROUND_NOTE} from './map-theme-catalog.js?v=theme-background-20260912-wind-first-tooltip-20260925';
import {MAP_THEME_VERTEX, MAP_THEME_FRAGMENT} from './map-theme-shaders.js?v=rain-downward-20260912';
import {createOceanMask} from './estat-ocean.js?v=gaia-estat-ocean-1';
import {earthBaseScale} from './world-projection.js?v=gaia-japan-center-1';

let instance;
export function mountMapThemeBackground(){
  if(instance)return instance;
  const layer=document.querySelector('#japan-layer'),map=document.querySelector('#japan-map'),overlay=document.querySelector('#japan-overlay');
  if(!layer||!map||!overlay)return null;
  const canvas=document.createElement('canvas');canvas.id='gaia-map-theme-background';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');map.append(canvas);
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController();
  let theme=null,gl=null,program=null,buffer=null,locations=null,mask=null;
  let engine='uninitialized',frame=0,drawn=0,last=0,time=0,disposed=false,lost=false,needsFallback=false,wasVisible=false,maskStarted=0,contextCount=0;
  const currentId=()=>layer.dataset.liveExhibit||layer.dataset.firmsExhibit||layer.dataset.marineCodExhibit||layer.dataset.foodExhibit;
  const isVisible=()=>!!theme&&!document.hidden&&layer.getAttribute('aria-hidden')!=='true'&&!layer.hidden&&!layer.classList.contains('is-map-title-transitioning');
  const profile=()=>globalThis.GaiaFrameBudgetGovernor?.getProfile?.()||{level:'medium',targetFps:30,dprCap:1};
  const cancel=()=>{cancelAnimationFrame(frame);frame=0;last=0;};
  // The CSS fallback has no land mask: suppress it for ocean-only exhibits.
  const fallback=value=>{needsFallback=Boolean(value);map.classList.toggle('has-theme-background-fallback',isVisible()&&needsFallback&&!theme.oceanOnly);};
  const release=()=>{
    mask?.dispose();mask=null;
    if(gl&&!gl.isContextLost()){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}
    program=null;buffer=null;locations=null;
  };
  const compile=(type,source)=>{
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message||'Background shader compilation failed');}
    return shader;
  };
  const initialize=()=>{
    if(program)return true;
    if(disposed)return false;
    if(lost||engine==='unavailable'||engine==='shader-error'){fallback(true);return false;}
    gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
    if(!gl){engine='unavailable';fallback(true);return false;}
    contextCount++;
    let vertex,fragment;
    try{
      vertex=compile(gl.VERTEX_SHADER,MAP_THEME_VERTEX);fragment=compile(gl.FRAGMENT_SHADER,MAP_THEME_FRAGMENT);
      program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Background shader link failed');
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      locations=Object.fromEntries(['resolution','geo_view','land','mask_ready','ocean_only','time','seed','pattern','accent','secondary'].map(name=>[name,gl.getUniformLocation(program,'u_'+name)]));
      locations.position=gl.getAttribLocation(program,'a_position');mask=createOceanMask(gl);maskStarted=performance.now();
      engine='webgl2';fallback(false);return true;
    }catch(error){release();engine='shader-error';canvas.dataset.themeError=String(error.message||error);fallback(true);return false;}
    finally{if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);}
  };
  const queue=()=>{if(!disposed&&!frame&&isVisible())frame=requestAnimationFrame(timestamp=>draw(timestamp));};
  const draw=(timestamp=performance.now(),force=false)=>{
    frame=0;
    if(!isVisible()){cancel();return;}
    if(!initialize()){canvas.dataset.themeEngine=engine;return;}
    const quality=profile(),fps=quality.level==='low'?12:quality.level==='medium'?20:24;
    const animate=!motion.matches&&quality.level!=='static';
    if(!force&&last&&timestamp-last<1000/fps){queue();return;}
    if(last&&animate)time+=Math.min(.12,(timestamp-last)/1000)*theme.speed;
    last=timestamp;
    const rect=map.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const cap=quality.level==='low'||quality.level==='static'?280000:quality.level==='medium'?640000:960000;
    const ratio=Math.min(devicePixelRatio||1,quality.dprCap||1,1.25,Math.sqrt(cap/(rect.width*rect.height)));
    const width=Math.max(1,Math.floor(rect.width*ratio)),height=Math.max(1,Math.floor(rect.height*ratio));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    const scale=earthBaseScale(rect)*Math.max(1,Number(overlay.dataset.earthZoom)||1);
    const originX=(rect.width-360*scale)/2+(Number(overlay.dataset.earthOffsetX)||0),originY=(rect.height-180*scale)/2+(Number(overlay.dataset.earthOffsetY)||0);
    gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(locations.position);gl.vertexAttribPointer(locations.position,2,gl.FLOAT,false,0,0);
    gl.uniform2f(locations.resolution,width,height);gl.uniform4f(locations.geo_view,-30-originX/scale,90+originY/scale,rect.width/scale,rect.height/scale);
    gl.uniform1f(locations.time,time);gl.uniform1f(locations.seed,theme.seed);gl.uniform1i(locations.pattern,theme.pattern);
    gl.uniform1f(locations.ocean_only,theme.oceanOnly?1:0);
    gl.uniform3fv(locations.accent,theme.accent);gl.uniform3fv(locations.secondary,theme.secondary);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,mask.texture);gl.uniform1i(locations.land,0);gl.uniform1f(locations.mask_ready,mask.ready?1:0);
    gl.drawArrays(gl.TRIANGLES,0,3);drawn++;
    canvas.dataset.themeEngine=engine;canvas.dataset.themeFrame=String(drawn);canvas.dataset.themeTime=time.toFixed(3);canvas.dataset.themeMask=mask.state;
    canvas.dataset.themePixelCap=String(cap);canvas.dataset.themeTargetFps=String(animate?fps:0);
    fallback(!mask.ready&&mask.state!=='loading'||!mask.ready&&timestamp-maskStarted>15000);
    if(animate||!mask.ready&&mask.state==='loading'&&timestamp-maskStarted<15000)queue();
  };
  const addNote=()=>{
    const target=layer.dataset.firmsExhibit?layer.querySelector('.gaia-firms-copy'):
      layer.dataset.marineCodExhibit?layer.querySelector('.gaia-cod-guide'):layer.dataset.foodExhibit?layer.querySelector('.gaia-food-guide'):null;
    if(!target||target.querySelector('.gaia-theme-background-note'))return;
    const note=document.createElement('p');note.className='gaia-theme-background-note';note.textContent=MAP_BACKGROUND_NOTE;target.append(note);
  };
  const sync=()=>{
    if(disposed)return;
    const next=mapBackgroundTheme(currentId());
    const changed=next!==theme;
    if(changed){theme=next;time=0;cancel();
      if(theme){canvas.dataset.themeId=theme.id;canvas.dataset.themeNumber=String(theme.number);canvas.dataset.themePattern=String(theme.pattern);canvas.dataset.themeLabel=theme.label;map.style.setProperty('--theme-background-accent',theme.accent.map(c=>Math.round(c*255)).join(' '));}
      else{delete canvas.dataset.themeId;delete canvas.dataset.themeNumber;delete canvas.dataset.themePattern;delete canvas.dataset.themeLabel;map.style.removeProperty('--theme-background-accent');fallback(false);}
    }
    const visible=isVisible(),visibilityChanged=visible!==wasVisible;wasVisible=visible;
    canvas.hidden=!visible;
    fallback(needsFallback);
    if(theme)addNote();
    if(visible&&(changed||visibilityChanged||engine==='uninitialized'))queue();else if(!visible)cancel();
  };
  const on=(target,name,callback)=>target.addEventListener(name,callback,{signal:events.signal});
  const observer=new MutationObserver(sync);
  observer.observe(layer,{attributes:true,attributeFilter:['class','hidden','aria-hidden','data-live-exhibit','data-firms-exhibit','data-marine-cod-exhibit','data-food-exhibit']});
  // The base renderer republishes even unchanged coordinates. Only actual
  // camera changes should wake a reduced-motion/static background.
  const projection=()=>[overlay.dataset.earthZoom,overlay.dataset.earthOffsetX,overlay.dataset.earthOffsetY].join('|');
  let projectionKey=projection();
  const projectionObserver=new MutationObserver(()=>{const next=projection();if(next!==projectionKey){projectionKey=next;queue();}});projectionObserver.observe(overlay,{attributes:true,attributeFilter:['data-earth-zoom','data-earth-offset-x','data-earth-offset-y']});
  const resizeObserver=new ResizeObserver(queue);resizeObserver.observe(map);
  on(document,'visibilitychange',sync);on(motion,'change',()=>{cancel();queue();});
  for(const event of ['gaia:japan-open','gaia:japan-close','gaia:firms-exhibit-change','gaia:marine-cod-ready','gaia:marine-cod-change','gaia:food-ready','gaia:food-change'])on(globalThis,event,sync);
  on(globalThis,'gaia:lodchange',()=>{cancel();sync();queue();});
  on(canvas,'webglcontextlost',event=>{event.preventDefault();lost=true;engine='context-lost';cancel();release();canvas.dataset.themeEngine=engine;fallback(true);});
  on(canvas,'webglcontextrestored',()=>{lost=false;engine='uninitialized';delete canvas.dataset.themeError;sync();});
  const api={
    redraw(){cancel();if(isVisible())draw(performance.now(),true);},
    getState:()=>({active:isVisible(),id:theme?.id||null,number:theme?.number||null,pattern:theme?.pattern??null,label:theme?.label||null,engine,mask:mask?.state||'idle',frame:drawn,time,pendingFrame:Boolean(frame),contextCount,width:canvas.width,height:canvas.height,reduced:motion.matches,level:profile().level}),
    dispose(){if(disposed)return;disposed=true;cancel();events.abort();observer.disconnect();projectionObserver.disconnect();resizeObserver.disconnect();release();gl?.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();map.classList.remove('has-theme-background-fallback');map.style.removeProperty('--theme-background-accent');instance=null;},
  };
  instance=api;globalThis.GaiaMapThemeBackground=Object.freeze(api);sync();return api;
}
if(globalThis.GaiaMapObservationAdapter)mountMapThemeBackground();
else addEventListener('gaia:map-adapter-ready',mountMapThemeBackground,{once:true});
