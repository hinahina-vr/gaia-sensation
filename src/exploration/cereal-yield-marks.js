import {yieldReading,yieldScale,yieldFormat} from './cereal-yield.js?v=yield-20261023';
// Reuse collision placement, not the cropland denominator or its visual marks.
import {layoutCroplandComparisons} from './cropland-comparison.js?v=whole-trends20-20261025';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fit=(c,s,w)=>{let t=s;while(t.length&&c.measureText(t+(t===s?'':'…')).width>w)t=t.slice(0,-1);return t+(t===s?'':'…');};
export function paintYieldMarks(ctx,candidates,options){
  const {compact,year,alpha}=options;ctx.font='11px serif';
  const marks=layoutCroplandComparisons(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
  for(const p of marks){
    const b=p.bounds,w=b.right-b.left,h=b.bottom-b.top,r=yieldReading(p.region,year),limit=yieldScale(p.region),color=r.value===null?'#b0bfc2':'#f3d994';
    ctx.save();ctx.globalAlpha=alpha;ctx.textBaseline='alphabetic';ctx.shadowColor='#031620';ctx.shadowBlur=5;
    const ink=(s,x,y,size,color)=>{ctx.font=`${size}px serif`;ctx.fillStyle=color;ctx.fillText(s,x,y);};
    if(p.selected){
      ctx.strokeStyle='#dfd9ac66';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(clamp(p.x,b.left,b.right),clamp(p.y,b.top+4,b.bottom-4));ctx.stroke();
      ctx.save();ctx.translate((b.left+b.right)/2,(b.top+b.bottom)/2);ctx.scale(w/2,h/2);const wash=ctx.createRadialGradient(0,0,.12,0,0,1);wash.addColorStop(0,'#071a23ed');wash.addColorStop(.65,'#071a23ba');wash.addColorStop(1,'#071a2300');ctx.fillStyle=wash;ctx.fillRect(-1,-1,2,2);ctx.restore();
      ctx.textAlign='left';ctx.font=`${compact?11:15}px serif`;ink(fit(ctx,p.name,w-70),b.left+8,b.top+(compact?12:18),compact?11:15,'#ede8ce');
      ctx.textAlign='right';ink(`${year}年`,b.right-8,b.top+(compact?12:18),9,'#a6b9b8');ctx.textAlign='left';
      ink(`${yieldFormat(r.value)}${compact&&r.value!==null?' kg/ha':''}`,b.left+8,b.top+(compact?33:59),compact?19:r.value>=10000?22:27,color);
      if(!compact){
        ink('kg / 収穫面積 1 ha',b.left+8,b.top+77,10,'#a8bcb8');
        ink(`2000  ${yieldFormat(r.base)}`,b.left+8,b.top+102,11,'#c2c9b9');
        ink(`縦軸 0–${yieldFormat(limit)} kg/ha`,b.left+8,b.top+131,9,'#a1b5b3');
        const bottom=b.top+108,top=b.top+36,barWidth=25;
        for(const [i,v,label] of [[0,r.base,'2000'],[1,r.value,String(year)]]){
          const x=b.left+160+i*39,y=bottom-(v??0)/limit*(bottom-top);
          ctx.shadowBlur=0;ctx.strokeStyle='#b6bda34a';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,bottom);ctx.lineTo(x+barWidth,bottom);ctx.stroke();
          if(v!==null){const gradient=ctx.createLinearGradient(0,top,0,bottom);gradient.addColorStop(0,i?'#f6df9d':'#a5b6ab');gradient.addColorStop(1,i?'#bc9f5b66':'#a5b6ab25');ctx.fillStyle=gradient;ctx.fillRect(x,y,barWidth,bottom-y);ctx.strokeStyle=i?'#f8e5ae':'#afc3b7';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+barWidth,y);ctx.stroke();}
          else{ctx.textAlign='center';ink('欠測',x+barWidth/2,bottom-8,9,'#afbdc2');}
          ctx.textAlign='center';ink(label,x+barWidth/2,bottom+12,9,'#b9c4b3');
        }
      }
    }else{
      ctx.textAlign='center';ctx.font='11px serif';const x=(b.left+b.right)/2;
      ink(fit(ctx,p.name,w-8),x,b.top+16,11,'#dce3cb');ink(yieldFormat(r.value),x,b.top+38,21,color);ink('kg/ha',x,b.top+53,9,'#acbeb8');
    }
    ctx.restore();
  }
  return marks.map(p=>({id:p.id,selected:p.selected,bounds:p.bounds,anchor:{x:p.x,y:p.y},...yieldReading(p.region,year),limit:yieldScale(p.region),alpha}));
}
