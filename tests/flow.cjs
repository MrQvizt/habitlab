// Navigation audit: every screen is reachable from a tab within two taps, the long-term
// features hang off Progress, and screens without a tab light up the tab they belong to.
// Usage: node tests/flow.cjs [baseUrl] [screenshotDir]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8765/';
const shots = process.argv[3] || null;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.click('text=Explore with demo data first');
  await page.waitForSelector('.tg-hero');
  await page.addLocatorHandler(page.locator('.modal-wrap'), async () => page.click('.modal-wrap button >> nth=-1'));
  const tabs = ['today', 'meals', 'move', 'habits', 'progress'];
  const linksOf = async (route) => {
    await page.goto(base + '#/' + route);
    await page.waitForTimeout(300);
    return page.evaluate(() => [...new Set([...document.querySelectorAll('main a[href^="#/"]')].map((a) => a.getAttribute('href').slice(2).split('/')[0]))]);
  };
  const one = new Set(tabs);
  for (const t of tabs) for (const l of await linksOf(t)) one.add(l);
  const two = new Set(one);
  for (const r of [...one]) if (!tabs.includes(r) && !['wrap', 'wake', 'learn'].includes(r)) for (const l of await linksOf(r)) two.add(l);
  for (const r of ['journey', 'body', 'rewards', 'checkin', 'learn', 'wrap', 'shopping', 'settings']) if (!two.has(r)) errors.push(`${r} is more than two taps from a tab`);
  const prog = await linksOf('progress');
  for (const r of ['journey', 'body', 'rewards', 'checkin', 'learn', 'wrap']) if (!prog.includes(r)) errors.push(`Progress hub does not link to ${r}`);
  // Tab highlighting for screens without their own tab
  for (const [route, tab] of [['journey', 'progress'], ['body', 'progress'], ['rewards', 'progress'], ['learn', 'progress'], ['shopping', 'meals']]) {
    await page.goto(base + '#/' + route);
    await page.waitForTimeout(200);
    const active = await page.evaluate(() => document.querySelector('.bottomnav a.active')?.getAttribute('href'));
    if (active !== '#/' + tab) errors.push(`${route}: expected ${tab} tab active, got ${active}`);
  }
  // Today: daily actions come before reflection cards
  await page.goto(base + '#/today');
  await page.waitForSelector('.tg-rest');
  const order = await page.evaluate(() => [...document.querySelectorAll('.tg-rest .section-head h2')].map((h) => h.textContent));
  if (order.indexOf('Habits') > order.indexOf('Your body this week')) errors.push('Today: habits should come before the body rings — ' + order.join(' > '));
  // One long-term meter per body part: Rewards shows levels (no separate medal counts)
  await page.goto(base + '#/rewards');
  await page.waitForSelector('.medal-wall');
  if (!/Body levels/.test(await page.textContent('main'))) errors.push('Rewards should show body levels');
  if (/to gold|to silver/.test(await page.textContent('main'))) errors.push('old medal counts still shown');
  // Progress: no duplicate milestones card; hub first
  await page.goto(base + '#/progress');
  await page.waitForSelector('.hub-grid');
  if (await page.locator('main h2:text-is("Milestones")').count()) errors.push('duplicate Milestones card on Progress');
  if (shots) await page.screenshot({ path: `${shots}/flow-progress.png`, fullPage: true });
  // Only last week's wrap is collectable; older wraps are view-only
  const older = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 14); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await page.goto(base + '#/wrap/' + older);
  await page.waitForSelector('.wrap-story');
  for (let k = 0; k < 15 && (await page.locator('.w-tap.right').count()); k++) await page.keyboard.press('ArrowRight');
  if (await page.locator('[data-action=wrapClaim]').count()) errors.push('an older wrap offers XP');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.tg-hero');
  // Settings: day, alarms and reminders sit together and point at each other
  await page.goto(base + '#/settings');
  await page.waitForSelector('main a[href="#/settings/profile"]');
  const hubOrder = await page.evaluate(() => [...document.querySelectorAll('main a[href^="#/settings/"]')].map((a) => a.getAttribute('href').split('/').pop()));
  const i = (k) => hubOrder.indexOf(k);
  if (!(i('alarms') === i('day') + 1 && i('reminders') === i('alarms') + 1)) errors.push('settings order: ' + hubOrder.join(','));
  if (!(await linksOf('settings/reminders')).includes('settings')) errors.push('reminders page');
  await page.goto(base + '#/settings/reminders');
  await page.waitForSelector('form[data-form=reminders]');
  if (!(await page.locator('main a[href="#/settings/alarms"]').count())) errors.push('Reminders should point to Alarms');
  await page.goto(base + '#/settings/alarms');
  await page.waitForSelector('.al-time');
  if (!(await page.locator('main a[href="#/settings/reminders"]').count())) errors.push('Alarms should point to Reminders');
  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('flow ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
