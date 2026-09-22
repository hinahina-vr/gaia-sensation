(() => {
  'use strict';

  const MEASUREMENT_ID = 'G-GY90YZSS4D';
  const LEGACY_CONSENT_KEY = 'gaia-analytics-consent-v1';
  const CHOICE_KEY = 'gaia-analytics-choice-v2';
  const CHOICE_MAX_AGE_MS = 180 * 86400000;
  const REGION_TIMEOUT_MS = 4000;
  const DISABLE_PROPERTY = 'ga-disable-' + MEASUREMENT_ID;
  const PAGE_NAMES = new Set(['top', 'earth', 'japan', 'world', 'character', 'sound', 'story', 'source', 'data']);
  const ACTIONS = [
    ['[data-intro-path="map"],#gaia-opening-route-other', 'exploration_start'],
    ['#gaia-opening-route-story,[data-intro-path="novel"]', 'story_start'],
    ['.gaia-map-action--analysis,#gaia-statistics-button', 'analysis_open'],
  ];
  // Never send development, preview-branch or file:// traffic.
  const production = location.protocol === 'https:' && location.hostname === 'gaia-senseware.pages.dev';
  const state = {
    enabled: false,
    regionReady: false,
    japan: false,
    loaded: false,
    lastPage: '',
    legacyConsent: readStorage(LEGACY_CONSENT_KEY),
    choice: readChoice(),
  };
  let consentUI;

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function readChoice() {
    try {
      const choice = JSON.parse(readStorage(CHOICE_KEY));
      const now = Date.now();
      if (choice && ['granted', 'denied'].includes(choice.value) && choice.at <= now && now - choice.at < CHOICE_MAX_AGE_MS) {
        return choice.value;
      }
    } catch {}
    return null;
  }

  function hasPrivacySignal() {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  }

  function isOptedOut() {
    return state.choice === 'denied'
      || (state.choice !== 'granted' && state.legacyConsent === 'denied')
      || hasPrivacySignal();
  }

  function queueTag() {
    (window.dataLayer ||= []).push(arguments);
  }

  function currentPage() {
    if (location.pathname.startsWith('/concept')) return '/concept/';
    const hash = location.hash.slice(1);
    if (/^(world|japan)-\d{2}$/.test(hash)) return '/exhibit/' + hash;
    return '/' + (PAGE_NAMES.has(hash) ? hash : 'opening');
  }

  function trackPageView() {
    if (!state.enabled) return;
    const path = currentPage();
    if (path === state.lastPage) return;
    state.lastPage = path;
    const url = location.origin + path;
    queueTag('set', { page_location: url, page_title: path });
    queueTag('event', 'page_view', {
      page_location: url,
      page_title: path,
      page_referrer: '',
      navigation_mode: window.GaiaMapCruise?.getState().active ? 'cruise' : 'manual',
    });
  }

  function startMeasurement() {
    window[DISABLE_PROPERTY] = false;
    if (!state.loaded) {
      state.loaded = true;
      window.gtag = queueTag;
      queueTag('consent', 'default', {
        analytics_storage: 'denied', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied',
      });
      queueTag('consent', 'update', { analytics_storage: 'granted' });
      queueTag('js', new Date());
      queueTag('config', MEASUREMENT_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: location.origin + currentPage(),
        page_referrer: '',
      });
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
      document.head.append(script);
    } else {
      queueTag('consent', 'update', { analytics_storage: 'granted' });
    }
    trackPageView();
  }

  function clearAnalyticsCookies() {
    const domains = ['', '; Domain=' + location.hostname, '; Domain=.' + location.hostname];
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of domains) document.cookie = name + '=; Max-Age=0; Path=/' + domain;
    }
  }

  function stopMeasurement() {
    if (state.loaded) queueTag('consent', 'update', { analytics_storage: 'denied' });
    state.lastPage = '';
    clearAnalyticsCookies();
  }

  function saveChoice(value) {
    state.choice = value;
    try { localStorage.setItem(CHOICE_KEY, JSON.stringify({ value, at: Date.now() })); } catch {}
    consentUI.dialog.close();
    syncConsent();
    consentUI.settings.focus({ preventScroll: true });
  }

  function createConsentUI() {
    // Overseas consent is always English, regardless of browser language.
    const dialog = document.createElement('dialog');
    dialog.id = 'gaia-analytics-consent';
    dialog.lang = 'en';
    dialog.setAttribute('aria-labelledby', 'gaia-analytics-title');
    dialog.innerHTML = `<h2 id="gaia-analytics-title">Analytics preferences</h2>
      <p>May we use Google Analytics to send page views, interactions and cookie identifiers to Google to improve this work? No advertising. All features work without consent, and you can withdraw it at any time.</p>
      <a href="https://policies.google.com/technologies/partner-sites?hl=en" target="_blank" rel="noopener noreferrer">How Google uses data</a>
      <p data-ga-signal hidden>Analytics is blocked by your browser privacy preference.</p>
      <div class="gaia-analytics-actions"><button type="button" data-ga-reject>Reject</button><button type="button" data-ga-accept>Accept</button></div>`;
    const settings = document.createElement('button');
    settings.id = 'gaia-analytics-settings';
    settings.type = 'button';
    settings.lang = 'en';
    settings.textContent = 'Analytics settings';
    settings.addEventListener('click', () => dialog.showModal());
    const accept = dialog.querySelector('[data-ga-accept]');
    const signal = dialog.querySelector('[data-ga-signal]');
    dialog.querySelector('[data-ga-reject]').addEventListener('click', () => saveChoice('denied'));
    accept.addEventListener('click', () => saveChoice('granted'));
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      saveChoice('denied');
    });
    document.body.append(dialog, settings);
    return { dialog, settings, accept, signal };
  }

  function syncConsentUI() {
    if (!production || !state.regionReady || state.japan) return;
    consentUI ||= createConsentUI();
    const privacySignal = hasPrivacySignal();
    consentUI.accept.disabled = privacySignal;
    consentUI.signal.hidden = !privacySignal;
    if (!state.choice && state.legacyConsent !== 'denied' && !privacySignal && !consentUI.dialog.open) {
      consentUI.dialog.showModal();
    }
  }

  function syncConsent() {
    state.enabled = production && state.regionReady && (state.japan || state.choice === 'granted') && !isOptedOut();
    window[DISABLE_PROPERTY] = !state.enabled;
    if (state.enabled) startMeasurement();
    else stopMeasurement();
    syncConsentUI();
  }

  function handleStorageChange(event) {
    if (event.key === LEGACY_CONSENT_KEY) state.legacyConsent = event.newValue;
    else if (event.key === CHOICE_KEY) state.choice = readChoice();
    else if (event.key === null) {
      state.legacyConsent = null;
      state.choice = null;
    } else return;
    if (consentUI?.dialog.open) consentUI.dialog.close();
    syncConsent();
  }

  function resolveRegion() {
    if (!production) return;
    // Use only the country code; do not retain or forward the trace body/IP.
    fetch('/cdn-cgi/trace', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(REGION_TIMEOUT_MS) })
      .then(response => response.ok ? response.text() : '')
      .then(body => { state.japan = /^loc=JP\r?$/m.test(body); })
      .catch(() => { state.japan = false; })
      .finally(() => { state.regionReady = true; syncConsent(); });
  }

  function observeNavigation() {
    let scheduled = false;
    const schedulePageView = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; trackPageView(); });
    };
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        schedulePageView();
        return result;
      };
    }
    addEventListener('hashchange', schedulePageView);
    addEventListener('popstate', schedulePageView);
  }

  function trackAction(event) {
    if (!state.enabled || !event.isTrusted) return;
    const element = event.target.closest('button, a');
    if (!element) return;
    const action = ACTIONS.find(([selector]) => element.matches(selector));
    if (action) queueTag('event', action[1], { screen_name: currentPage() });
  }

  addEventListener('storage', handleStorageChange);
  syncConsent();
  resolveRegion();
  observeNavigation();
  document.addEventListener('click', trackAction, true);
})();
