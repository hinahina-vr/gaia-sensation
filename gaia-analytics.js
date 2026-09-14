(() => {
  'use strict';
  const id = 'G-GY90YZSS4D', key = 'gaia-analytics-consent-v1';
  // Never send development, preview-branch or file:// traffic.
  const production = location.protocol === 'https:' && location.hostname === 'gaia-senseware.pages.dev';
  const choiceKey = 'gaia-analytics-choice-v2';
  let enabled = false, regionReady = false, japan = false, dialog, settings;
  let consent = null, loaded = false, lastPage = '';
  try { consent = localStorage.getItem(key); } catch {}
  const readChoice = () => {
    try {
      const value = JSON.parse(localStorage.getItem(choiceKey));
      if (value && ['granted','denied'].includes(value.value) && value.at <= Date.now() && Date.now()-value.at < 180*86400000) return value.value;
    } catch {}
    return null;
  };
  let choice = readChoice();
  function tag() { (window.dataLayer ||= []).push(arguments); }
  const page = () => {
    if (location.pathname.startsWith('/concept')) return '/concept/';
    const hash = location.hash.slice(1);
    if (/^(world|japan)-\d{2}$/.test(hash)) return '/exhibit/' + hash;
    return '/' + (['top','earth','japan','world','character','sound','story','source','data'].includes(hash) ? hash : 'opening');
  };
  const view = () => {
    if (!enabled) return;
    const path = page();
    if (path === lastPage) return;
    lastPage = path;
    const url = location.origin + path;
    tag('set', {page_location:url, page_title:path});
    tag('event','page_view',{page_location:url,page_title:path,page_referrer:'',
      navigation_mode: window.GaiaMapCruise?.getState().active ? 'cruise' : 'manual'});
  };
  const start = () => {
    window['ga-disable-' + id] = false;
    if (!loaded) {
      loaded = true;
      window.gtag = tag;
      tag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      tag('consent','update',{analytics_storage:'granted'});
      tag('js',new Date());
      tag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,
        page_location:location.origin+page(),page_referrer:''});
      const script=document.createElement('script');
      script.async=true; script.src='https://www.googletagmanager.com/gtag/js?id='+id;
      document.head.append(script);
    } else tag('consent','update',{analytics_storage:'granted'});
    view();
  };
  const privacySignal = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  const optedOut = () => choice === 'denied' || (choice !== 'granted' && consent === 'denied') || privacySignal();
  const mountConsent = () => {
    if (dialog) return;
    // Overseas consent is always English, regardless of browser language.
    const ja = false;
    dialog = document.createElement('dialog');
    dialog.id = 'gaia-analytics-consent';
    dialog.lang = 'en';
    dialog.setAttribute('aria-labelledby','gaia-analytics-title');
    dialog.innerHTML = `<h2 id="gaia-analytics-title">${ja?'アクセス解析について':'Analytics preferences'}</h2>
      <p>${ja?'作品の改善のため、Google Analyticsで閲覧画面・操作・Cookie識別子をGoogleへ送信してよいですか？広告には使用しません。同意しなくても全機能を利用でき、後から撤回できます。':'May we use Google Analytics to send page views, interactions and cookie identifiers to Google to improve this work? No advertising. All features work without consent, and you can withdraw it at any time.'}</p>
      <a href="https://policies.google.com/technologies/partner-sites?hl=${ja?'ja':'en'}" target="_blank" rel="noopener noreferrer">${ja?'Googleによるデータの利用':'How Google uses data'}</a>
      <p data-ga-signal hidden>${ja?'ブラウザのプライバシー設定により計測は停止中です。':'Analytics is blocked by your browser privacy preference.'}</p>
      <div class="gaia-analytics-actions"><button type="button" data-ga-reject>${ja?'同意しない':'Reject'}</button><button type="button" data-ga-accept>${ja?'同意する':'Accept'}</button></div>`;
    settings = document.createElement('button');
    settings.id = 'gaia-analytics-settings';
    settings.type = 'button';
    settings.lang = 'en';
    settings.textContent = ja?'解析設定':'Analytics settings';
    settings.addEventListener('click',()=>dialog.showModal());
    const choose = value => {
      choice = value;
      try { localStorage.setItem(choiceKey,JSON.stringify({value,at:Date.now()})); } catch {}
      dialog.close();
      sync();
      settings.focus({preventScroll:true});
    };
    dialog.querySelector('[data-ga-reject]').addEventListener('click',()=>choose('denied'));
    dialog.querySelector('[data-ga-accept]').addEventListener('click',()=>choose('granted'));
    dialog.addEventListener('cancel',event=>{event.preventDefault();choose('denied');});
    document.body.append(dialog,settings);
  };
  const sync = () => {
    enabled = production && regionReady && (japan || choice === 'granted') && !optedOut();
    window['ga-disable-'+id] = !enabled;
    if(enabled) start();
    else {
      if(loaded) tag('consent','update',{analytics_storage:'denied'});
      lastPage='';
      for(const cookie of document.cookie.split(';')) {
        const name=cookie.trim().split('=')[0];
        if(!/^_ga(?:_|$)/.test(name))continue;
        for(const domain of ['', '; Domain='+location.hostname, '; Domain=.'+location.hostname])
          document.cookie=name+'=; Max-Age=0; Path=/'+domain;
      }
    }
    if (production && regionReady && !japan) {
      mountConsent();
      dialog.querySelector('[data-ga-accept]').disabled = privacySignal();
      dialog.querySelector('[data-ga-signal]').hidden = !privacySignal();
      if (!choice && consent !== 'denied' && !privacySignal() && !dialog.open) dialog.showModal();
    }
  };
  // Respect preferences changed in another tab.
  addEventListener('storage', event => {
    if(event.key===key) consent=event.newValue;
    else if(event.key===choiceKey) choice=readChoice();
    else if(event.key===null) {consent=null;choice=null;}
    else return;
    if(dialog?.open)dialog.close();
    sync();
  });
  sync();
  if (production) {
    // Use only the country code; do not retain or forward the trace body/IP.
    fetch('/cdn-cgi/trace',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(4000)})
      .then(response=>response.ok?response.text():'')
      .then(body=>{japan=/^loc=JP\r?$/m.test(body);})
      .catch(()=>{japan=false;})
      .finally(()=>{regionReady=true;sync();});
  }
  let scheduled=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;view();});};
  for(const method of ['pushState','replaceState']) {
    const original=history[method];
    history[method]=function(...args){const result=original.apply(this,args);schedule();return result;};
  }
  addEventListener('hashchange',schedule);addEventListener('popstate',schedule);
  document.addEventListener('click',event=>{
    if(!enabled || !event.isTrusted)return;
    const element=event.target.closest('button, a');if(!element)return;
    const action=element.matches('[data-intro-path="map"],#gaia-opening-route-other')?'exploration_start'
      :element.matches('#gaia-opening-route-story,[data-intro-path="novel"]')?'story_start'
      :element.matches('.gaia-map-action--analysis,#gaia-statistics-button')?'analysis_open':null;
    if(action)tag('event',action,{screen_name:page()});
  },true);
})();
