// This study rearranges the live lab, keeping its data, controls and event handlers.
const lab = document.querySelector('#gaia-statistics-lab');
if (lab && !lab.classList.contains('is-notebook-preview')) {
  lab.classList.add('is-notebook-preview');
  const stage = lab.querySelector('.gaia-statistics-stage');
  const visual = lab.querySelector('#gaia-statistics-visual');
  const context = lab.querySelector('#gaia-statistics-context');
  const canvas = lab.querySelector('#gaia-statistics-canvas');
  const card = document.createElement('section');
  card.className = 'notebook-chart-card';
  card.setAttribute('aria-label', '分析チャートと計算結果');
  visual.before(card);
  const heading = document.createElement('header');
  heading.className = 'notebook-chart-heading';
  const count = document.createElement('span');
  count.className = 'notebook-record-count';
  heading.append(context, count);
  const metrics = document.createElement('dl');
  metrics.className = 'notebook-metrics';
  card.append(heading, metrics, visual);

  const eyebrow = document.createElement('p');
  eyebrow.className = 'notebook-eyebrow';
  eyebrow.textContent = 'GAIA SENSEWARE / DATA SCIENCE LAB';
  lab.querySelector('#gaia-statistics-title').before(eyebrow);

  const questions = document.createElement('section');
  questions.className = 'notebook-questions';
  questions.setAttribute('aria-label', 'データから、もう一歩');
  questions.innerHTML = `<header><span aria-hidden="true">✧</span><div><h3>データから、もう一歩。</h3><p>気になることを、AIと一緒に考える。</p></div></header><div class="notebook-question-grid"></div>`;
  const choices = [
    {title:'なぜ変わった？', copy:'変化の背景を考える', icon:'water', question:'このデータに見られる変化には、どのような背景が考えられますか。観測値から分かることと、まだ確かめられない仮説を分けて説明してください。'},
    {title:'暮らしとのつながりは？', copy:'人と地球の未来を考える', icon:'leaf', question:'この分析結果は、人の暮らしと地球の共生を考えるうえで何を示していますか。データから読み取れる事実に基づき、考えられる選択肢を説明してください。'}
  ];
  for (const choice of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    const art = choice.icon === 'water'
      ? '<ellipse cx="33" cy="43" rx="28" ry="10"/><ellipse cx="33" cy="43" rx="18" ry="6"/><path d="M33 9c-3 7-9 13-9 19a9 9 0 0 0 18 0c0-6-6-12-9-19Z"/>'
      : '<path d="M33 49V25M33 37C17 39 12 26 13 18c15-2 23 7 20 19ZM33 30C30 15 41 9 51 8c2 14-5 22-18 22Z"/><ellipse cx="33" cy="51" rx="23" ry="4"/>';
    button.innerHTML = `<svg viewBox="0 0 66 62" aria-hidden="true">${art}</svg><span><strong>${choice.title}</strong><small>${choice.copy}</small></span><b aria-hidden="true">›</b>`;
    button.addEventListener('click', () => {
      lab.querySelector('#stat-view-ai').click();
      const field = lab.querySelector('textarea[name="question"]');
      if (field) {
        field.value = choice.question;
        field.dispatchEvent(new Event('input', {bubbles:true}));
        field.focus();
      }
    });
    questions.querySelector('.notebook-question-grid').append(button);
  }
  const column = document.createElement('div');
  column.className = 'notebook-chart-column';
  card.before(column);
  column.append(card, questions);
  const compact = matchMedia('(max-width:1000px)');
  const arrange = () => {
    const summary = lab.querySelector('#gaia-statistics-takeaway');
    if (compact.matches) {
      summary.after(card);card.after(questions);
    } else {
      summary.after(column);column.append(card,questions);
    }
  };
  compact.addEventListener('change',arrange);arrange();
  const tabArt = [
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m6 15 4-5 4 3 4-6"/>',
    '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z"/>',
    '<path d="M4 6h16M4 12h16M4 18h16"/>',
    '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 7h8M8 11h8M8 15h8M8 18h5"/>',
    '<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 6v1"/>',
    '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z"/>'
  ];
  lab.querySelectorAll('[data-stat-view]').forEach((tab,index) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    svg.innerHTML = tabArt[index];tab.prepend(svg);
  });
  const orbit = document.createElement('span');
  orbit.className = 'notebook-summary-orbit';orbit.setAttribute('aria-hidden','true');
  lab.querySelector('#gaia-statistics-takeaway').append(orbit);
  const sync = () => {
    let annotations = [];
    try { annotations = JSON.parse(canvas.dataset.statisticalAnnotations || '[]'); } catch { /* Initial empty canvas. */ }
    metrics.replaceChildren(...annotations.map(annotation => {
      const item = document.createElement('div');
      const split = String(annotation).match(/^(.+?)[=＝](.+)$/u);
      const label = document.createElement('dt');
      const value = document.createElement('dd');
      label.textContent = split ? split[1] : '分析結果';
      const number = split?.[2].match(/^([+−-]?[\d.,]+)(.*)$/u);
      if (number) {
        const amount = document.createElement('span');
        amount.textContent = (/^[\d]/u.test(number[1]) ? '+' : '') + number[1];
        const unit = document.createElement('small');unit.textContent = number[2];
        value.append(amount,unit);
      } else value.textContent = split ? split[2] : annotation;
      if (!split) item.className = 'notebook-metric-note';
      item.append(label,value);
      return item;
    }));
    metrics.hidden = !annotations.length;
    count.textContent = lab.querySelector('#gaia-statistics-record-count').textContent;
  };
  const observer = new MutationObserver(sync);
  observer.observe(canvas, {attributes:true, attributeFilter:['data-statistical-annotations']});
  observer.observe(lab.querySelector('#gaia-statistics-record-count'), {childList:true,subtree:true,characterData:true});
  sync();
  const headline = lab.querySelector('#gaia-statistics-takeaway-title');
  const wrapHeadline = () => {
    if (headline.querySelector('.notebook-headline-lead')) return;
    const text = headline.textContent;
    const split = text.indexOf('、');
    if (split < 0) return;
    const lead = document.createElement('span');
    lead.className = 'notebook-headline-lead';lead.textContent = text.slice(0,split+1);
    headline.replaceChildren(lead,document.createTextNode(text.slice(split+1)));
  };
  new MutationObserver(wrapHeadline).observe(headline,{childList:true,characterData:true,subtree:true});
  wrapHeadline();
  // A final resize after font loading redraws the real canvas with the selected fonts.
  document.fonts.ready.then(() => window.dispatchEvent(new Event('resize')));
}
