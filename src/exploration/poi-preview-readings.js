// Highlight explicit measurements, never digits guessed from years, IDs or labels.
const numericText = /^[<>≤≥]?\s*[+−-]?(?:\d+(?:,\d{3})*)(?:\.\d+)?(?:e[+−-]?\d+)?$/i;
export const renderPoiPreviewTitle = (node, title, originalSourceName = false) => {
  const text = String(title || '');
  const coordinates = text.match(/^((?:震源\s*)?(?:北緯|南緯|緯度)\s*[+−-]?\d+(?:\.\d+)?°)\s*[・/·]?\s*((?:東経|西経|経度)\s*[+−-]?\d+(?:\.\d+)?°)$/u);
  // 地域／地点は意味の切れ目で分け、地名の途中では折り返さない。
  const lines = coordinates ? coordinates.slice(1) : text.split(/\s*[／/]\s*/u);
  node.replaceChildren(...lines.map(value => {
    const line = node.ownerDocument.createElement('span');
    line.className = 'poi-preview-title-line'; line.textContent = value;
    if (originalSourceName) { line.translate = false; line.lang = 'ja'; line.dataset.sourceName = value; }
    return line;
  }));
  if (originalSourceName) node.title = '原資料に記載された地点名'; else node.removeAttribute('title');
};
export const renderPoiPreviewReadings = (node, preview, fallback) => {
  const readings = preview?.readings?.filter(r => r && r.value !== undefined) || [];
  const hasNumbers = readings.some(r => numericText.test(String(r.value)));
  node.classList.toggle('has-poi-readings', hasNumbers);
  node.classList.toggle('has-single-reading', hasNumbers && readings.length === 1);
  if (!hasNumbers) { node.textContent = fallback || ''; return; }
  const element = (className, text = '', tag = 'span') => {
    const item = node.ownerDocument.createElement(tag); item.className = className; item.textContent = text; return item;
  };
  const context = element('poi-preview-context', preview.context || '');
  const grid = element('poi-preview-readings');
  grid.style.setProperty('--reading-columns', Math.min(2, readings.length));
  grid.style.setProperty('--reading-maximum', readings.length === 1 ? '64px' : '42px');
  for (const reading of readings) {
    const value = reading.value === null ? '記録なし' : String(reading.value);
    const numeric = numericText.test(value), item = element('poi-preview-reading');
    const line = element('poi-preview-reading-line');
    const number = element(numeric ? 'poi-preview-number' : 'poi-preview-missing', value, 'b');
    // A conservative width budget keeps long grouped/negative values intact.
    const columns = [...value].reduce((n, c) => n + (/[.,]/.test(c) ? .32 : .62), 0);
    number.style.setProperty('--reading-number-width', Math.max(1, columns));
    number.style.setProperty('--reading-unit-room', `${Math.min(90, (reading.unit?.length || 0) * 8 + 8)}px`);
    const unit = element('poi-preview-unit', reading.unit || '');
    if (reading.prefix) line.append(unit, number); else line.append(number, unit);
    const labels = element('poi-preview-reading-labels');
    if (readings.length === 1) labels.append(context);
    labels.append(element('poi-preview-reading-label', reading.label || ''));
    item.append(labels, line);grid.append(item);
  }
  node.replaceChildren(...(readings.length === 1 ? [grid] : [context, grid]));
};
