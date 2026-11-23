// Demo-data walkthrough with screenshots of the long-run screens (progress chart, plateau check-in).
const { chromium } = require('playwright');
/** Answer every check-in question (scales default to 3, yes/no to "no"); overrides by field name. */
async function answerCheckin(page, overrides = {}) {
  await page.waitForSelector('fieldset.scale');
  await page.evaluate((o) => {
    for (const fs of document.querySelectorAll('fieldset.scale')) {
      const name = fs.querySelector('input').name;
      const v = o[name] || (fs.classList.contains('yn') ? 'no' : '3');
      fs.querySelector(`input[value="${v}"]`).click();
    }
  }, overrides);
}

const base = process.argv[2] || 'http://localhost:8765/';
const shots = process.argv[3] || null;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  let celebrations = 0;
  await page.addLocatorHandler(page.locator('.celebrate-modal'), async () => {
    celebrations++;
    await page.click('.celebrate-modal button');
  });
  const snap = async (n) => shots && page.screenshot({ path: `${shots}/${n}.png`, fullPage: true });
  await page.goto(base);
  await page.click('text=Explore with demo data');
  await page.waitForSelector('text=demo data');
  await snap('d1-today');
  for (const r of ['progress', 'habits', 'move', 'meals/0', 'meals/recipes/dinner/2']) {
    await page.goto(base + '#/' + r);
    await page.waitForTimeout(300);
    await snap('d-' + r.replace(/\//g, '_'));
  }
  await page.click('button:has-text("Use") >> nth=0');
  await page.waitForSelector('text=Plan settings');
  await page.goto(base + '#/checkin');
  await answerCheckin(page, { adherence: '5' });
  await page.click('button:has-text("See my adjustments")');
  await page.waitForSelector('text=Apply selected');
  await snap('d2-checkin');
  const text = await page.textContent('main');
  if (!/Plateau/.test(text)) errors.push('expected plateau flow in demo check-in');
  await page.click('button:has-text("Apply selected")');
  await page.waitForSelector('text=demo data');
  await page.goto(base + '#/settings');
  await page.waitForTimeout(200);
  await snap('d3-settings');
  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('demo ok');
})().catch((e) => { console.error(e); process.exit(1); });
