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
  // Today: rings hero with your body right under it, then one "Your day" timeline (meals, habits, movement together)
  await page.goto(base + '#/today');
  await page.waitForSelector('.tg-day');
  const order = await page.evaluate(() => [...document.querySelectorAll('main .section-head h2')].map((h) => h.textContent));
  if (order.indexOf('Your body this week') < 0 || order.indexOf('Your day') < order.indexOf('Your body this week')) errors.push('Today: your body should sit under the rings, before Your day — ' + order.join(' > '));
  const underRings = await page.evaluate(() => document.querySelector('.rings-hero')?.nextElementSibling?.textContent || '');
  if (!/Your body this week/.test(underRings)) errors.push('Today: the body rings should come straight after the day rings');
  if (order.includes('Food') || order.includes('Habits')) errors.push('Today still has separate Food/Habits sections: ' + order.join(' > '));
  if ((await page.locator('.rings-hero .day-rings-svg .rf').count()) !== 3) errors.push('Today: three day rings expected');
  if ((await page.locator('.tl-now').count()) !== 1) errors.push('Today: exactly one Now line expected');
  // Habits sit next to the meal their cue names ("After I finish lunch" right after lunch)
  const seq = await page.$$eval('.timeline-list > li', (els) => els.map((e) => e.className.includes('k-meal') ? 'meal:' + e.querySelector('.over').textContent : e.className.includes('k-habit') ? 'habit:' + e.querySelector('.title').textContent : e.className));
  const lunch = seq.findIndex((x) => /LUNCH|Lunch/.test(x));
  const walk = seq.findIndex((x) => /10-minute walk after a meal/.test(x));
  if (walk >= 0 && lunch >= 0 && walk < lunch) errors.push('after-lunch habit placed before lunch: ' + seq.join(' | '));
  // Ticking every meal closes the Eat ring and celebrates
  const eatBefore = await page.textContent('.ring-leg:nth-child(1)');
  for (let i = 0; i < 8; i++) {
    const open = page.locator('.tg-day button[data-action=mealCheck]:not(.on)');
    if (!(await open.count())) break;
    await open.first().click();
    await page.waitForTimeout(120);
    if (await page.locator('.sheet').count()) await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  const eatAfter = await page.textContent('.ring-leg:nth-child(1)');
  if (!/✓/.test(eatAfter)) errors.push(`Eat ring did not close: ${eatBefore} → ${eatAfter}`);
  if (!/ring closed/.test((await page.locator('.ring-banner').textContent().catch(() => '')) || '')) errors.push('no "ring closed" celebration');
  // No step tracking: the Move ring never mentions steps, and logged steps don't close it
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('habitlab.v1'));
    const d = new Date();
    const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    st.steps[t] = 50000;
    st.workouts.log[t] = [];
    localStorage.setItem('habitlab.v1', JSON.stringify(st));
  });
  await page.reload();
  await page.waitForSelector('.ring-leg');
  const moveLeg = await page.textContent('.ring-leg:nth-child(2)');
  if (/step/i.test(moveLeg)) errors.push('Move ring still shows steps: ' + moveLeg);
  if (!/Rest day/.test(moveLeg) && /✓/.test(moveLeg)) errors.push('steps closed the Move ring: ' + moveLeg);
  // Craving SOS: this morning's reasons, a short tool, how it feels after; never shows food
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('habitlab.v1'));
    const d = new Date();
    st.reasons = { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, values: ['family', 'Freedom'], other: '' };
    localStorage.setItem('habitlab.v1', JSON.stringify(st));
  });
  await page.goto(base + '#/today');
  await page.reload();
  await page.click('.quick-log a[href="#/sos"]');
  await page.waitForSelector('.sos-tools');
  if (!/This morning you said/.test(await page.textContent('.sos-hero')) || !/the people you love and freedom/.test(await page.textContent('.sos-hero'))) errors.push('SOS should show this morning’s reasons: ' + (await page.textContent('.sos-hero')));
  const sosText = (await page.textContent('main')).toLowerCase();
  for (const w of ['chocolate', 'pizza', 'sweets', 'crisps', 'soda', 'cake']) if (sosText.includes(w)) errors.push(`SOS screen mentions "${w}"`);
  if ((await page.locator('.sos-tool').count()) < 6) errors.push('SOS tools missing');
  await page.click('.sos-tool[data-tool=puzzle]');
  await page.waitForSelector('.sos-puzzle');
  if ((await page.locator('.sos-tile:not(.blank)').count()) !== 8) errors.push('puzzle tiles');
  const t1 = await page.textContent('[data-timer]');
  await page.waitForTimeout(1300);
  if ((await page.textContent('[data-timer]')) === t1) errors.push('SOS timer not counting down');
  await page.click('button[data-action=sosDone]');
  await page.click('button[data-action=sosResult][data-v=gone]');
  await page.waitForSelector('text=You rode it out');
  const cr = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('habitlab.v1')).cravings || {}).flat());
  if (!cr.some((c) => c.tool === 'puzzle' && c.result === 'gone')) errors.push('craving not logged: ' + JSON.stringify(cr));
  // Leaving and coming back starts fresh
  await page.goto(base + '#/today');
  await page.goto(base + '#/sos');
  await page.waitForSelector('.sos-tools');
  await page.goto(base + '#/today');
  await page.waitForSelector('.quick-log');

  // Quick log row: food, weight, workout
  if ((await page.locator('.quick-log .ql-btn').count()) < 3) errors.push('quick log missing');
  // Forgot to log yesterday: step back on Today, tick a meal and a habit → saved to yesterday, not today
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yday = ymd(new Date(Date.now() - 864e5));
  await page.evaluate((y) => {
    const st = JSON.parse(localStorage.getItem('habitlab.v1'));
    delete st.mealLog[y];
    delete st.habits.log[y];
    localStorage.setItem('habitlab.v1', JSON.stringify(st));
  }, yday);
  await page.goto(base + '#/today');
  await page.reload();
  await page.waitForSelector('.day-nav');
  await page.click('.day-nav a[aria-label="Previous day"]');
  await page.waitForSelector('.past-day');
  if (!/Yesterday/.test(await page.textContent('.day-nav-label'))) errors.push('day nav label: ' + (await page.textContent('.day-nav-label')));
  await page.click('.tg-day button[data-action=mealCheck] >> nth=0');
  await page.waitForTimeout(300);
  await page.click('.tg-day button[data-action=habitCheck] >> nth=0');
  await page.waitForTimeout(300);
  const back = await page.evaluate((y) => JSON.parse(localStorage.getItem('habitlab.v1')), yday);
  if (!Object.keys(back.mealLog[yday] || {}).length) errors.push('meal ticked on yesterday not saved to yesterday');
  if (!Object.keys(back.habits.log[yday] || {}).length) errors.push('habit ticked on yesterday not saved to yesterday');
  // Up to 7 days back; not into the future
  await page.goto(base + '#/today/' + ymd(new Date(Date.now() - 7 * 864e5)));
  // (wait for the new day to render — the previous past day's banner is already on screen)
  await page.waitForSelector('.day-nav [aria-label="Previous day"][aria-disabled=true]', { timeout: 5000 }).catch(() => errors.push('should stop at 7 days back'));
  await page.goto(base + '#/today/' + ymd(new Date(Date.now() + 864e5)));
  await page.waitForSelector('.tg-hero');
  if (await page.locator('.past-day').count()) errors.push('future date should show today');
  // Leaving Today resets: the weigh-in sheet elsewhere defaults to today
  await page.goto(base + '#/today/' + yday);
  await page.waitForSelector('.past-day');
  await page.goto(base + '#/progress');
  await page.goto(base + '#/today');
  await page.waitForSelector('.tg-hero');
  if (await page.locator('.past-day').count()) errors.push('Today should open on today again');

  // Lapsed user: nothing logged for 4 days → a kind welcome-back card, dismissible for today
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('habitlab.v1'));
    const cut = new Date(Date.now() - 4 * 864e5).toISOString().slice(0, 10);
    for (const m of [st.mealLog, st.habits.log, st.workouts.log]) for (const d of Object.keys(m)) if (d > cut) delete m[d];
    st.weights = st.weights.filter((w) => w.date <= cut);
    localStorage.setItem('habitlab.v1', JSON.stringify(st));
  });
  await page.reload();
  await page.waitForSelector('.tg-hero');
  if (!/Welcome back/.test((await page.locator('.welcome-back').textContent().catch(() => '')) || '')) errors.push('no welcome-back card after 4 days away');
  else {
    await page.click('[data-action=freshStart]');
    if (await page.locator('.welcome-back').count()) errors.push('welcome-back card did not dismiss');
  }
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
  // Week start: switch to Sunday and check every weekly view follows
  await page.goto(base + '#/settings/day');
  await page.waitForSelector('[data-change=weekStartSet]');
  await page.selectOption('[data-change=weekStartSet]', '6');
  await page.waitForSelector('.week-strip span.first:text-is("Sun")');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')));
  if (st.prefs.weekStart !== 6) errors.push('week start not saved');
  if (Number(st.reminders.checkinDay) !== 5) errors.push('check-in reminder should move to Saturday, got ' + st.reminders.checkinDay);
  if (shots) await page.screenshot({ path: `${shots}/flow-week.png` });
  await page.goto(base + '#/meals');
  await page.waitForSelector('.daytabs a');
  const dayTabs = await page.$$eval('.daytabs a', (as) => as.map((a) => a.textContent.slice(0, 3)));
  if (dayTabs[0] !== 'Sun' || dayTabs[6] !== 'Sat') errors.push('meal tabs order: ' + dayTabs.join(','));
  if ((await page.$$('.daytabs a.on')).length !== 1) errors.push('exactly one meal tab selected');
  await page.goto(base + '#/move');
  // Move: one list of this week's sessions (Start / Done / Move), no separate week strip
  await page.waitForSelector('.session-list');
  if (await page.locator('main .week').count()) errors.push('Move should not repeat the calendar as a week strip');
  if (!(await page.locator('.session-row a[href^="#/move/session/"], .session-row .tag').count())) errors.push('strength sessions should have Start (or show Done)');
  // Your own habit: make it (all 3 slots in use → saved under "Yours"), free a slot, start it,
  // tick it on Today, survive a reload, edit it; a second one can be deleted.
  await page.goto(base + '#/habits');
  await page.$eval('details.own-habit', (d) => (d.open = true));
  await page.fill('form[data-form=ownCreate] input[name=title]', 'Stretch my calves');
  await page.fill('form[data-form=ownCreate] input[name=cue]', 'brush my teeth');
  await page.fill('form[data-form=ownCreate] input[name=tiny]', 'One stretch');
  await page.click('form[data-form=ownCreate] button.primary');
  await page.waitForSelector('main li:has-text("Stretch my calves") .tag:has-text("yours")');
  if (!(await page.locator('main li:has-text("Stretch my calves"):has-text("After I brush my teeth")').count())) errors.push('own habit cue should read "After I brush my teeth"');
  await page.click('main .rows button[data-action=manage] >> nth=0');
  await page.click('.sheet button[data-action=remove]');
  await page.waitForSelector('.sheet-scrim', { state: 'detached' }).catch(() => {});
  await page.click('main li:has-text("Stretch my calves") button[data-action=add]');
  await page.waitForSelector('main .rows button[data-action=manage]:has-text("Stretch my calves")');
  await page.goto(base + '#/today');
  await page.click('.tg-day button[data-action=habitCheck][aria-label="Stretch my calves"]');
  await page.reload();
  await page.waitForSelector('.tg-day button[data-action=habitCheck][aria-label="Stretch my calves"][aria-pressed=true]').catch(() => errors.push('own habit tick should be saved on Today'));
  await page.goto(base + '#/habits');
  await page.click('main .rows button[data-action=manage]:has-text("Stretch my calves")');
  await page.click('.sheet details summary:has-text("Edit your habit")');
  await page.fill('.sheet form[data-form=ownSave] input[name=title]', 'Stretch my calves and hips');
  await page.click('.sheet form[data-form=ownSave] button');
  await page.waitForSelector('.sheet h2:has-text("Stretch my calves and hips")');
  await page.click('.sheet [data-action=sheetClose]');
  await page.waitForSelector('.sheet-scrim', { state: 'detached' }).catch(() => {});
  await page.$eval('details.own-habit', (d) => (d.open = true));
  await page.fill('form[data-form=ownCreate] input[name=title]', 'Floss');
  await page.fill('form[data-form=ownCreate] input[name=cue]', 'When I brush my teeth at night');
  await page.click('form[data-form=ownCreate] button.primary');
  await page.waitForSelector('main li:has-text("Floss") .tag:has-text("yours")');
  if (!(await page.locator('main li:has-text("Floss"):has-text("When I brush my teeth at night")').count())) errors.push('a cue starting with "When" should read as written');
  await page.click('main li:has-text("Floss") button[data-action=ownDelete]');
  await page.click('.modal-wrap button >> nth=-1').catch(() => {});
  await page.waitForTimeout(300);
  if (await page.locator('main li:has-text("Floss")').count()) errors.push('deleting your own habit should remove it');
  // All 3 slots full: "Swap in" trades a current habit for the new one (no dead Add button)
  await page.$eval('details.own-habit', (d) => (d.open = true));
  await page.fill('form[data-form=ownCreate] input[name=title]', 'Drink water');
  await page.fill('form[data-form=ownCreate] input[name=cue]', 'pour my coffee');
  await page.click('form[data-form=ownCreate] button.primary');
  await page.waitForSelector('main li:has-text("Drink water") button[data-action=add]:not([disabled])').catch(() => errors.push('with all slots full, Add should still work (Swap in)'));
  const activeBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).habits.active.map((a) => a.id));
  await page.click('main li:has-text("Drink water") button[data-action=add]');
  await page.waitForSelector('.sheet button[data-action=swapHabit]');
  const outId = await page.getAttribute('.sheet button[data-action=swapHabit] >> nth=0', 'data-out');
  await page.click('.sheet button[data-action=swapHabit] >> nth=0');
  await page.waitForSelector('main .rows button[data-action=manage]:has-text("Drink water")').catch(() => errors.push('Swap in should make the new habit active'));
  const activeAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).habits.active.map((a) => a.id));
  if (activeAfter.length !== activeBefore.length || activeAfter.includes(outId)) errors.push('swap should replace the chosen habit: ' + activeAfter.join(','));
  // Undo the swap so the checks below see the habits they expect
  await page.click('.toast button:has-text("Undo")').catch(() => {});
  await page.waitForTimeout(300);
  await page.click('main li:has-text("Drink water") button[data-action=ownDelete]');
  await page.click('.modal-wrap button >> nth=-1').catch(() => {});
  await page.waitForTimeout(300);
  const own = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).habits.own.map((h) => h.title));
  if (own.join('|') !== 'Stretch my calves and hips') errors.push('own habits saved: ' + own.join('|'));
  await page.goto(base + '#/wrap');
  await page.waitForSelector('.wrap-story');
  for (let k = 0; k < 15 && (await page.locator('.w-tap.right').count()); k++) await page.keyboard.press('ArrowRight');
  // Mid-week the wrap is partial ("come back Sunday"); on the week's last day (Saturday) it's complete.
  const lastDayOfWeek = new Date().getDay() === 6;
  const wrapText = await page.textContent('.wrap-story');
  if (lastDayOfWeek ? /Come back Sunday/.test(wrapText) : !/Come back Sunday/.test(wrapText)) errors.push(`wrap on ${lastDayOfWeek ? 'the last day should be complete' : 'a mid-week day should say come back Sunday'}`);
  await page.keyboard.press('Escape');
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
