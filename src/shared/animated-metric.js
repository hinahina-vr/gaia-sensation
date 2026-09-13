// Presentation only: match exhibit 22's 760 ms / 32-step easing.
// Repeated renders do not restart a count; interrupted counts continue from
// the currently displayed value. Missing/qualified readings settle immediately.
const states = new WeakMap();
export function animateMetricText(element, text, key = '') {
  if (!element) return;
  text = String(text);
  const previous = states.get(element);
  if (previous?.text === text && previous.key === key && (previous.frame || element.textContent === text)) return;
  if (previous) cancelAnimationFrame(previous.frame);
  const tokens = [...text.matchAll(/[+-]?\d[\d,]*(?:\.\d+)?/g)].filter(match =>
    !/[A-Za-z\d]/.test(text[match.index - 1] || '') &&
    !/^(?:年|月|日|時|分|秒|年度|:|\/\d)/.test(text.slice(match.index + match[0].length)));
  const target = tokens.map(match => Number(match[0].replaceAll(',', '')));
  const from = target.map((_, i) => previous?.key === key && previous.current.length === target.length ? previous.current[i] : 0);
  const state = {text, key, current: from, frame: 0}; states.set(element, state);
  element.dataset.metricTarget = text;
  const finish = () => { element.textContent = text; state.current = target; state.frame = 0; element.dataset.metricCounting = 'false'; };
  if (!tokens.length || /[<>≤≥＜＞]|未満|以下|以上|欠測|記録なし|算出・数値なし/.test(text) || matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
  const started = performance.now();
  element.dataset.metricCounting = 'true';
  const tick = now => {
    if (!element.isConnected || states.get(element) !== state) return;
    const p = Math.min(1, (now - started) / 760);
    const eased = p === 1 ? 1 : Math.floor((1 - (1-p)**3) * 32) / 32;
    state.current = target.map((value,i) => from[i] + (value-from[i])*eased);
    let cursor = 0, result = '';
    tokens.forEach((token,i) => {
      const decimals = token[0].split('.')[1]?.length || 0;
      result += text.slice(cursor,token.index) + (token[0][0] === '+' && state.current[i]>0 ? '+' : '') + state.current[i].toLocaleString('ja-JP',{minimumFractionDigits:decimals,maximumFractionDigits:decimals,useGrouping:token[0].includes(',')});
      cursor = token.index + token[0].length;
    });
    element.textContent = result + text.slice(cursor);
    if (p === 1) finish(); else state.frame = requestAnimationFrame(tick);
  };
  state.frame = requestAnimationFrame(tick);
}
