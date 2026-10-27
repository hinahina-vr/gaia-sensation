const ns='http://www.w3.org/2000/svg';
const element=(name,attributes={})=>{
  const node=document.createElementNS(ns,name);
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
  return node;
};

// Capture only text from the existing painters. Paths, fills, charts and hit
// bounds keep their original renderer and resolution budget.
export function createMapTextLayer(kind){
  let svg,current,previous,signature='',viewKey='',identity='',updates=0,count=0,shownAlpha,shownProgress;
  function record(ctx,paint,{host,width,height,view,ratio=1,key=''}){
    const commands=[];
    const text=(stroke,value,x,y,maxWidth)=>{
      const matrix=ctx.getTransform(),transform=[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].map(n=>n/ratio);
      commands.push({stroke,text:String(value),x,y,maxWidth:maxWidth&&ctx.measureText(String(value)).width>maxWidth?maxWidth:null,transform,font:ctx.font,align:ctx.textAlign,baseline:ctx.textBaseline,alpha:ctx.globalAlpha,fill:typeof ctx.fillStyle==='string'?ctx.fillStyle:'#d5e9ed',ink:typeof ctx.strokeStyle==='string'?ctx.strokeStyle:'#071721',lineWidth:ctx.lineWidth,shadow:ctx.shadowBlur>0?ctx.shadowColor:null});
    };
    const proxy=new Proxy(ctx,{
      get(target,key){
        if(key==='fillText')return(value,x,y,maxWidth)=>text(false,value,x,y,maxWidth);
        if(key==='strokeText')return(value,x,y,maxWidth)=>text(true,value,x,y,maxWidth);
        const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
      },
      set(target,key,value){Reflect.set(target,key,value,target);return true;}
    });
    const result=paint(proxy),nextSignature=JSON.stringify(commands),nextView=[width,height,view.x,view.y,view.scale].join('/');
    if(nextSignature===signature&&nextView===viewKey&&key===identity)return result;
    if(!host?.parentElement)return result;
    if(!svg){
      svg=element('svg',{'class':'gaia-map-text-layer','data-map-text-kind':kind,'aria-hidden':'true',focusable:'false'});
      previous=element('g',{'data-map-text-generation':'previous'});current=element('g',{'data-map-text-generation':'current'});
      svg.append(previous,current);host.after(svg);
    }
    if(viewKey!==nextView)previous.replaceChildren();
    else if(identity!==key)previous.replaceChildren(...current.childNodes);
    current.replaceChildren();svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    for(const command of commands){
      const attributes={x:command.x,y:command.y,transform:`matrix(${command.transform.join(' ')})`,opacity:command.alpha,'text-anchor':command.align==='center'?'middle':['right','end'].includes(command.align)?'end':'start','dominant-baseline':({top:'text-before-edge',hanging:'hanging',middle:'central',bottom:'text-after-edge',ideographic:'ideographic'})[command.baseline]||'alphabetic'};
      if(command.stroke)Object.assign(attributes,{fill:'none',stroke:command.ink,'stroke-width':command.lineWidth,'stroke-linejoin':'round'});
      else Object.assign(attributes,{fill:command.fill,...(command.shadow?{stroke:command.shadow,'stroke-width':2,'stroke-linejoin':'round','paint-order':'stroke fill'}:{})});
      if(command.maxWidth)Object.assign(attributes,{textLength:command.maxWidth,lengthAdjust:'spacingAndGlyphs'});
      const node=element('text',attributes);node.style.font=command.font;node.textContent=command.text;current.append(node);
    }
    signature=nextSignature;viewKey=nextView;identity=key;count=commands.length;updates++;shownProgress=undefined;
    return result;
  }
  return{
    record,
    present(alpha=1,fade){
      if(!svg)return;
      if(alpha!==shownAlpha){svg.style.opacity=String(alpha);shownAlpha=alpha;}
      const progress=fade?.active?fade.progress:1;
      if(progress!==shownProgress){current.setAttribute('opacity',String(progress));previous.setAttribute('opacity',String(1-progress));if(progress===1)previous.replaceChildren();shownProgress=progress;}
    },
    reset(){svg?.remove();svg=current=previous=null;signature=viewKey=identity='';count=0;shownAlpha=shownProgress=undefined;},
    getState:()=>({engine:'svg',texts:count,updates,previousTexts:previous?.childElementCount||0,bitmapPixels:0})
  };
}
