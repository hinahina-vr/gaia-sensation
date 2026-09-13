(() => {
  'use strict';
  const contexts = new WeakMap();
  let language = GaiaI18n.get();
  let font = getComputedStyle(document.documentElement).getPropertyValue('--font-ja').trim();
  addEventListener('gaia:language-change', () => {
    language = GaiaI18n.get();
    font = getComputedStyle(document.documentElement).getPropertyValue('--font-ja').trim();
  });
  // Opt-in for exhibition/plot UI canvases only. Native prototypes, image
  // assets, WebGL rendering, numeric records, and hit-test canvases are intact.
  const context = native => {
    if (!native) return native;
    if (contexts.has(native)) return contexts.get(native);
    const methods = new Map();
    const localized = new Proxy(native, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (typeof value !== 'function') return value;
        if (!methods.has(key)) methods.set(key,
          ['fillText', 'strokeText', 'measureText'].includes(key)
            ? (text, ...args) => value.call(target, GaiaI18n.t(text), ...args)
            : value.bind(target));
        return methods.get(key);
      },
      set(target, key, value) {
        if (key === 'font' && language === 'zh-CN' && font && !/monospace|Consolas|Courier/i.test(value)) {
          value = value.replace(/^(.+?\b(?:px|pt|em|rem)(?:\/[^\s]+)?\s+).+$/i, `$1${font}`);
        }
        return Reflect.set(target, key, value, target);
      },
    });
    contexts.set(native, localized);
    return localized;
  };
  globalThis.GaiaI18nCanvas = Object.freeze({ context });
})();
