import {electricityReading,electricityGauge,fitElectricityName} from './electricity-country-marks.js?v=release100-c363-20261027';

const ns='http://www.w3.org/2000/svg',clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const node=(tag,attributes={},text)=>{
  const element=document.createElementNS(ns,tag);
  for(const [name,value] of Object.entries(attributes))element.setAttribute(name,String(value));
  if(text!==undefined)element.textContent=text;
  return element;
};

// Keep typography out of the deliberately low-resolution animated map buffers.
// SVG uses the display's native text rasterization without another large bitmap.
export function createElectricityLabelLayer(){
  let svg,current,previous,viewKey='',updates=0,shownAlpha,shownProgress;
  function update(labels,{host,width,height,view,compact,year,change,measure}){
    if(!host?.parentElement)return;
    if(!svg){
      svg=node('svg',{'class':'gaia-electricity-labels','aria-hidden':'true',focusable:'false'});
      const defs=node('defs'),wash=node('linearGradient',{id:'electricity-label-wash',x1:0,y1:0,x2:1,y2:0});
      for(const [offset,color,opacity] of [[0,'#061721',.95],[.82,'#061721',.87],[1,'#061721',0]])wash.append(node('stop',{offset,'stop-color':color,'stop-opacity':opacity}));
      defs.append(wash);previous=node('g',{'data-electricity-label-generation':'previous'});current=node('g',{'data-electricity-label-generation':'current'});
      svg.append(defs,previous,current);host.after(svg);
    }
    const nextView=[width,height,view.x,view.y,view.scale].join('/');
    if(viewKey===nextView)previous.replaceChildren(...current.childNodes);else previous.replaceChildren();
    current.replaceChildren();viewKey=nextView;shownProgress=undefined;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    for(const p of labels){
      const b=p.bounds,w=b.right-b.left,g=node('g',{'data-electricity-label':p.id,'data-selected':p.selected});
      const text=(value,x,y,size,fill,center=false)=>node('text',{x,y,'font-size':size,fill,'text-anchor':center?'middle':'start'},value);
      if(p.selected){
        const edge=p.anchor.x<b.left?b.left:p.anchor.x>b.right?b.right:clamp(p.anchor.x,b.left+6,b.right-6),cy=clamp(p.anchor.y,b.top+8,b.bottom-8);
        g.append(node('path',{d:`M${p.anchor.x} ${p.anchor.y}L${edge} ${cy}`,stroke:'#ffe4a3','stroke-opacity':.55,'stroke-width':.8,fill:'none'}),node('rect',{x:b.left,y:b.top,width:w,height:b.bottom-b.top,fill:'url(#electricity-label-wash)'}),node('rect',{x:b.left,y:b.top,width:2,height:b.bottom-b.top,fill:'#ffe4a3'}));
        const x=b.left+11,right=b.right-12,top=b.top,nameSize=compact?11:14;
        g.append(text(fitElectricityName(p.name,w-24,t=>measure(t,nameSize)),x,top+(compact?14:20),nameSize,'#e3f0ec'),text(p.text,x,top+(compact?36:49),compact?21:28,Number.isFinite(p.value)?'#ffe4a3':'#a8b7bf'));
        const gauge=electricityGauge(p.value,p.baseline,change),gy=top+(compact?46:63),gx=f=>x+(right-x)*f;
        const line=(x1,y1,x2,y2,stroke,width=2)=>node('line',{x1,y1,x2,y2,stroke,'stroke-width':width});
        g.append(line(x,gy,right,gy,'#59737a80'));
        if(gauge.value!==null)g.append(line(gx(gauge.origin),gy,gx(gauge.value),gy,change&&p.value<0?'#c8b4ec':'#ffe4a3'));
        if(gauge.baseline!==null)g.append(line(gx(gauge.baseline),gy-4,gx(gauge.baseline),gy+4,'#c0e4e4',1));
        g.append(text(change?`${year}年 · 2000年比`:`2000年 ${electricityReading(p.baseline)}`,x,top+(compact?62:83),compact?9:11,'#a7c9ce'));
      }else{
        const cx=(b.left+b.right)/2;
        g.setAttribute('class','gaia-electricity-label-country');
        g.append(text(fitElectricityName(p.name,w-12,t=>measure(t,11)),cx,b.top+12,11,'#c6dbd7',true),text(p.text,cx,b.bottom-5,13,Number.isFinite(p.value)?'#f5e5bc':'#a8b7bf',true));
      }
      current.append(g);
    }
    updates++;
  }
  return{
    update,
    present(alpha,fade){
      if(!svg)return;
      if(alpha!==shownAlpha){svg.style.opacity=String(alpha);shownAlpha=alpha;}
      const progress=fade?.active?fade.progress:1;
      if(progress!==shownProgress){
        current.setAttribute('opacity',String(progress));previous.setAttribute('opacity',String(1-progress));
        if(progress===1)previous.replaceChildren();shownProgress=progress;
      }
    },
    reset(){svg?.remove();svg=current=previous=null;viewKey='';shownAlpha=shownProgress=undefined;},
    getState:()=>({engine:'svg',updates,labels:current?.childElementCount||0,previousLabels:previous?.childElementCount||0,bitmapPixels:0})
  };
}
