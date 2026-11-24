// Journey walkthrough: 182 cm / 185 kg, goal left empty → suggested healthy goal, multi-year timeline,
// stops on the plan step, the Today "next stop" card and the Journey page. Fails on any console error.
// Usage: node tests/journey.cjs [baseUrl] [screenshotDir]
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://localhost:8765/';
const shots = process.argv[3] || null;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const snap = async (name, full = true) => {
    if (!shots) return;
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${shots}/${name}.png`, fullPage: full });
  };

  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.click('text=Get started');
  await page.click('label.chip:has-text("Male")');
  await page.fill('input[name=age]', '35');
  await page.fill('input[name=heightCm]', '182');
  await page.fill('input[name=weight]', '185');
  const hint = await page.textContent('[data-live=goal]');
  if (!/61\.5 kg–82 kg/.test(hint) || !/Suggested: 82 kg/.test(hint)) errors.push('live goal hint wrong: ' + hint);
  await snap('j1-about');
  // "Use 82 kg" fills the goal field; then clear it again to test the automatic suggestion
  await page.click('[data-action=useGoalDraft]');
  if ((await page.inputValue('input[name=goal]')) !== '82') errors.push('Use button did not fill the goal');
  await page.fill('input[name=goal]', '');
  for (let i = 0; i < 5; i++) await page.click('button:has-text("Continue")');
  await page.waitForSelector('text=Choose your pace');
  const preview = await page.textContent('.journey-preview');
  if (!/185 kg → 82 kg/.test(preview)) errors.push('journey preview heading: ' + preview.slice(0, 80));
  if (!/nearest healthy weight/.test(preview)) errors.push('auto goal not explained');
  if (!/about 4 years/.test(preview)) errors.push('multi-year timeline missing: ' + preview.slice(0, 300));
  if (!/One week in/.test(preview) || !/5% lighter/.test(preview)) errors.push('first stops missing from preview');
  const paces = await page.textContent('fieldset .options');
  if (!/goal in about \d years/.test(paces)) errors.push('pace cards lack year timeline');
  await snap('j2-plan');
  await page.click('button:has-text("Start my plan")');
  await page.waitForSelector('.journey-next');
  const card = await page.textContent('.journey-next');
  if (!/Next stop/.test(card) || !/5% lighter/.test(card) || !/to go/.test(card) || !/Before that: One week in · in 1 week/.test(card)) errors.push('Today journey card: ' + card);
  await snap('j3-today');

  await page.click('.journey-next');
  await page.waitForSelector('.roadmap');
  const stops = await page.$$eval('.rm-stop', (els) => els.map((e) => e.querySelector('strong').textContent));
  for (const t of ['One week in', 'One month', 'Six months', 'One year', '5% lighter', 'BMI under 40', 'BMI under 30', 'Healthy weight — your goal']) if (!stops.includes(t)) errors.push('missing stop: ' + t);
  if (!stops.some((t) => /^Year \d/.test(t))) errors.push('no yearly stops');
  if ((await page.locator('.rm-stop.next').count()) !== 1) errors.push('exactly one next stop expected');
  const hero = await page.textContent('.journey-hero');
  if (!/Estimated time to goal: 4 years/.test(hero)) errors.push('journey hero timeline: ' + hero.slice(0, 200));
  if (!/Steady · yours/.test(await page.textContent('body'))) errors.push('pace comparison missing');
  await snap('j4-journey');
  await snap('j4-journey-top', false);
  // Learn link
  await page.click('a[href="#/learn/journey"]');
  await page.waitForSelector('#learn-journey');

  // Progress links to the journey; settings shows the healthy range
  await page.goto(base + '#/progress');
  await page.waitForSelector('a[href="#/journey"]');
  await page.goto(base + '#/settings/profile');
  if (!/Healthy range for your height/.test(await page.textContent('main'))) errors.push('settings goal hint missing');

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('journey ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
