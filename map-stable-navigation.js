(() => {
  'use strict';
  const layer=document.querySelector('#japan-layer'),bank=layer?.querySelector('.map-mode-bank');
  if(!layer||!bank||globalThis.GaiaMapStableNavigation)return;
  const catalog=()=>globalThis.GaiaMapCategories?.buttons()||[];
  const desktop=matchMedia('(min-width: 901px)');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const contextAnimations=new Set();
  const stopContextAnimations=()=>{for(const animation of contextAnimations)animation.cancel();contextAnimations.clear();};
  const animateContext=(node,frames,options)=>{
    const animation=node.animate(frames,options);contextAnimations.add(animation);
    const cleanup=()=>contextAnimations.delete(animation);
    animation.addEventListener('finish',cleanup,{once:true});
    animation.addEventListener('cancel',cleanup,{once:true});
  };
  const bindContextMotion=details=>{
    details.addEventListener('toggle',()=>{
      // Native details retains keyboard/touch semantics and immediate closure.
      // Cancel stale motion before replaying, including rapid close/reopen.
      stopContextAnimations();
      if(!details.open||reducedMotion.matches||document.hidden)return;
      const summary=details.querySelector(':scope > summary');
      animateContext(summary,[
        {transform:'scale(1)',boxShadow:'0 0 0 0 #83f4dd00'},
        {transform:'scale(.92) rotate(-2deg)',boxShadow:'0 0 0 3px #83f4dd55',offset:.18},
        {transform:'scale(1.07) rotate(1deg)',boxShadow:'0 0 0 9px #83f4dd22',offset:.48},
        {transform:'scale(1)',boxShadow:'0 0 0 14px #83f4dd00'},
      ],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)'});
      [...details.children].filter(child=>child!==summary).forEach((child,index)=>{
        animateContext(child,[
          {opacity:0,transform:'translateY(14px) scale(.97)',transformOrigin:'right bottom'},
          {opacity:1,transform:'translateY(-3px) scale(1.008)',transformOrigin:'right bottom',offset:.7},
          {opacity:1,transform:'translateY(0) scale(1)',transformOrigin:'right bottom'},
        ],{duration:620,delay:Math.min(index,3)*70,easing:'cubic-bezier(.16,.84,.24,1)',fill:'backwards'});
      });
    });
  };
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stopContextAnimations();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopContextAnimations();});
  const translate=(source,values)=>globalThis.GaiaI18n?.t(source,values)||source;
  const navigation=document.createElement('nav');navigation.id='map-stable-navigation';navigation.hidden=true;
  navigation.setAttribute('aria-label','展示を前後にめくる');layer.append(navigation);
  let requested=null;
  const enabled=()=>!layer.hidden&&layer.getAttribute('aria-hidden')==='false'
    &&!layer.dataset.storyMode&&!document.body.classList.contains('novel-mode-detour');
  const available=()=>enabled()&&!layer.classList.contains('japan-data-open')&&!document.body.classList.contains('gaia-statistics-open');
  const currentIndex=buttons=>{
    const pending=buttons.findIndex(button=>Number(button.textContent.trim())===requested);
    return pending>=0?pending:buttons.findIndex(button=>button.getAttribute('aria-current')==='true');
  };
  const make=(direction,label)=>{
    const button=document.createElement('button');button.type='button';button.dataset.mapStableStep=String(direction);
    button.setAttribute('aria-controls','japan-title');button.setAttribute('aria-label',label);
    button.innerHTML=direction>0?`<span class="map-nav-label">${label}</span><span class="map-nav-arrow" aria-hidden="true">▶</span>`:`<span class="map-nav-arrow" aria-hidden="true">◀</span><span class="map-nav-label">${label}</span>`;
    // These controls live outside the animated/replaced observation panels.
    // The very same native hit target and keyboard focus survive every turn.
    button.addEventListener('pointerdown',event=>event.stopPropagation());
    button.addEventListener('click',event=>{
      event.stopPropagation();if(!available())return;
      const buttons=catalog(),index=currentIndex(buttons);if(index<0||buttons.length<2)return;
      globalThis.GaiaMapDemo?.stop?.('interaction');
      globalThis.GaiaMapCruise?.stop?.();
      globalThis.GaiaMapPicker?.close?.();
      buttons[(index+direction+buttons.length)%buttons.length].click();
    });
    navigation.append(button);return button;
  };
  const previous=make(-1,'前の展示へ'),next=make(1,'次の展示へ');
  const menu=document.createElement('button');menu.type='button';menu.dataset.mapMenuToggle='';
  menu.innerHTML='<span class="map-nav-menu-count"></span><span class="map-nav-label">展示メニュー</span>';
  navigation.insertBefore(menu,next);
  menu.addEventListener('pointerdown',event=>event.stopPropagation());
  const showMenu=()=>{
    if(!available()||menu.disabled)return;
    globalThis.GaiaMapDemo?.stop?.('interaction');
    globalThis.GaiaMapCruise?.stop?.();
    globalThis.GaiaMapPicker?.open?.(menu);
  };
  menu.addEventListener('pointerenter',event=>{
    if(desktop.matches&&event.pointerType!=='touch')showMenu();
  });
  menu.addEventListener('focus',()=>{if(desktop.matches)showMenu();});
  menu.addEventListener('keydown',event=>{
    if(!desktop.matches||!['ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();showMenu();
    layer.querySelector('#map-dock-bank-popover [role="tab"][aria-selected="true"]')?.focus({preventScroll:true});
  });
  menu.addEventListener('click',event=>{
    event.stopPropagation();if(!available())return;
    globalThis.GaiaMapCruise?.stop?.();
    // Focus already opened it. A following click must not close it again.
    if(desktop.matches)globalThis.GaiaMapPicker?.open?.(menu);
    else globalThis.GaiaMobileMap?.openExhibits?.(menu);
  });
  // Navigation belongs to the viewport, never to a provider's moving dock.
  const sync=()=>{
    const active=enabled(),buttons=catalog(),index=currentIndex(buttons);
    // Keep the full source explanation available without adding a variable
    // height row above the annual-data dock.
    for(const copy of layer.querySelectorAll('.gaia-estat-readout > .gaia-estat-copy')){
      const details=document.createElement('details');details.className='map-dock-context';
      const summary=document.createElement('summary');summary.textContent=translate('解説');
      copy.before(details);details.append(summary,copy);
      const comparison=details.parentElement.querySelector(':scope > .gaia-estat-comparison');
      if(comparison)details.append(comparison);
      bindContextMotion(details);
    }
    for(const summary of layer.querySelectorAll('.map-dock-context > summary')){
      const label=translate('解説');if(summary.textContent!==label)summary.textContent=label;
    }
    navigation.setAttribute('aria-label',translate('展示を前後にめくる'));
    for(const [button,source] of [[previous,'前の展示へ'],[next,'次の展示へ'],[menu,'展示メニュー']]){
      const label=button.querySelector('.map-nav-label'),value=translate(source);
      if(label.textContent!==value)label.textContent=value;
    }
    layer.classList.toggle('has-map-stable-navigation',active);
    navigation.hidden=!available();previous.disabled=next.disabled=index<0||buttons.length<2;
    menu.disabled=buttons.length<2||!(desktop.matches?globalThis.GaiaMapPicker:globalThis.GaiaMobileMap);
    const count=menu.querySelector('.map-nav-menu-count'),countText=globalThis.GaiaI18n?translate('全{count}展示',{count:buttons.length}):`全${buttons.length}展示`;
    if(count.textContent!==countText)count.textContent=countText;
    menu.setAttribute('aria-controls',desktop.matches?'map-dock-bank-popover':'map-mobile-sheet');
    menu.setAttribute('aria-haspopup',desktop.matches?'true':'dialog');
    const menuOpen=desktop.matches?bank.classList.contains('is-dock-bank-expanded'):Boolean(layer.querySelector('#map-mobile-sheet[open][data-panel="exhibits"]'));
    menu.setAttribute('aria-expanded',String(menuOpen));
    navigation.classList.toggle('is-menu-open',menuOpen);
    navigation.classList.toggle('is-motion-paused',document.hidden||Boolean(globalThis.GaiaModeEntryGuide?.getState?.().active)||Boolean(layer.querySelector('#map-mobile-sheet[open]')));
    if(index>=0){
      previous.setAttribute('aria-label',translate('前の展示へ：{number}',{number:buttons[(index-1+buttons.length)%buttons.length].textContent.trim()}));
      next.setAttribute('aria-label',translate('次の展示へ：{number}',{number:buttons[(index+1)%buttons.length].textContent.trim()}));
    }
  };
  // Record a requested chapter before async provider loading finishes. Rapid
  // clicks must advance from the last request, not repeat the last loaded page.
  bank.addEventListener('click',event=>{
    const button=event.target instanceof Element?event.target.closest('.map-mode-button'):null;
    if(!button||button.disabled)return;
    const number=Number(button.textContent.trim());if(!Number.isFinite(number))return;
    requested=number;sync();
  },{capture:true});
  new MutationObserver(sync).observe(bank,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-current','class']});
  new MutationObserver(sync).observe(layer,{attributes:true,attributeFilter:['hidden','aria-hidden','data-story-mode']});
  const sheet=layer.querySelector('#map-mobile-sheet');
  if(sheet)new MutationObserver(sync).observe(sheet,{attributes:true,attributeFilter:['open']});
  let stateKey='';
  const watchState=()=>{
    const key=[layer.classList.contains('japan-data-open'),document.body.classList.contains('gaia-statistics-open'),document.body.classList.contains('novel-mode-detour')].join('|');
    if(key!==stateKey){stateKey=key;sync();}
  };
  new MutationObserver(watchState).observe(layer,{attributes:true,attributeFilter:['class']});
  new MutationObserver(watchState).observe(document.body,{attributes:true,attributeFilter:['class']});
  desktop.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  for(const event of ['gaia:mode-guide-open','gaia:mode-guide-close'])addEventListener(event,sync);
  for(const event of ['gaia:app-ready','gaia:japan-open','gaia:japan-close'])addEventListener(event,sync);
  addEventListener('gaia:language-change',sync);
  globalThis.GaiaMapStableNavigation=Object.freeze({getState:()=>({active:enabled(),visible:!navigation.hidden,requested})});
  sync();
})();
