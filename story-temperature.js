(() => {
  'use strict';
  const root = new URL('.', document.currentScript.src);
  let active = null;
  let cached = null;
  const load = () => cached ||= Promise.all([
    fetch(new URL('data/story-temperature-annual.json', root)),
    fetch(new URL('data/story-temperature-annual.bin', root)),
    fetch(new URL('data/natural-earth-50m-land.geojson', root)),
  ]).then(async responses => {
    if (responses.some(r => !r.ok)) throw new Error('Temperature data unavailable');
    const [meta, buffer, land] = await Promise.all([responses[0].json(), responses[1].arrayBuffer(), responses[2].json()]);
    if (buffer.byteLength !== meta.frames.length * meta.width * meta.height * 2) throw new Error('Invalid temperature data length');
    return {meta, values: new DataView(buffer), land};
  }).catch(error => { cached = null; throw error; });
  const stops = [[-4, [40,72,175]], [-2,[76,161,218]], [0,[246,235,157]], [1,[246,162,80]], [2,[210,70,54]], [4,[131,29,52]]];
  const color = value => {
    const b = stops.findIndex(s => value <= s[0]);
    if (b <= 0) return stops[b === 0 ? 0 : stops.length - 1][1];
    const a = stops[b-1], z = stops[b], t = (value-a[0])/(z[0]-a[0]);
    return a[1].map((v,i) => Math.round(v+(z[1][i]-v)*t));
  };
  const close = () => {
    if (!active) return;
    active.dispose?.();
    active.observer?.disconnect();
    active.shell.remove();
    active.parent.classList.remove('is-story-temperature');
    active.children.forEach(([element,inert]) => { element.inert = inert; });
    active = null;
  };
  const open = async (parent, {reducedMotion = false} = {}) => {
    close();
    const shell = document.createElement('section');
    shell.className = 'story-temperature';
    shell.setAttribute('aria-label', '気温偏差の年代と地点を比べる');
    shell.innerHTML = `<header class="story-temperature-header"><div><small>MODE 01 <i aria-hidden="true">/</i> NASA GISS</small><h2>気温偏差 <span>Temperature Anomaly</span></h2></div><button type="button" data-temperature-return aria-label="スキップして物語へ戻る">スキップ<span aria-hidden="true">▶</span></button></header>
      <div class="story-temperature-map"><canvas tabindex="0" role="img" aria-label="世界の年平均気温偏差。タップで地点を選択。矢印キーで地点を移動、Enterで選択。"></canvas><p data-temperature-status role="status">気温偏差の記録を読み込んでいます…</p></div>
      <footer class="story-temperature-controls"><div class="story-temperature-time"><div class="story-temperature-year"><small>YEAR</small><output data-temperature-year aria-live="off">—</output></div><div class="story-temperature-transport"><button type="button" data-temperature-prev disabled aria-label="1年前">‹</button><button type="button" data-temperature-play disabled aria-label="年代の自動再生を一時停止" aria-pressed="true"><span data-temperature-play-icon aria-hidden="true">Ⅱ</span></button><button type="button" data-temperature-next disabled aria-label="1年後">›</button></div><div class="story-temperature-timeline"><label><span class="story-temperature-playback"><span data-temperature-playback role="status">記録を読み込み中</span><span class="story-temperature-end-note">最後の年で物語へ</span></span><input type="range" aria-label="表示する年代" data-temperature-time min="1958" max="2025" step="1" value="1958" disabled></label><div class="story-temperature-years" aria-hidden="true"><span data-temperature-start>1958</span><span data-temperature-end>2025</span></div></div></div>
      <div class="story-temperature-meta"><p class="story-temperature-point" data-temperature-point aria-live="off">地図に触れて、各地の気温偏差を比べる。<span>年代は自動で進みます。一時停止して探索もできます。</span></p>
      <div class="story-temperature-legend"><div><span>低い</span><span>1951–1980年平均との差</span><span>高い</span></div><div class="story-temperature-ramp"></div><div><span>−4 ℃以下</span><span>0 ℃</span><span>+4 ℃以上</span></div><p>色・等値線：年平均の気温偏差 ／ 灰色：データなし</p></div>
      </div><details class="story-temperature-source"><summary>データの出典・基準</summary><p>NASA GISS / GISTEMP v4（陸域の気温＋海面水温）。基準：1951–1980年。観測に基づく推定の2°格子、NASAによる1200 km平滑化済み。各年12か月が揃うセルだけを年平均し、0.01 ℃に丸めています。欠測は補完しません。地点の温度計の実測値・絶対気温・将来予測ではありません。</p><p>表示期間：1958–2025年。等値線は格子の間を線形補間した表示です。</p><p><a href="https://data.giss.nasa.gov/gistemp/" target="_blank" rel="noopener noreferrer">NASA GISS / GISTEMP v4</a> · GISTEMP Team, 2026; Lenssen et al. (2024), doi:10.1029/2023JD040179</p><p data-temperature-retrieved></p></details></footer>`;
    const children = [...parent.children].map(element => [element, element.inert]);
    children.forEach(([element]) => { element.inert = true; });
    parent.append(shell);
    parent.classList.add('is-story-temperature');
    const runtime = {shell, parent, children, closing:false};
    active = runtime;
    shell.querySelector('[data-temperature-return]').addEventListener('click', () => {
      runtime.closing = true;
      runtime.dispose?.();
      document.querySelector('#story-map-modal-skip')?.click();
    });
    shell.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...shell.querySelectorAll('button, input, canvas, summary, a')]
        .filter(element => !element.disabled && element.offsetParent !== null
          && (element.tagName === 'SUMMARY' || !element.closest('details:not([open])')));
      const target = event.shiftKey && document.activeElement === controls[0] ? controls.at(-1)
        : !event.shiftKey && document.activeElement === controls.at(-1) ? controls[0] : null;
      if (target) { event.preventDefault(); target.focus(); }
    });
    shell.querySelector('[data-temperature-return]').focus({preventScroll:true});
    const status = shell.querySelector('[data-temperature-status]');
    let source;
    try { source = await load(); }
    catch {
      if (active === runtime) status.textContent = '気温データを読み込めませんでした。物語へ戻れます。';
      return;
    }
    if (active !== runtime || runtime.closing) return;
    const {meta, values, land} = source;
    const canvas = shell.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const slider = shell.querySelector('[data-temperature-time]');
    const point = shell.querySelector('[data-temperature-point]');
    const play = shell.querySelector('[data-temperature-play]');
    const playback = shell.querySelector('[data-temperature-playback]');
    const sourceDetails = shell.querySelector('.story-temperature-source');
    const raster = document.createElement('canvas');
    raster.width = meta.width; raster.height = meta.height;
    const rasterContext = raster.getContext('2d');
    let year = meta.frames[0].year, selected = null, mapRect, frame;
    slider.min = String(year); slider.max = String(meta.frames.at(-1).year); slider.value = String(year); slider.disabled = false;
    shell.querySelector('[data-temperature-start]').textContent = slider.min;
    shell.querySelector('[data-temperature-end]').textContent = slider.max;
    play.disabled = false;
    status.hidden = true;
    shell.querySelector('[data-temperature-retrieved]').textContent = `取得日：${meta.retrievedAt.slice(0,10)} ／ローカル保存データ。海岸線：Natural Earth（public domain）。`;
    const valueAt = (row, col) => {
      const value = values.getInt16((frame * meta.width * meta.height + row * meta.width + col) * 2, true);
      return value === meta.missing ? null : value / 100;
    };
    const project = (lon, lat) => [mapRect.x + (lon+180)/360*mapRect.w, mapRect.y + (90-lat)/180*mapRect.h];
    const updatePoint = () => {
      if (!selected) return;
      const row = Math.min(89, Math.max(0, Math.floor((90-selected.lat)/2)));
      const col = Math.min(179, Math.max(0, Math.floor((selected.lon+180)/2)));
      const value = valueAt(row,col), lon = -179+col*2, lat = 89-row*2;
      point.textContent = `${year}年 ｜ ${Math.abs(lat)}°${lat>=0?'N':'S'} / ${Math.abs(lon)}°${lon>=0?'E':'W'} ｜ ${value === null ? 'データなし' : (value>=0?'+':'')+value.toFixed(2)+' ℃'}（2°格子）`;
      shell.dataset.selectedCell = `${row},${col}`;
      shell.dataset.selectedValue = value === null ? 'missing' : String(value);
    };
    const draw = () => {
      frame = meta.frames.findIndex(f => f.year === year);
      const bounds = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width*dpr)); canvas.height = Math.max(1, Math.round(bounds.height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,bounds.width,bounds.height);
      const w = Math.min(bounds.width,bounds.height*2), h = w/2;
      mapRect = {x:(bounds.width-w)/2,y:(bounds.height-h)/2,w,h};
      const pixels = rasterContext.createImageData(meta.width,meta.height);
      let warm = 0, cool = 0;
      for (let row=0; row<meta.height; row++) for (let col=0; col<meta.width; col++) {
        const value = valueAt(row,col), offset = (row*meta.width+col)*4;
        const rgb = value === null ? [75,83,90] : color(value);
        pixels.data.set([...rgb,255],offset);
        if (value > 0) warm++; else if (value < 0) cool++;
      }
      rasterContext.putImageData(pixels,0,0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(raster,mapRect.x,mapRect.y,w,h);
      // Marching triangles; never bridge missing cells or the antimeridian.
      ctx.strokeStyle='rgba(67,44,35,.24)'; ctx.lineWidth=.55;
      for (const level of [-2,-1,0,1,2,3]) {
        ctx.beginPath();
        for (let r=0;r<89;r++) for (let c=0;c<179;c++) {
          const vertices = [[c+.5,r+.5,valueAt(r,c)],[c+1.5,r+.5,valueAt(r,c+1)],[c+1.5,r+1.5,valueAt(r+1,c+1)],[c+.5,r+1.5,valueAt(r+1,c)]];
          for (const ids of [[0,1,2],[0,2,3]]) {
            const v=ids.map(i=>vertices[i]);
            if (v.some(p=>p[2]===null)) continue;
            const hits=[];
            for(let e=0;e<3;e++) {
              const a=v[e],b=v[(e+1)%3];
              if ((a[2]<level)===(b[2]<level)) continue;
              const t=(level-a[2])/(b[2]-a[2]);
              hits.push([mapRect.x+(a[0]+(b[0]-a[0])*t)/180*w,mapRect.y+(a[1]+(b[1]-a[1])*t)/90*h]);
            }
            if(hits.length===2) {ctx.moveTo(...hits[0]);ctx.lineTo(...hits[1]);}
          }
        }
        ctx.stroke();
      }
      ctx.beginPath();
      for (const feature of land.features) {
        const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        for (const polygon of polygons) for (const ring of polygon) {
          ring.forEach(([lon,lat],i) => {
            const p=project(lon,lat);
            if (!i || Math.abs(lon-ring[i-1][0])>180) ctx.moveTo(...p); else ctx.lineTo(...p);
          });
        }
      }
      ctx.strokeStyle='rgba(16,29,38,.78)'; ctx.lineWidth=.7; ctx.stroke();
      if(selected) {
        const p=project(selected.lon,selected.lat);
        ctx.beginPath();ctx.arc(...p,7,0,Math.PI*2);ctx.strokeStyle='#10212a';ctx.lineWidth=4;ctx.stroke();
        ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
      }
      shell.dataset.year=String(year); shell.dataset.warmCells=String(warm); shell.dataset.coolCells=String(cool);
      shell.dataset.ready='true';
      shell.querySelector('[data-temperature-year]').textContent=String(year);
      shell.querySelector('[data-temperature-prev]').disabled=year===Number(slider.min);
      shell.querySelector('[data-temperature-next]').disabled=year===Number(slider.max);
      slider.setAttribute('aria-valuetext',year+'年の年平均気温偏差');
      slider.style.setProperty('--temperature-progress',`${(year-Number(slider.min))/(Number(slider.max)-Number(slider.min))*100}%`);
      updatePoint();
    };
    // One owner and one timer for both playback and completion. No catch-up after
    // hidden tabs, pointer scrubbing, or reading the source; every year is drawn.
    const lifetime = new AbortController();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let timer = 0, playing = true, dragging = false, disposed = false;
    const current = () => active === runtime && !disposed && !runtime.closing && shell.isConnected;
    const suspended = () => document.hidden || dragging || sourceDetails.open;
    const atEnd = () => year === Number(slider.max);
    const updatePlayback = () => {
      shell.dataset.playback = atEnd() ? 'ending' : playing ? 'playing' : 'paused';
      play.disabled = atEnd();
      play.setAttribute('aria-pressed',String(playing));
      play.setAttribute('aria-label',playing ? '年代の自動再生を一時停止' : '年代の自動再生を再開');
      shell.querySelector('[data-temperature-play-icon]').textContent = playing ? 'Ⅱ' : '▶';
      const message = suspended() ? '表示を保持中' : atEnd() ? '物語の続きへ…' : playing ? '年代を自動再生中' : '一時停止中';
      if (playback.textContent !== message) playback.textContent = message;
      point.setAttribute('aria-live',playing ? 'off' : 'polite');
    };
    runtime.dispose = () => {
      disposed = true;
      window.clearTimeout(timer);
      lifetime.abort();
    };
    const schedule = (delay) => {
      window.clearTimeout(timer);
      if (!current()) return;
      updatePlayback();
      if (suspended() || (!playing && !atEnd())) return;
      const final = atEnd();
      timer = window.setTimeout(() => {
        if (!current() || suspended()) return;
        if (final) {
          runtime.dispose();
          window.dispatchEvent(new CustomEvent('gaia:story-mode-auto-complete',{detail:{kind:'map01',phase:'temperature-anomaly',view:'long_term',year}}));
          return;
        }
        slider.value = String(year+1);
        changeYear();
      }, final ? 1600 : delay ?? (motion.matches || reducedMotion ? 400 : 260));
    };
    const changeYear = () => {
      if (!current()) return;
      year=Number(slider.value); draw();
      window.dispatchEvent(new CustomEvent('gaia:story-map-interaction',{detail:{kind:'map01',view:'long_term',year}}));
      schedule();
    };
    play.addEventListener('click',()=>{playing=!playing;schedule();});
    slider.addEventListener('pointerdown',event=>{
      dragging=true;slider.setPointerCapture(event.pointerId);schedule();
    });
    const releasePointer=()=>{if(!dragging)return;dragging=false;schedule(700);};
    slider.addEventListener('pointerup',releasePointer);
    slider.addEventListener('pointercancel',releasePointer);
    slider.addEventListener('lostpointercapture',releasePointer);
    document.addEventListener('visibilitychange',()=>schedule(700),{signal:lifetime.signal});
    sourceDetails.addEventListener('toggle',()=>schedule(700),{signal:lifetime.signal});
    window.addEventListener('gaia:story-mode-close',event=>{
      if(event.detail?.kind==='map01')runtime.dispose();
    },{signal:lifetime.signal});
    slider.addEventListener('input',changeYear);
    for(const [name,delta] of [['prev',-1],['next',1]]) shell.querySelector(`[data-temperature-${name}]`).addEventListener('click',()=> {
      slider.value=String(Math.max(Number(slider.min),Math.min(Number(slider.max),year+delta)));changeYear();
    });
    canvas.addEventListener('click',event=> {
      const b=canvas.getBoundingClientRect(),x=event.clientX-b.x-mapRect.x,y=event.clientY-b.y-mapRect.y;
      if(x<0||y<0||x>mapRect.w||y>mapRect.h)return;
      selected={lon:Math.min(179,-180+x/mapRect.w*360),lat:Math.max(-89,90-y/mapRect.h*180)};
      draw();
      window.dispatchEvent(new CustomEvent('gaia:story-map-interaction',{detail:{kind:'map01',view:'temperature_anomaly'}}));
    });
    canvas.addEventListener('keydown',event=> {
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      selected ||= {lon:139,lat:35};
      selected.lon=Math.max(-179,Math.min(179,selected.lon+(event.key==='ArrowRight'?2:event.key==='ArrowLeft'?-2:0)));
      selected.lat=Math.max(-89,Math.min(89,selected.lat+(event.key==='ArrowUp'?2:event.key==='ArrowDown'?-2:0)));
      draw();
      window.dispatchEvent(new CustomEvent('gaia:story-map-interaction',{detail:{kind:'map01',view:'temperature_anomaly'}}));
    });
    runtime.observer=new ResizeObserver(draw);runtime.observer.observe(canvas);
    draw();slider.focus({preventScroll:true});schedule(1000);
  };
  window.GaiaStoryTemperature=Object.freeze({open,close});
})();
