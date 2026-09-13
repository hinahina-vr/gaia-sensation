/** 概要: 画面サイズに応じた地図の配置調整。低い画面では観測データを開閉式にし、操作部品の重なりを避ける。 */
(() => {
  const layer=document.querySelector('#japan-layer');if(!layer)return;
  const selector='.gaia-live-exhibit-readout,.gaia-estat-readout,.gaia-firms-readout,.gaia-planet-signals-readout,.gaia-marine-cod-readout,.gaia-food-readout,.signal-console-map';
  const compact=matchMedia('(max-width:900px) and (max-height:700px)');
  const drawer=document.createElement('details');drawer.id='map-responsive-data';drawer.hidden=true;
  const summary=document.createElement('summary');summary.textContent='観測データ';drawer.append(summary);layer.append(drawer);
  // The original source panel owns both exhibit sources and map attributions.
  const sourcePanel=layer.querySelector('#japan-data-panel');
  const baseSources=document.createElement('details');baseSources.className='map-base-sources';
  sourcePanel.querySelector('.japan-data-scroll').append(baseSources);
  const syncSources=()=>{
    if(sourcePanel.getAttribute('aria-hidden')==='true')return;
    const title=document.createElement('summary');title.textContent='地図表示・その他の機能に使うデータ';
    const note=document.createElement('p');note.textContent='分析する数値の出典とは別です。地図の描画や、別テーマの表示に使う共通データを記載しています。';
    const existing=new Set([...sourcePanel.querySelectorAll('#data-ledger-sources a[href]')].map(a=>a.href));
    const uses=[
      ['naturalearthdata.com','地図の形を描く','陸地・国境の描画に使用。選択中のテーマの数値や統計計算には使用しません。'],
      ['github.com/dataofjapan/land','都道府県の境界を描く','都道府県の輪郭の描画に使用。分析する観測値の出典ではありません。'],
      ['data.jma.go.jp/eqdb','地震テーマの震度表示','過去の地震・震度を表示する機能に使用。選択中のテーマの分析元として使う場合は、上のデータ欄に記載します。'],
      ['earthquake.usgs.gov','地震テーマの観測表示','地震の観測情報を表示する機能に使用。選択中のテーマの分析元として使う場合は、上のデータ欄に記載します。'],
      ['openstreetmap.org','背景地図を描く','背景地図のタイル画像に使用。観測値や統計計算には使用しません。'],
    ];
    const links=[...layer.querySelectorAll('.japan-credits a[href]')].filter(a=>!a.closest('[hidden]')).filter(a=>{if(existing.has(a.href))return false;existing.add(a.href);return true;}).map(a=>{
      const item=document.createElement('article');item.className='source-use-card';
      const use=uses.find(([host])=>a.href.includes(host));
      const heading=document.createElement('h4');heading.textContent=use?.[1]||'共通機能の出典';
      const description=document.createElement('p');description.textContent=use?.[2]||'分析対象の数値とは別の共通クレジットです。';
      item.append(heading,description,a.cloneNode(true));return item;
    });
    baseSources.replaceChildren(title,note,...links);baseSources.hidden=!links.length;
    baseSources.open=false;
  };
  new MutationObserver(syncSources).observe(sourcePanel,{attributes:true,attributeFilter:['aria-hidden']});
  new MutationObserver(syncSources).observe(layer.querySelector('#data-ledger-sources'),{childList:true});
  const homes=new Map(),watched=new WeakSet();let frame=0,lastMode='';
  const draggableLegends=new WeakSet();
  const makeLegendDraggable=node=>{
    if(node.id==='map-signal-encoding-legend-dock')return; // Owned by map-legend-drag.js; never bind a second drag handler.
    if(draggableLegends.has(node))return;
    draggableLegends.add(node);
    node.classList.add('map-draggable-legend');
    if(!node.hasAttribute('tabindex'))node.tabIndex=0;
    node.title='ドラッグで移動・矢印キーで移動・ダブルクリックで元の位置';
    let offsetX=0,offsetY=0,drag=null;
    const writeOffset=()=>node.style.setProperty('translate',`${offsetX}px ${offsetY}px`,'important');
    // Pointer coordinates are viewport pixels; CSS translation is in the
    // ancestor's coordinate system (including responsive zoom/transforms).
    const translationScale=()=>{
      const before=node.getBoundingClientRect();
      node.style.setProperty('translate',`${offsetX+10}px ${offsetY+10}px`,'important');
      const after=node.getBoundingClientRect();
      writeOffset();
      return {x:(after.left-before.left)/10||1,y:(after.top-before.top)/10||1};
    };
    const move=(dx,dy)=>{
      const rect=node.getBoundingClientRect(),margin=8;
      const scale=drag?.scale||translationScale();
      offsetX+=Math.max(margin-rect.left,Math.min(dx,innerWidth-margin-rect.right))/scale.x;
      offsetY+=Math.max(margin-rect.top,Math.min(dy,innerHeight-margin-rect.bottom))/scale.y;
      writeOffset();
    };
    node.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button,a,input,select,textarea,summary'))return;
      event.preventDefault();event.stopPropagation();
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,scale:translationScale()};
      node.setPointerCapture(event.pointerId);node.classList.add('is-dragging');
      node.focus({preventScroll:true});
    });
    node.addEventListener('pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;
      event.preventDefault();event.stopPropagation();
      move(event.clientX-drag.x,event.clientY-drag.y);
      drag.x=event.clientX;drag.y=event.clientY;
    });
    const stop=event=>{
      if(!drag||event.pointerId!==drag.id)return;
      event.stopPropagation();drag=null;node.classList.remove('is-dragging');
      if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);
    };
    for(const type of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(type,stop);
    node.addEventListener('dblclick',event=>{
      if(event.target.closest('button,a,input,select,textarea,summary'))return;
      event.stopPropagation();offsetX=offsetY=0;node.style.removeProperty('translate');
    });
    node.addEventListener('keydown',event=>{
      if(event.target!==node||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();const step=event.shiftKey?30:10;
      move(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0);
    });
    addEventListener('resize',()=>{if(node.isConnected&&node.checkVisibility())move(0,0);});
  };
  const set=(key,value)=>{if(layer.style.getPropertyValue(key)!==value)layer.style.setProperty(key,value);};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
  const sizes=new ResizeObserver(schedule);
  function sync(){
    frame=0;
    const enabled=compact.matches&&layer.classList.contains('is-mobile-map-shell')&&!document.body.classList.contains('novel-mode-detour');
    if(drawer.hidden===enabled)drawer.hidden=!enabled;layer.classList.toggle('has-compact-observation',enabled);
    for(const node of layer.querySelectorAll(selector)){
      if(!watched.has(node)){watched.add(node);sizes.observe(node);}
      if(enabled&&!homes.has(node)){
        const marker=document.createComment('observation panel home');node.before(marker);homes.set(node,marker);drawer.append(node);
      }
    }
    if(!enabled)for(const [node,marker]of homes){marker.replaceWith(node);homes.delete(node);}
    const mode=layer.querySelector('#japan-mode-number')?.textContent;
    if(lastMode!==mode){drawer.open=false;lastMode=mode;}
    const t=globalThis.GaiaI18n?.t?.('観測データ')||'観測データ';if(summary.textContent!==t)summary.textContent=t;
    const panels=[...layer.querySelectorAll(selector+',.map-command-dock')].filter(n=>!n.hidden&&n.checkVisibility({visibilityProperty:true})&&n.getBoundingClientRect().height>0);
    const bottom=enabled?drawer.getBoundingClientRect().top:Math.min(innerHeight,...panels.map(n=>n.getBoundingClientRect().top));
    set('--responsive-dock-top',`${Math.max(0,bottom)}px`);
    const annotations=[...layer.querySelectorAll('.gaia-cod-annotations,.gaia-food-status,.gaia-food-count')].filter(n=>n.checkVisibility()&&n.getBoundingClientRect().height>0);
    for(const node of annotations)if(!watched.has(node)){watched.add(node);sizes.observe(node);}
    const creditEdge=Math.min(bottom,...annotations.map(n=>n.getBoundingClientRect().top));
    set('--responsive-credit-bottom',`${Math.max(0,innerHeight-creditEdge+8)}px`);
    const heading=layer.querySelector('.japan-heading')?.getBoundingClientRect();
    const navigation=layer.querySelector('#map-stable-navigation');
    for(const node of [layer.querySelector('.japan-heading'),navigation,layer.querySelector('.signal-encoding-legend-dock')])if(node&&!watched.has(node)){watched.add(node);sizes.observe(node);}
    const legendTop=Math.max(heading?.bottom||0,navigation?.getBoundingClientRect().bottom||0)+18;
    set('--responsive-legend-top',`${legendTop}px`);
    set('--responsive-zoom-top',`${Math.max(180,(heading?.bottom||168)+12)}px`);
    const legend=layer.querySelector('.signal-encoding-legend-dock');
    const ecology=layer.querySelector('.ecologies-exhibit');
    const ecologyVisible=innerWidth>900&&ecology?.checkVisibility()&&!ecology.hidden;
    layer.classList.toggle('has-ecology-legend-lane',Boolean(ecologyVisible));
    if(ecologyVisible&&legend)set('--ecology-legend-right',`${innerWidth-ecology.getBoundingClientRect().left+16}px`);
    set('--responsive-metric-top',`${legend?.checkVisibility()?legend.getBoundingClientRect().bottom+8:legendTop}px`);
    const legends=[...layer.querySelectorAll('.signal-encoding-legend-dock,.gaia-estat-heat-legend,.gaia-live-metric-legend,.gaia-food-legend,.gaia-marine-cod-legend,.gaia-firms-legend,.gaia-planet-signals-legend')].filter(n=>n.checkVisibility());
    for(const node of legends){makeLegendDraggable(node);if(!watched.has(node)){watched.add(node);sizes.observe(node);}}
    set('--responsive-map-note-top',`${Math.max(legendTop,...legends.map(n=>n.getBoundingClientRect().bottom))+12}px`);
  }
  drawer.addEventListener('toggle',schedule);compact.addEventListener('change',schedule);addEventListener('resize',schedule);
  addEventListener('gaia:language-change',schedule);
  new MutationObserver(schedule).observe(layer,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
  schedule();
})();
