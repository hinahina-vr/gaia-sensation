import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4492/');
  await page.waitForFunction(() => !!globalThis.GaiaI18nCanvas);
  const result = await page.evaluate(async () => {
    const host = document.createElement('section');
    host.id = 'i18n-regression-fixture';
    host.innerHTML = '<button>再生</button><b data-map-symbol="再生"></b><input placeholder="都道府県・都市名を検索" value="東京都"><textarea placeholder="都道府県・都市名を検索">東京都</textarea><span translate="no">東京都</span><code>東京都</code><i>08</i>';
    document.body.append(host);
    const named = document.createElement('label'); host.append(named);
    GaiaI18n.register([['{name}のテスト用表示', 'Test display for {name}', '{name}的测试显示']]);
    GaiaI18n.bind(named, '{name}のテスト用表示', { name: '東京都' });
    GaiaI18n.bind(named, '{name}のテスト用表示', { name: '東京都' }, 'title');
    const raw = { id:'SOURCE', type:'SOURCE', recordType:'SOURCE', speaker:'SYSTEM', sceneId:'SOURCE', text:'SOURCE', value:'SOURCE', title:'サウンド設定' };
    const view = GaiaI18n.view(raw);
    const unknownProse = '新しい物語のまだ辞書にない一文です。';
    const reports = [];
    for (const language of ['en','zh-CN','ja']) {
      GaiaI18n.set(language);
      if (GaiaI18n.t(unknownProse) !== unknownProse) throw new Error('Unknown prose was treated as a field template');
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (!named.textContent.includes('東京都') || !named.title.includes('東京都')) throw new Error('Bound user-provided name was translated');
      reports.push({ language, play:host.querySelector('button').textContent, recycling:host.querySelector('b').getAttribute('data-map-symbol'), placeholder:host.querySelector('input').placeholder, textareaPlaceholder:host.querySelector('textarea').placeholder,
        input:host.querySelector('input').value, textarea:host.querySelector('textarea').value, code:host.querySelector('code').textContent, protected:host.querySelector('[translate=no]').textContent, number:host.querySelector('i').textContent,
        view:{ ...view }, raw:{ ...raw }, date:GaiaI18n.t('2026年9月12日（日本時間）'), model:GaiaI18n.t('01 北海道、代表都市 札幌、風速 1.52 m/s。都道府県平均ではありません') });
    }
    const canvas = document.createElement('canvas'); canvas.width=500; canvas.height=110; host.append(canvas);
    const native = canvas.getContext('2d'), ctx=GaiaI18nCanvas.context(native), widths=[];
    for (const language of ['en','zh-CN']) {
      GaiaI18n.set(language); ctx.font='24px "Yu Mincho", serif'; ctx.fillStyle='#145c6a';
      const translated=GaiaI18n.t('気温'), expected=native.measureText(translated).width, actual=ctx.measureText('気温').width;
      ctx.fillText('気温', 8, language==='en' ? 36 : 82);
      widths.push({language,translated,expected,actual,font:ctx.font,canvasIdentity:ctx.canvas===canvas});
    }
    const pixels=native.getImageData(0,0,500,110).data.filter((value,index)=>index%4===3 && value>0).length;
    host.remove(); GaiaI18n.set('ja');
    return {reports,widths,pixels};
  });
  for (const row of result.reports) {
    for (const key of ['input','textarea','code','protected']) assert.equal(row[key], '東京都');
    assert.equal(row.number, '08');
    for (const key of ['id','type','recordType','speaker','sceneId','value']) assert.equal(row.view[key], row.raw[key], `Structural field changed: ${key}`);
    assert.equal(row.raw.text, 'SOURCE');
    if (row.language==='en') {
      assert.equal(row.play,'Play'); assert.equal(row.recycling,'Recycling');
      assert.equal(row.placeholder,'Search prefectures and cities');
      assert.equal(row.textareaPlaceholder,row.placeholder);
      assert(!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(row.model));
      assert.equal(row.date,'2026-9-12 JST');
    } else if (row.language==='ja') {
      assert.equal(row.play,'再生'); assert.equal(row.recycling,'再生');
      assert.equal(row.placeholder,'都道府県・都市名を検索');
    }
  }
  for (const row of result.widths) { assert.equal(row.actual,row.expected); assert(row.canvasIdentity); }
  assert(result.pixels>500, 'Canvas must actually draw translated glyphs');
  assert.deepEqual(errors,[]);
  fs.mkdirSync('artifacts/i18n',{recursive:true});
  fs.writeFileSync('artifacts/i18n/core-browser.json',JSON.stringify({status:'passed',...result},null,2));
  console.log('Localization presentation guards and native canvas rendering passed');
} finally { await browser.close(); }
