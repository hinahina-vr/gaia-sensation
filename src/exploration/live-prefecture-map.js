import { earthLongitudeToMapX } from './world-projection.js?v=gaia-japan-center-1';
import { OBSERVATION_CITIES } from './observation-cities.js?v=gaia-exhibit-catalog-1';
import { formatJapaneseNumber } from '../shared/number-format.js';

const NS='http://www.w3.org/2000/svg';
const TOPOLOGY=new URL('../../data/japan-prefectures.topojson?v=gaia-estat-choropleth-1',import.meta.url);
// The same boundary data, arc stitching and world coordinates as exhibit 21.
export const prefecturePaths=topology=>{
  const geometries=topology?.objects?.japan?.geometries,transform=topology?.transform;
  if(topology?.type!=='Topology'||geometries?.length!==47||!transform)throw new Error('Incomplete prefecture boundaries');
  const arcs=topology.arcs.map(arc=>{let x=0,y=0;return arc.map(([dx,dy])=>{x+=dx;y+=dy;return [x*transform.scale[0]+transform.translate[0],y*transform.scale[1]+transform.translate[1]];});});
  const shapes=geometries.map(geometry=>{
    const polygons=geometry.type==='Polygon'?[geometry.arcs]:geometry.arcs;
    const d=polygons.map(polygon=>polygon.map(references=>{
      const ring=references.flatMap((reference,i)=>{const source=arcs[reference<0?~reference:reference],points=reference<0?[...source].reverse():source;return i?points.slice(1):points;});
      return ring.map(([lon,lat],i)=>`${i?'L':'M'}${earthLongitudeToMapX(lon).toFixed(4)} ${(90-lat).toFixed(4)}`).join(' ')+' Z';
    }).join(' ')).join(' ');
    return {code:String(geometry.properties.id).padStart(2,'0'),d};
  }).sort((a,b)=>a.code.localeCompare(b.code));
  if(shapes.some((s,i)=>Number(s.code)!==i+1))throw new Error('Invalid prefecture codes');
  return shapes;
};

export const prefectureReading=(field,key,cityId)=>{
  const provider=['forecastCo2','pm25'].includes(key)?'air':'weather',data=field?.[provider];
  const point=data?.points?.find(p=>p.id===cityId),value=point?.measurements?.[key];
  return {value:Number.isFinite(value)?value:null,observedAt:point?.observedAt||'',source:data?.source||'unavailable',provider:provider==='air'?'Open-Meteo / CAMS':'Open-Meteo'};
};

export const prefectureColor=(value,scale)=>{
  if(!Number.isFinite(value))return '#344354';
  const [min,max,,gradient]=scale,t=Math.max(0,Math.min(1,(value-min)/(max-min)));
  const colors=[...gradient.matchAll(/#([a-f\d]{6})(?:\s+(\d+)%)?/gi)];
  const stops=colors.map(([,,position],i)=>position===undefined?i/(colors.length-1):Number(position)/100);
  const upper=Math.max(1,stops.findIndex(stop=>stop>=t)),lower=upper-1,ratio=(t-stops[lower])/(stops[upper]-stops[lower]);
  const channels=index=>colors[index][1].match(/../g).map(v=>parseInt(v,16));
  const a=channels(lower),b=channels(upper);
  return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*(ratio+Number.EPSILON)).toString(16).padStart(2,'0')).join('');
};

export function createLivePrefectureMap({map,onSelect,onPause}){
  const svg=document.createElementNS(NS,'svg'),group=document.createElementNS(NS,'g');
  svg.classList.add('gaia-live-prefecture-regions');svg.setAttribute('hidden','');svg.setAttribute('aria-label','代表都市のモデル値を塗り分けた47都道府県');svg.append(group);map.append(svg);
  const tooltip=document.createElement('div');tooltip.className='gaia-live-region-tooltip';tooltip.hidden=true;
  tooltip.innerHTML='<strong></strong><b></b><small></small><span>代表都市のモデル値／都道府県平均ではありません</span>';map.append(tooltip);
  const status=document.createElement('p');status.className='gaia-live-region-status';status.hidden=true;status.setAttribute('role','status');map.append(status);
  let regions=[],active=false,loading=null,last=null,painted=null,hovered=null,down=null;
  // The shared map captures pointers for panning. Its pointerup target is the
  // map, not the originating path, so a normal path click handler is insufficient.
  map.addEventListener('pointerdown',e=>{if(!e.isPrimary)down=null;},{capture:true});
  map.addEventListener('pointermove',e=>{if(down&&e.pointerId===down.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)down=null;},{capture:true});
  map.addEventListener('pointerup',e=>{
    const start=down;down=null;
    if(!active||!start||e.pointerId!==start.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;
    onSelect(start.city.id);show(start.city);
  },{capture:true});
  map.addEventListener('pointercancel',()=>{down=null;},{capture:true});
  const set=(e,name,value)=>{const text=String(value);if(e.getAttribute(name)!==text)e.setAttribute(name,text);};
  const reading=city=>{
    const value=prefectureReading(last.field,last.exhibit.key,city.id);
    // A newer, city-specific response may supersede the national snapshot.
    if(city.id===last.selectedCity&&last.measurement?.value!=null&&Number.isFinite(last.measurement.value))return {...value,value:last.measurement.value,observedAt:last.measurement.observedAt,source:last.measurement.status==='snapshot'?'snapshot':value.source};
    return value;
  };
  const show=city=>{
    if(!active||!last||!city){tooltip.hidden=true;return;}
    const value=reading(city),unit=last.scale[2];
    tooltip.querySelector('strong').textContent=`${city.prefecture}・${city.city}`;
    tooltip.querySelector('b').textContent=value.value===null?'データなし':`${last.exhibit.signalLabel} ${formatJapaneseNumber(value.value,last.exhibit.key==='weatherPrecipitation'?2:1)}\u00a0${unit}`;
    const time=Date.parse(value.observedAt);
    tooltip.querySelector('small').textContent=`${value.provider} · ${Number.isFinite(time)?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(time)+' JST':'時刻なし'}${value.source==='snapshot'?' · 保存値':value.source==='stale-cache'?' · 前回値':''}`;
    tooltip.hidden=false;
    const {rect,scale,originX,originY}=last.projection;
    const x=originX+earthLongitudeToMapX(city.lon)*scale,y=originY+(90-city.lat)*scale;
    const width=tooltip.offsetWidth,height=tooltip.offsetHeight;
    const obstacles=[...map.closest('#japan-layer').querySelectorAll('.japan-heading,.gaia-live-metric-legend,.signal-encoding-legend-dock,.gaia-live-exhibit-readout,.japan-credits,.gaia-live-weather-credit,#gaia-map-zoom-controls')].filter(e=>e.checkVisibility()).map(e=>e.getBoundingClientRect());
    const candidates=[x+20,x-width-20,12,rect.width-width-12].flatMap(px=>[y-height-18,y+18,...obstacles.flatMap(r=>[r.bottom-rect.top+12,r.top-rect.top-height-12])].map(py=>{
      px=Math.max(12,Math.min(px,rect.width-width-12));py=Math.max(12,Math.min(py,rect.height-height-12));
      const overlap=obstacles.reduce((n,r)=>n+Math.max(0,Math.min(px+width,r.right-rect.left)-Math.max(px,r.left-rect.left))*Math.max(0,Math.min(py+height,r.bottom-rect.top)-Math.max(py,r.top-rect.top)),0);
      return {x:px,y:py,score:overlap*1000+Math.hypot(px-x,py-y)};
    }));
    const best=candidates.sort((a,b)=>a.score-b.score)[0];tooltip.style.left=best.x+'px';tooltip.style.top=best.y+'px';
  };
  const update=state=>{
    last=state;if(!active||!state?.projection)return;
    const {rect,scale,originX,originY}=state.projection;
    const projectionKey=[rect.width,rect.height,rect.left,rect.top,scale,originX,originY].join('|');
    if(painted?.field===state.field&&painted.exhibit===state.exhibit&&painted.selectedCity===state.selectedCity&&painted.measurement===state.measurement&&painted.projectionKey===projectionKey)return;
    painted={...state,projectionKey};
    set(svg,'viewBox',`0 0 ${rect.width} ${rect.height}`);set(group,'transform',`translate(${originX} ${originY}) scale(${scale})`);
    regions.forEach((region,i)=>{
      const city=OBSERVATION_CITIES[i],value=reading(city),missing=value.value===null;
      set(region,'fill',prefectureColor(value.value,state.scale));set(region,'data-value',missing?'missing':value.value);set(region,'data-missing',missing);
      set(region,'aria-current',city.id===state.selectedCity);set(region,'data-observed-at',value.observedAt);
      set(region,'aria-label',`${city.code} ${city.prefecture}、代表都市 ${city.city}、${missing?'データなし':state.exhibit.signalLabel+' '+value.value+' '+state.scale[2]}。都道府県平均ではありません`);
    });
    show(hovered);
  };
  const load=()=>{
    if(loading)return loading;
    status.textContent='都道府県の境界を読み込み中';status.hidden=!active;
    loading=fetch(TOPOLOGY,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('Boundaries unavailable');return r.json();}).then(prefecturePaths).then(shapes=>{
      regions=shapes.map((shape,i)=>{
        const city=OBSERVATION_CITIES[i],region=document.createElementNS(NS,'path');region.classList.add('gaia-live-prefecture-region');region.dataset.livePrefecture=shape.code;region.dataset.city=city.id;
        region.setAttribute('d',shape.d);region.setAttribute('fill-rule','evenodd');region.setAttribute('role','button');region.setAttribute('tabindex','0');
        region.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0)down={x:e.clientX,y:e.clientY,pointerId:e.pointerId,city};onPause();});
        const preview=()=>{hovered=city;show(city);};region.addEventListener('pointerenter',preview);region.addEventListener('focus',preview);
        const leave=()=>{hovered=null;show(null);};region.addEventListener('pointerleave',leave);region.addEventListener('blur',leave);
        region.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(e.detail!==0)return;onPause();onSelect(city.id);show(city);});
        region.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onPause();onSelect(city.id);show(city);}});
        group.append(region);return region;
      });status.hidden=true;painted=null;if(last)update(last);
    }).catch(()=>{loading=null;status.textContent='都道府県の境界を取得できません。下の地域選択から値を確認できます。';status.hidden=!active;});
    return loading;
  };
  return {update,reflow:()=>show(hovered),setActive(value){active=value;painted=null;down=null;svg.toggleAttribute('hidden',!active);if(active)void load();else {tooltip.hidden=true;status.hidden=true;hovered=null;}},element:svg};
}
