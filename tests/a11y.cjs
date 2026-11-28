// Accessibility: axe-core (WCAG 2.0/2.1/2.2 A and AA + best practices) on every screen, in light and
// dark mode, with demo data. Fails on any violation.
// Usage: node tests/a11y.cjs [baseUrl]   (needs: npm install --no-save axe-core@4.10.2)
const { chromium } = require('playwright');
const fs = require('fs');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.argv[2] || 'http://localhost:8765/';
const routes = ['today', 'meals', 'move', 'habits', 'progress', 'journey', 'body', 'rewards', 'learn', 'shopping', 'checkin', 'settings', 'settings/profile', 'settings/day', 'settings/food', 'settings/movement', 'settings/alarms', 'settings/reminders', 'settings/appearance', 'settings/data', 'wake', 'wrap', 'calendar', 'plan', 'sos', 'account', 'inbox', 'you', 'today/' + new Date(Date.now() - 864e5).toISOString().slice(0, 10)];

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
    // The new sheets: Log, food picker with an item, build-it, create a food, swap, plan preview
    const sheet = async (name, open) => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      await open();
      await page.waitForSelector('.sheet.open');
      await page.waitForTimeout(250);
      await audit(name);
    };
    await sheet('log sheet', () => page.click('.bottomnav .tab-log'));
    await page.click('.sheet .ql-tile[data-action=openExtra]');
    await page.fill('.sheet [data-food-search]', 'kiwi green');
    await page.click('.sheet .food-hit >> nth=0');
    await audit('food picker');
    await page.click('.sheet [data-action=foodMode][data-m=build] >> nth=0').catch(() => {});
    await page.fill('.sheet [data-food-search]', 'burrito').catch(() => {});
    await page.click('.sheet .food-build').catch(() => {});
    await page.waitForSelector('.sheet .food-builder');
    await audit('build-it');
    await sheet('swap chooser', async () => {
      await page.goto(base + '#/today');
      await page.click('.tg-day button[data-action=openMeal] >> nth=0');
      await page.click('.sheet button:has-text("Swap")');
      await page.waitForSelector('.sheet .swap-opt');
    });
    await sheet('planned session', async () => {
      await page.goto(base + '#/move');
      await page.click('.session-open >> nth=0');
    });
    await page.keyboard.press('Escape');
    for (const step of [1, 2, 3]) {
      await page.goto(base + '#/plan');
      await page.click(`.rit-dot[data-to="${step}"]`);
      await page.waitForSelector('.rit-dot.on[data-to="' + step + '"]');
      await audit('plan tomorrow step ' + (step + 1));
    }
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
