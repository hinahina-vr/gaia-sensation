import {urbanReading,urbanFormat,urbanSigned} from './urban-population.js?v=whole-trends20-20261025';
import {layoutCroplandComparisons} from './cropland-comparison.js?v=whole-trends20-20261025';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Country-level composition symbols, anchored to actual country polygons.
export function paintUrbanMarks(ctx,candidates,options) {
  const {compact,year,alpha}=options;
  ctx.font='11px serif';
  const marks=layoutCroplandComparisons(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
  for(const p of marks){
    const b=p.bounds,w=b.right-b.left,r=urbanReading(p.region,year),center=(b.left+b.right)/2;
    ctx.save();ctx.globalAlpha=alpha;ctx.textBaseline='alphabetic';ctx.shadowColor='#071720';ctx.shadowBlur=5;
    const ink=(s,x,y,size,color)=>{ctx.font=size+'px serif';ctx.fillStyle=color;ctx.fillText(s,x,y);};
    const bar=(x,y,width,height)=>{
      ctx.shadowBlur=0;ctx.fillStyle='#41616e';ctx.fillRect(x,y,width,height);
      if(r.urban!==null){
        const g=ctx.createLinearGradient(x,y,x+width,y);g.addColorStop(0,'#a57c49');g.addColorStop(1,'#f4d59f');
        ctx.fillStyle=g;ctx.fillRect(x,y,width*r.urban/100,height);
      }
      if(r.baseline!==null){ctx.strokeStyle='#f4efe1';ctx.lineWidth=1;const xx=x+width*r.baseline/100;ctx.beginPath();ctx.moveTo(xx,y-3);ctx.lineTo(xx,y+height+3);ctx.stroke();}
    };
    if(p.selected){
      const height=b.bottom-b.top;
      ctx.strokeStyle='#d8bc8d70';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(clamp(p.x,b.left,b.right),clamp(p.y,b.top+4,b.bottom-4));ctx.stroke();
      ctx.save();ctx.translate(center,(b.top+b.bottom)/2);ctx.scale(w/2,height/2);const wash=ctx.createRadialGradient(0,0,.1,0,0,1);wash.addColorStop(0,'#0b1b23ee');wash.addColorStop(.65,'#0b1b23ce');wash.addColorStop(1,'#0b1b2300');ctx.fillStyle=wash;ctx.fillRect(-1,-1,2,2);ctx.restore();
      ctx.textAlign='left';let name=p.name;ctx.font=(compact?11:15)+'px serif';while(ctx.measureText(name).width>w-72)name=name.slice(0,-1);if(name!==p.name)name+='…';
      ink(name,b.left+8,b.top+(compact?12:18),compact?11:15,'#dce8e6');
      ctx.textAlign='right';ink(year+'年',b.right-8,b.top+(compact?12:18),9,'#acbfca');
      ctx.textAlign='left';ink(urbanFormat(r.urban)+(r.urban===null?'':' %'),b.left+8,b.top+(compact?33:55),compact?20:31,'#f7d99e');
      if(!compact){
        ctx.textAlign='right';ink('都市人口',b.right-10,b.top+35,9,'#c9b695');ink('2000年比 '+urbanSigned(r.change)+' pt',b.right-10,b.top+54,12,'#e2cfae');
        bar(b.left+8,b.top+74,w-16,12);
        ctx.textAlign='left';ink('都市 '+urbanFormat(r.urban)+'%',b.left+8,b.top+104,11,'#edcf96');
        ctx.textAlign='right';ink('それ以外 '+urbanFormat(r.rural)+'%',b.right-8,b.top+104,11,'#9ebcc9');
        ctx.textAlign='left';ink('白い目印：2000年',b.left+8,b.top+122,9,'#9eafb5');
      }
    } else {
      ctx.textAlign='center';ink(p.name,center,b.top+13,11,'#d4dedc');
      ink(urbanFormat(r.urban)+' %',center,b.top+36,21,'#f0d29d');
      bar(b.left+8,b.top+45,w-16,5);
      ink(urbanSigned(r.change)+' pt',center,b.top+63,9,'#b9c6ca');
    }
    ctx.restore();
  }
  return marks.map(p=>({id:p.id,selected:p.selected,bounds:p.bounds,anchor:{x:p.x,y:p.y},...urbanReading(p.region,year),alpha}));
}
