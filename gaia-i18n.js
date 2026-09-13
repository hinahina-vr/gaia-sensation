/** 概要: 日本語・英語・中国語の切替。選択言語を保存し、翻訳辞書を使って画面の文言を更新する。 */
(() => {
  'use strict';
  const storageKey = 'gaia:language:v1';
  const supported = new Set(['ja', 'en', 'zh-CN']);
  const catalogs = new Map();
  const templates = new Map();
  let templateList = [];
  const translationCache = new Map();
  const bindings = new WeakMap();
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const views = new WeakMap();
  const structuralFields = new Set(['id', 'type', 'speaker', 'visualSpeaker', 'recordType', 'next', 'target', 'kind', 'key', 'value', 'mode', 'src', 'image', 'url', 'htmlLang', 'storyVersion', 'schemaVersion']);
  // Translate presentation only. Never touch image assets, IDs, numeric route
  // nodes, form values, user text, scripts or the story's per-glyph animation.
  const excluded = 'script,style,noscript,pre,code,textarea,input,[contenteditable], [translate="no"], [data-gaia-language],#novel-text,.true-end-message';
  const attributes = ['aria-label', 'aria-description', 'title', 'placeholder', 'data-label', 'data-description', 'data-map-symbol', 'data-map-detail'];
  const normalize = value => supported.has(value) ? value : 'ja';
  let language = 'ja';
  try { language = normalize(localStorage.getItem(storageKey)); } catch { /* Private browsing. */ }

  const translateSource = (source, depth = 0) => {
    if (language === 'ja') return source;
    if (catalogs.has(source)) return catalogs.get(source)[language];
    if (depth === 0 && translationCache.has(source)) return translationCache.get(source);
    let translated = source;
    if (depth < 6) for (const [key, template] of templateList) {
      const match = template.pattern.exec(source);
      if (!match) continue;
      const values = Object.fromEntries(template.keys.map((name, index) => [name, translateSource(match[index + 1], depth + 1)]));
      // A field template is not a sentence translator. In particular, unknown
      // prose must never be reordered into a mixture of Japanese and English.
      const untranslated = language === 'en' ? /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u : /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
      if (Object.values(values).some(value => untranslated.test(value))) continue;
      translated = catalogs.get(key)[language].replace(/\{(\w+)\}/g, (part, name) => values[name] ?? part);
      break;
    }
    // Only combine complete translated fields at existing UI separators; never
    // replace words inside a sentence or mutate the underlying record.
    if (translated === source && depth < 6 && /(?:\s+[\/｜|·・]\s+|\n\s*\n)/u.test(source)) {
      translated = source.split(/(\s+[\/｜|·・]\s+|\n\s*\n)/u).map((part, index) => index % 2 ? part : translateSource(part, depth + 1)).join('');
    }
    if (translationCache.size > 6000) translationCache.clear();
    if (depth === 0) translationCache.set(source, translated);
    return translated;
  };
  const t = (source, values = {}) => {
    if (typeof source !== 'string') return source;
    const translated = translateSource(source);
    return translated.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
  };
  const translatedText = source => {
    const key = source.trim();
    return source.replace(key, t(key));
  };
  const translateNode = node => {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    // Explicit bindings own their parameters, including participant-provided names.
    // Do not run a second template translation over their rendered output.
    if (bindings.get(node.parentElement)?.has(null)) return;
    const previous = originalText.get(node);
    const source = previous && node.data === previous.translated ? previous.source : node.data;
    const translated = translatedText(source);
    if (source === translated && !previous) return;
    originalText.set(node, { source, translated });
    if (node.data !== translated) node.data = translated;
  };
  const translateAttributes = element => {
    if (element.closest('script,style,noscript,pre,code,[translate="no"],[contenteditable],[data-gaia-language],#novel-text,.true-end-message')) return;
    let saved = originalAttributes.get(element);
    for (const attribute of attributes) {
      if (!element.hasAttribute(attribute)) continue;
      if (bindings.get(element)?.has(attribute)) continue;
      const current = element.getAttribute(attribute), previous = saved?.get(attribute);
      const source = previous && current === previous.translated ? previous.source : current;
      const translated = language !== 'ja' && attribute === 'data-map-symbol' && source === '再生'
        ? t('再資源化') : translatedText(source);
      if (source === translated && !previous) continue;
      if (!saved) originalAttributes.set(element, saved = new Map());
      saved.set(attribute, { source, translated });
      if (current !== translated) element.setAttribute(attribute, translated);
    }
  };
  const translate = root => {
    if (root.nodeType === Node.TEXT_NODE) { translateNode(root); return; }
    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.nodeType === Node.ELEMENT_NODE && node.matches(excluded) && !node.matches('input,textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) translateNode(node);
      else translateAttributes(node);
    }
  };
  // Read-only translated views keep approved story files and saved step IDs
  // intact, while giving the typewriter complete translated sentences up front.
  const view = source => {
    if (typeof source === 'string') return t(source);
    if (!source || typeof source !== 'object') return source;
    if (views.has(source)) return views.get(source);
    const result = Array.isArray(source) ? [] : {};
    views.set(source, result);
    for (const key of Object.keys(source)) Object.defineProperty(result, key, {
      enumerable: true, configurable: false, get: () => {
        if (structuralFields.has(key) || /(?:Id|Ids|Key|Keys|Type)$/u.test(key)) return source[key];
        if (key === 'pages' && source.text && language !== 'ja' && catalogs.has(source.text)) return [t(source.text)];
        return view(source[key]);
      },
    });
    return result;
  };
  const render = element => {
    for (const [attribute, binding] of bindings.get(element) || []) {
      const value = t(binding.source, binding.values);
      if (attribute) {
        if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
      } else if (element.textContent !== value) element.textContent = value;
    }
  };
  const bind = (element, source, values = {}, attribute = null) => {
    if (!element) return;
    if (!bindings.has(element)) bindings.set(element, new Map());
    bindings.get(element).set(attribute, { source, values });
    element.dataset.gaiaLocalized = '';
    render(element);
  };
  const refresh = () => {
    document.documentElement.lang = language;
    document.documentElement.dataset.gaiaLanguageCurrent = language;
    document.querySelectorAll('[data-gaia-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.gaiaLanguage === language));
    });
    document.querySelectorAll('[data-gaia-localized]').forEach(render);
    translate(document.documentElement);
  };
  const set = (value, { persist = true, notify = true } = {}) => {
    const next = normalize(value);
    const changed = next !== language;
    language = next;
    translationCache.clear();
    if (persist) {
      try { localStorage.setItem(storageKey, language); } catch { /* Private browsing. */ }
    }
    refresh();
    if (notify && changed) dispatchEvent(new CustomEvent('gaia:language-change', { detail: { language } }));
    return language;
  };
  const register = entries => {
    for (const [source, en, zh] of entries) {
      catalogs.set(source, { en, 'zh-CN': zh });
      const keys = [...source.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
      if (keys.length && source.replace(/\{\w+\}/g, '').trim()) {
        const parts = source.split(/\{\w+\}/g).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = parts.map((part, index) => part + (index < keys.length
          ? /^(count|number|read|unread|year|day|month|hour)$/u.test(keys[index]) ? '([+−-]?\\d[\\d,.]*)' : '(.+?)'
          : '')).join('');
        templates.set(source, { keys, pattern: new RegExp(`^${pattern}$`, 'u') });
      }
    }
    templateList = [...templates].sort(([left], [right]) => right.replace(/\{\w+\}/g, '').length - left.replace(/\{\w+\}/g, '').length);
    translationCache.clear();
    refresh();
  };
  const registerStory = (story, entries) => {
    const steps = new Map(story.scenes.flatMap(scene => scene.steps).map(step => [step.id, step]));
    register(entries.map(([id, en, zh]) => {
      const source = steps.get(id)?.text;
      if (typeof source !== 'string') throw new Error(`Missing translation source: ${id}`);
      return [source, en, zh];
    }));
  };
  globalThis.GaiaI18n = Object.freeze({ t, bind, register, registerStory, translate, view, get: () => language, set });
  globalThis.GaiaLanguagePreference = Object.freeze({ get: () => language, set });
  addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) {
      let saved = null;
      try { saved = localStorage.getItem(storageKey); } catch { /* Private browsing. */ }
      set(saved, { persist: false });
    }
  });
  refresh();
  new MutationObserver(records => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'characterData') roots.add(record.target);
      else if (record.type === 'attributes') translateAttributes(record.target);
      else for (const node of record.addedNodes) roots.add(node);
    }
    for (const root of roots) if (root.isConnected) translate(root);
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
})();
