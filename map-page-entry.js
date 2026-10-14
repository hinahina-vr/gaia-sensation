(() => {
  'use strict';
  if(document.documentElement.dataset.gaiaPage!=='world')return;
  if(!location.hash)history.replaceState(null,'',`${location.pathname}${location.search}#world`);
  let failed=false,timer=0;
  const titleUrl=()=>new URL('./',document.baseURI);
  const rememberTitle=()=>{try{sessionStorage.setItem('gaia:title-return-resume','1');}catch{}};
  document.addEventListener('click',event=>{
    const mapBack=event.target.closest?.('#japan-close');
    const titleBack=event.target.closest?.('#intro-title-return');
    if(!mapBack&&!titleBack)return;
    if(mapBack?.disabled)return;
    event.preventDefault();event.stopImmediatePropagation();
    const target=titleUrl();target.search=location.search;
    if(mapBack)target.hash='#top';else rememberTitle();
    location.assign(target.href);
  },true);
  const fail=()=>{
    if(failed)return;failed=true;clearTimeout(timer);
    const boot=document.querySelector('#gaia-boot'),status=document.querySelector('#gaia-boot-status');
    if(!boot)return;
    const english=document.documentElement.lang.startsWith('en');
    if(status)status.textContent=english?'The map could not start. Try again.':'地図を読み込めませんでした。もう一度お試しください。';
    const controls=document.createElement('div');controls.className='gaia-map-entry-recovery';
    const retry=document.createElement('button');retry.type='button';retry.textContent=english?'Try again':'再試行';retry.addEventListener('click',()=>location.reload());
    const back=document.createElement('a');back.href=titleUrl().href;back.textContent=english?'Back to title':'タイトルへ戻る';back.addEventListener('click',rememberTitle);
    controls.append(retry,back);boot.querySelector('.gaia-boot__shell').append(controls);
    document.documentElement.classList.add('gaia-booting');boot.hidden=false;boot.classList.remove('is-ready');boot.setAttribute('aria-hidden','false');retry.focus({preventScroll:true});
  };
  addEventListener('gaia:mode-group-error',event=>{if(event.detail?.name==='exploration')fail();});
  document.addEventListener('webglcontextlost',fail,true);
  addEventListener('DOMContentLoaded',()=>{
    const original=window.__gaiaBootCheck;
    window.__gaiaBootCheck=()=>{
      if(!failed&&document.documentElement.dataset.gaiaAppReady==='true')original?.();
    };
    const ready=()=>{
      if(document.documentElement.dataset.gaiaAppReady==='fallback'){fail();return;}
      if(document.documentElement.dataset.gaiaAppReady==='true'){
        clearTimeout(timer);
        if(failed){failed=false;document.querySelector('.gaia-map-entry-recovery')?.remove();original?.();}
      }
    };
    addEventListener('gaia:app-ready',ready);
    timer=setTimeout(()=>{if(document.documentElement.dataset.gaiaAppReady!=='true')fail();},20000);
    ready();
  },{once:true});
})();
