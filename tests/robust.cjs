// Robustness crawl: every screen as a brand-new user (day one) and a long-term user, at 320, 390,
// 768 and 1440 px wide. Fails on page errors, console errors, 'NaN'/'undefined'/'[object Object]'
// in visible text, or horizontal scrolling. Usage: node tests/robust.cjs [baseUrl]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8770/';
const routes = ['today', 'meals', 'move', 'habits', 'progress', 'journey', 'body', 'rewards', 'learn', 'shopping', 'checkin', 'settings', 'settings/profile', 'settings/day', 'settings/food', 'settings/movement', 'settings/alarms', 'settings/reminders', 'settings/appearance', 'settings/data', 'wake', 'wrap'];
async function onboard(p) {
  await p.click('text=Get started');
  await p.click('label.chip:has-text("Male")');
  await p.fill('input[name=age]', '35'); await p.fill('input[name=heightCm]', '182'); await p.fill('input[name=weight]', '185');
  for (let i = 0; i < 5; i++) await p.click('button:has-text("Continue")');
  await p.click('button:has-text("Start my plan")'); await p.waitForSelector('.tg-hero');
}
(async () => {
  const b = await chromium.launch();
  const issues = new Set();
  for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
    for (const who of ['new', 'demo']) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      p.on('pageerror', (e) => issues.add(`${w} ${who} pageerror ${e.message}`));
      p.on('console', (m) => m.type() === 'error' && issues.add(`${w} ${who} console ${m.text()}`));
      await p.goto(base); await p.evaluate(() => localStorage.clear()); await p.goto(base);
      if (who === 'new') await onboard(p); else { await p.click('text=Explore with demo data first'); await p.waitForSelector('.tg-hero'); }
      await p.evaluate(() => document.querySelectorAll('.modal-wrap button').forEach((x) => x.click()));
      for (const r of routes) {
        await p.goto(base + '#/' + r); await p.waitForTimeout(250);
        const res = await p.evaluate(() => {
          const out = [];
          const text = document.body.innerText;
          const bad = text.match(/.{0,30}\b(NaN|undefined|Infinity|\[object Object\])\b.{0,30}/);
          if (bad) out.push('bad text: ' + bad[0].replace(/\n/g, ' '));
          if (document.documentElement.scrollWidth > window.innerWidth + 1) {
            const wide = [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed').slice(0, 2).map((el) => el.tagName.toLowerCase() + '.' + [...el.classList].join('.'));
            out.push(`horizontal overflow ${document.documentElement.scrollWidth}px: ${wide.join(', ')}`);
          }
          return out;
        });
        for (const x of res) issues.add(`${w} ${who} ${r}: ${x}`);
      }
      await p.close();
    }
  }
  await b.close();
  if (issues.size) {
    console.error([...issues].join('\n'));
    process.exit(1);
  }
  console.log('robust ok (22 screens × new and long-term user × 4 screen sizes)');
})();
