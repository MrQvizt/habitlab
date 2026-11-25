// Accessibility: axe-core (WCAG 2.0/2.1/2.2 A and AA + best practices) on every screen, in light and
// dark mode, with demo data. Fails on any violation.
// Usage: node tests/a11y.cjs [baseUrl]   (needs: npm install --no-save axe-core@4.10.2)
const { chromium } = require('playwright');
const fs = require('fs');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.argv[2] || 'http://localhost:8765/';
const routes = ['today', 'meals', 'move', 'habits', 'progress', 'journey', 'body', 'rewards', 'learn', 'shopping', 'checkin', 'settings', 'settings/profile', 'settings/day', 'settings/food', 'settings/movement', 'settings/alarms', 'settings/reminders', 'settings/appearance', 'settings/data', 'wake', 'wrap'];

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  let checks = 0;
  for (const scheme of ['light', 'dark']) {
    // bypassCSP lets the test inject axe under the production Content-Security-Policy
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, bypassCSP: true });
    const page = await context.newPage();
    const audit = async (label) => {
      await page.waitForTimeout(600);
      if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: axeSource });
      const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'], runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations);
      checks++;
      for (const x of v) problems.push(`${scheme} ${label}: ${x.impact} ${x.id} — ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`);
    };
    await page.goto(base);
    await page.evaluate(() => localStorage.clear());
    await page.goto(base);
    await audit('welcome');
    await page.click('text=Explore with demo data first');
    await page.waitForSelector('.tg-hero');
    await page.evaluate(() => document.querySelectorAll('.modal-wrap button').forEach((b) => b.click()));
    for (const r of routes) {
      await page.goto(base + '#/' + r);
      await audit(r);
    }
    // A sheet
    await page.goto(base + '#/today');
    await page.waitForSelector('.body-rings .br');
    await page.click('.body-rings .br >> nth=0');
    await page.waitForSelector('.sheet.open');
    await audit('body-part sheet');
    await context.close();
  }
  await browser.close();
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`a11y ok (${checks} screen checks, 0 violations)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
