// Text fits: every screen and sheet at phone width with enlarged text (Android's font size setting at
// 130%) and at 320 px with normal text. Fails on text that is cut off, spills out of its box, pushes the
// page sideways or overlaps a neighbour. (Deliberate two- or three-line clamps are allowed.)
// Usage: node tests/textfit.cjs [baseUrl]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8771/';
const routes = ['today', 'calendar', 'meals', 'move', 'progress', 'you', 'habits', 'journey', 'body', 'rewards', 'checkin', 'learn', 'settings', 'settings/profile', 'settings/day', 'settings/food', 'settings/movement', 'settings/alarms', 'settings/reminders', 'account', 'inbox', 'plan', 'sos', 'shopping', 'wrap', 'move/session/A'];
const shotDir = '';

const AUDIT = (scale) => {
  // Emulate Android's text zoom: every font size × scale (px line-heights too).
  if (scale !== 1) {
    // Read every size first, then write, so nested text isn't enlarged twice.
    const els = [...document.querySelectorAll('body *')].filter((el) => !el.dataset.fs);
    const sizes = els.map((el) => [getComputedStyle(el).fontSize, getComputedStyle(el).lineHeight]);
    els.forEach((el, i) => { el.dataset.fs = sizes[i][0]; el.style.fontSize = parseFloat(sizes[i][0]) * scale + 'px'; if (sizes[i][1].endsWith('px')) el.style.lineHeight = parseFloat(sizes[i][1]) * scale + 'px'; });
  }
  const out = [];
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],[inert]:not(.app),.sr-only'); };
  const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} “${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}”`;
  const root = document.querySelector('.sheet.open') || document.querySelector('main');
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
  for (const el of root.querySelectorAll('*')) {
    if (!vis(el) || el.closest('svg') || el.matches('svg, input, select, textarea, option')) continue;
    const cs = getComputedStyle(el);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    // 1. clipped text (overflow hidden/ellipsis) — the words are cut off
    if (hasText && (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 2 && !el.matches('.fi-units, .cal-views, .cal-strip, .cal-layers, .week-strip, [data-scroll-x]')) out.push(`clipped: ${name(el)} (${el.scrollWidth}>${el.clientWidth})`);
    if (hasText && cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 3 && el.clientHeight > 0 && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') out.push(`cut vertically: ${name(el)}`);
    // 2. text spilling outside its parent box
    if (hasText) {
      const r = el.getBoundingClientRect();
      const p = el.parentElement;
      const pr = p.getBoundingClientRect();
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === 'visible' && !el.matches('a.btn.ghost.small') && (r.right > pr.right + 2 || r.left < pr.left - 2) && !p.matches('.fi-units, .cal-views')) out.push(`spills out: ${name(el)} beyond ${name(p).slice(0, 30)}`);
      const scroller = el.closest('*') && [...(function* () { let a = el.parentElement; while (a) { yield a; a = a.parentElement; } })()].some((a) => ['auto', 'scroll'].includes(getComputedStyle(a).overflowX));
      if (r.right > innerWidth + 1 && !scroller) out.push(`off screen: ${name(el)}`);
    }
    // 3. overlapping siblings in a flex/grid row
    if (/flex|grid/.test(cs.display)) {
      const kids = [...el.children].filter(vis).filter((k) => getComputedStyle(k).position === 'static' || getComputedStyle(k).position === 'relative');
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect(); const b = kids[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left); const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 3 && oy > 3) out.push(`overlap: ${name(kids[i]).slice(0, 50)} × ${name(kids[j]).slice(0, 50)}`);
      }
    }
  }
  return [...new Set(out)];
};

async function run(scale, width) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base); await p.evaluate(() => localStorage.clear()); await p.goto(base);
  await p.click('text=Explore with demo data first'); await p.waitForSelector('.tg-hero');
  await p.addLocatorHandler(p.locator('.modal-wrap'), async () => p.click('.modal-wrap button >> nth=-1'));
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  const report = {};
  const check = async (label) => {
    await p.waitForTimeout(450);
    const r = await p.evaluate(AUDIT, scale);
    if (r.length) report[label] = r;
    if (shotDir) await p.screenshot({ path: `${shotDir}/${label.replace(/\W+/g, '_')}.png`, fullPage: !(await p.locator('.sheet.open').count()) });
  };
  for (const r of routes) { await p.goto(base + '#/' + r); await p.waitForTimeout(r === 'today' ? 3000 : 300); await check(r); await p.reload(); }
  const sheet = async (label, fn) => { await p.goto(base + '#/today'); await p.waitForTimeout(300); try { await fn(); await check(label); } catch (e) { report[label] = ['could not open: ' + e.message.split('\n')[0]]; } await p.keyboard.press('Escape'); };
  await sheet('sheet: log', () => p.click('.bottomnav .tab-log'));
  await sheet('sheet: food picker', async () => { await p.click('.bottomnav .tab-log'); await p.click('.sheet .ql-tile[data-action=openExtra]'); await p.fill('.sheet [data-food-search]', 'chicken'); });
  await sheet('sheet: food picked', async () => { await p.click('.bottomnav .tab-log'); await p.click('.sheet .ql-tile[data-action=openExtra]'); await p.fill('.sheet [data-food-search]', 'kiwi green'); await p.click('.sheet .food-hit >> nth=0'); await p.fill('.sheet [data-food-search]', 'big mac'); await p.click('.sheet .food-hit >> nth=0'); });
  await sheet('sheet: builder', async () => { await p.click('.bottomnav .tab-log'); await p.click('.sheet .ql-tile[data-action=openExtra]'); await p.fill('.sheet [data-food-search]', 'burrito'); await p.click('.sheet .food-build'); for (const k of ['base.tortilla', 'protein.chicken', 'extras.guac', 'extras.guac']) await p.click(`.sheet [data-k="${k}"]`); });
  await sheet('sheet: create food', async () => { await p.click('.bottomnav .tab-log'); await p.click('.sheet .ql-tile[data-action=openExtra]'); await p.click('.sheet [data-action=foodMode][data-m=create]'); });
  await sheet('sheet: meal', () => p.click('.tg-day button[data-action=openMeal] >> nth=0'));
  await sheet('sheet: meal time', async () => { await p.click('.tg-day button[data-action=openMeal] >> nth=0'); await p.click('.sheet [data-action=sheetMealTime]'); });
  await sheet('sheet: swap', async () => { await p.click('.tg-day button[data-action=openMeal] >> nth=0'); await p.click('.sheet button:has-text("Swap")'); await p.waitForSelector('.sheet .swap-opt'); });
  await sheet('sheet: weigh', () => (async () => { await p.click('.bottomnav .tab-log'); await p.click('.sheet .ql-tile[data-action=openWeigh]'); })());
  await sheet('sheet: planned session', async () => { await p.goto(base + '#/move'); await p.click('.session-open >> nth=0'); });
  for (const st of [1, 2, 3]) await sheet(`plan step ${st + 1}`, async () => { await p.goto(base + '#/plan'); await p.click(`.rit-dot[data-to="${st}"]`); if (st === 3) { await p.click(`.rit-dot[data-to="2"]`); await p.click('[data-k=out]'); await p.click('[data-k=stress]'); await p.click(`.rit-dot[data-to="3"]`); } });
  await b.close();
  const bad = [];
  for (const [k, v] of Object.entries(report)) for (const x of v) if (!x.startsWith('cut vertically')) bad.push(`${Math.round(scale * 100)}% text, ${width}px · ${k}: ${x}`);
  return [...bad, ...errs.map((e) => 'page error: ' + e)];
}

(async () => {
  const problems = [...(await run(1.3, 360)), ...(await run(1, 320))];
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('textfit ok (every screen and sheet: 130% text at 360 px, 320 px at normal size)');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
