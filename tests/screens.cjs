// Screenshot tour for design review: node tests/screens.cjs <baseUrl> <outDir> [routes...]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8766/';
const out = process.argv[3] || '.';
const routes = process.argv.slice(4).length ? process.argv.slice(4) : ['today', 'meals', 'move', 'habits', 'progress', 'rewards', 'checkin', 'settings', 'settings/reminders', 'settings/profile', 'learn'];
(async () => {
  const browser = await chromium.launch();
  for (const [label, vp, scheme] of [['phone', { width: 390, height: 844 }, 'light'], ['phone-dark', { width: 390, height: 844 }, 'dark'], ['desktop', { width: 1280, height: 860 }, 'light']]) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.click('text=Explore with demo data');
    await page.waitForTimeout(400);
    await page.addLocatorHandler(page.locator('.celebrate-modal'), async () => page.click('.celebrate-modal button'));
    for (const r of routes) {
      await page.goto(base + '#/' + r);
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${out}/${label}-${r.replace(/\//g, '_')}.png`, fullPage: label !== 'desktop' });
    }
    if (routes.includes('today')) {
      await page.goto(base + '#/today');
      await page.waitForTimeout(300);
      await page.click('.tg-day .k-meal .row-btn >> nth=0');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${label}-sheet-meal.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      await page.click('button[data-action=openWeigh] >> nth=0');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${label}-sheet-weigh.png` });
    }
    if (errors.length) console.log(label, 'ERRORS', errors);
    await ctx.close();
  }
  await browser.close();
  console.log('screens ok');
})();
