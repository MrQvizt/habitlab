// End-to-end walkthrough: onboarding → every page → check-in. Fails on any console error.
// Usage: node tests/e2e.cjs [baseUrl] [screenshotDir]
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  
  let celebrations = 0;
  await page.addLocatorHandler(page.locator('.celebrate-modal'), async () => {
    celebrations++;
    await page.click('.celebrate-modal button');
  });
  const snap = async (name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

  await page.goto(base);
  await page.waitForSelector('text=Get started');
  await snap('01-welcome');
  await page.click('text=Get started');
  // About you
  await page.click('label.chip:has-text("Female")');
  await page.fill('input[name=age]', '44');
  await page.fill('input[name=heightCm]', '165');
  await page.fill('input[name=weight]', '108');
  await page.fill('input[name=goal]', '85');
  await snap('02-about');
  await page.click('button:has-text("Continue")');
  // Health
  await page.click('label.chip:has-text("Knees")');
  await page.click('button:has-text("Continue")');
  // Food
  await page.click('label.chip:has-text("Vegetarian")');
  await page.click('label.chip:has-text("Peanuts")');
  await page.click('button:has-text("Continue")');
  // Movement
  await page.click('label.chip:has-text("Resistance bands")');
  await page.click('button:has-text("Continue")');
  // Habits
  await page.click('label.chip:has-text("Evening snacking")');
  await page.click('button:has-text("Continue")');
  // Plan
  await page.waitForSelector('text=Choose your pace');
  await snap('03-plan');
  await page.click('button:has-text("Start my plan")');
  await page.waitForSelector('text=Add something else you ate');
  await snap('04-today');

  // Interact on Today: weigh-in sheet with stepper
  await page.click('button[data-action=openWeigh] >> nth=0');
  await page.click('.sheet button[data-action=sheetStep][data-d^="-"]');
  await page.click('.sheet button:has-text("Save weigh-in")');
  await page.waitForSelector('text=Weigh-in saved');
  // Quick tick + Undo
  await page.click('.tg-day button[data-action=mealCheck] >> nth=0');
  await page.waitForSelector('.toast.show >> text=Meal logged');
  await page.click('.toast button:has-text("Undo")');
  if (await page.locator('.tg-day button[data-action=mealCheck].on').count()) errors.push('undo did not clear the meal tick');
  await page.click('.tg-day button[data-action=mealCheck] >> nth=0');
  // Meal sheet: swap, then "something else" with quick chips
  await page.click('.tg-day button[data-action=openMeal] >> nth=1');
  await page.waitForSelector('.sheet.open');
  await page.click('.sheet button:has-text("Swap")');
  await page.waitForSelector('.toast.show >> text=Swapped for');
  await page.click('.sheet button:has-text("Something else")');
  await page.click('.sheet .quick-chips button:has-text("700")');
  await page.click('.sheet button:has-text("Save")');
  await page.waitForSelector('text=Something else · 700 kcal');
  // Off-plan meal from the food database: sausages + a side salad, totals and protein tracked
  await page.click('.tg-day button[data-action=openMeal] >> nth=1');
  await page.waitForSelector('.sheet.open');
  await page.click('.sheet button:has-text("Something else")');
  // Nothing tempting is put in front of you: no treats or drinks shown until you search for them
  const before = (await page.textContent('.sheet .food-picker')).toLowerCase();
  for (const w of ['pizza', 'fries', 'beer', 'wine', 'dessert', 'soft drink', 'chocolate', 'crisps', 'sweets', 'cake', 'onion rings']) if (before.includes(w)) errors.push(`food picker shows "${w}" before searching`);
  await page.fill('.sheet [data-food-search]', 'fries');
  if (!(await page.locator('.sheet .food-hit:has-text("Fries (small)")').count())) errors.push('fries not findable by search');
  // Everyday foods: fruit like kiwi and dairy like kefir, plural or typed without accents
  for (const [q, name] of [['kiwis', 'Kiwi'], ['kefir', 'Kefir (glass)'], ['creme fraiche', 'Sour cream / crème fraîche (2 tbsp)']]) {
    await page.fill('.sheet [data-food-search]', q);
    if (!(await page.locator(`.sheet .food-hit:has-text("${name}")`).count())) errors.push(`${q}: ${name} not found`);
  }
  await page.fill('.sheet [data-food-search]', 'sausages');
  await page.click('.sheet .food-hit:has-text("Sausages (2)")');
  await page.click('.sheet .side-chip:has-text("Side salad (no dressing)")');
  await page.waitForSelector('.sheet .food-total');
  if (!/385 kcal/.test(await page.textContent('.sheet .food-total'))) errors.push('picked total: ' + (await page.textContent('.sheet .food-total')));
  if ((await page.inputValue('.sheet input[name=kcal]')) !== '385') errors.push('kcal not filled from picks');
  await page.click('.sheet button:has-text("Save")');
  await page.waitForSelector('text=Sausages (2) + Side salad (no dressing) · 385 kcal');
  // Add an extra snack from the database
  await page.click('button[data-action=openExtra] >> nth=0');
  await page.fill('.sheet [data-food-search]', 'latte');
  await page.click('.sheet .food-hit:has-text("Latte")');
  await page.click('.sheet button:has-text("Add")');
  await page.waitForSelector('.tg-day .k-extra:has-text("Latte")');
  // A logged kiwi counts toward today's fibre
  const fibreNow = async () => Number(((await page.textContent('.meter-legend')).match(/Fibre (\d+)/) || [])[1]);
  const fibBefore = await fibreNow();
  await page.click('button[data-action=openExtra] >> nth=0');
  await page.fill('.sheet [data-food-search]', 'kiwi');
  await page.click('.sheet .food-hit:has-text("Kiwi")');
  await page.click('.sheet button:has-text("Add")');
  await page.waitForSelector('.tg-day .k-extra:has-text("Kiwi")');
  if ((await fibreNow()) !== fibBefore + 2) errors.push(`kiwi should add 2 g fibre: ${fibBefore} → ${await fibreNow()}`);
  const fd = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')));
  const tdy = Object.keys(fd.extras).sort().at(-1);
  if (!(fd.extras[tdy].find((x) => x.label === 'Latte')?.p > 0)) errors.push('extra protein not stored');
  // It's placed in the day's timeline at the time you had it, not hidden under "Any time"
  const latte = fd.extras[tdy].find((x) => x.label === 'Latte');
  if (!/^\d{2}:\d{2}$/.test(latte?.at || '')) errors.push('extra time not stored: ' + JSON.stringify(latte));
  const order = await page.$$eval('.timeline-list > li', (els) => els.map((e) => e.className));
  const iLatte = order.findIndex((c) => c.includes('k-extra'));
  const iAny = (await page.$$eval('.timeline-list > li', (els) => els.map((e) => e.textContent))).findIndex((t) => t === 'Any time today');
  if (iLatte < 0 || iAny < 0 || iLatte > iAny) errors.push('added food not in the timeline');
  // Escape closes a sheet
  await page.click('.tg-day button[data-action=openMeal] >> nth=2');
  await page.waitForSelector('.sheet.open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (await page.locator('.sheet').count()) errors.push('Escape did not close the sheet');
  // Small win: add the sugary-drinks habit, log a smaller level, then upgrade to full with the check
  await page.goto(base + '#/habits');
  await page.click('button[aria-label="Add Drink water instead of sugary drinks"]');
  await page.goto(base + '#/today');
  await page.waitForSelector('.tg-day button[data-action=openSmallWin]');
  await page.click('.tg-day button[data-action=openSmallWin] >> nth=0');
  await page.waitForSelector('.sheet.open .level-opt');
  await page.click('.sheet .level-opt >> nth=0');
  await page.waitForSelector('.toast.show >> text=Small win!');
  await page.waitForSelector('.tg-day .check.partial');
  await page.click('.tg-day .check.partial');
  await page.waitForTimeout(300);
  if (await page.locator('.tg-day .check.partial').count()) errors.push('check did not upgrade small win to full');
  // Habit row; step tracking was removed — nothing on Today asks for steps
  await page.click('button[data-action=habitCheck] >> nth=0');
  if (await page.locator('[data-action=openSteps]').count()) errors.push('steps are still offered on Today');
  if (/steps/i.test(await page.textContent('.tg-day'))) errors.push('Today still mentions steps');

  for (const route of ['meals', 'shopping', 'move', 'habits', 'progress', 'learn', 'settings', 'checkin']) {
    await page.goto(base + '#/' + route);
    await page.waitForTimeout(250);
    await snap('05-' + route);
  }
  // Your day: set times, then meals on Today are in time order and end by the kitchen-closed time
  await page.goto(base + '#/settings/day');
  await page.fill('form[data-form=daySave] input[name=wake]', '06:00');
  await page.fill('form[data-form=daySave] input[name=bed]', '22:00');
  await page.fill('form[data-form=daySave] input[name=firstMeal]', '06:30');
  await page.fill('form[data-form=daySave] input[name=lastMeal]', '19:00');
  await page.waitForSelector('text=Kitchen closes 19:00');
  await page.click('form[data-form=daySave] button.primary');
  await page.waitForSelector('text=Your day is saved');
  await page.goto(base + '#/today');
  await page.waitForSelector('.tg-day .meal-time');
  const times = await page.$$eval('.tg-day .meal-time', (els) => els.map((e) => e.textContent.trim()));
  if (times.join() !== [...times].sort().join()) errors.push('meals not in time order: ' + times.join(', '));
  if (times[0] !== '06:30' || times[times.length - 1] !== '19:00') errors.push('timeline does not match the eating window: ' + times.join(', '));

  let savedActId;
  // Regular activity: add one for today, see it planned, log it, check XP/quest credit
  const todayIdx = await page.evaluate(() => (new Date().getDay() + 6) % 7);
  const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][todayIdx];
  await page.goto(base + '#/move');
  await page.click('button:has-text("Add an activity you already do")');
  await snap('09-activity-picker');
  // Search the catalogue: "scuba" leaves Scuba diving (vigorous) visible
  await page.fill('input[data-filter=hobby]', 'scuba');
  const visible = await page.$$eval('.hobby-btn:not([hidden]):not(.custom)', (els) => els.map((e) => e.textContent));
  if (visible.length < 2 || !/Scuba diving/.test(visible[0]) || !/Vigorous/.test(visible[0])) errors.push('hobby search failed: ' + visible.join(' | '));
  // Search covers all 300+ activities, not just the Popular tab; clearing it restores the tab.
  await page.fill('input[data-filter=hobby]', 'kendo');
  if ((await page.$$('.hobby-btn:not([hidden]):not(.custom)')).length !== 1) errors.push('search did not reach outside the Popular tab');
  // Everyday words: "cardio" finds the generic cardio levels and the machines
  await page.fill('input[data-filter=hobby]', 'cardio');
  const cardio = await page.$$eval('.hobby-btn:not([hidden]):not(.custom)', (els) => els.sort((a, b) => (Number(a.style.order) || 0) - (Number(b.style.order) || 0)).map((e) => e.querySelector('span').textContent));
  if (cardio[0] !== 'Cardio') errors.push('plain Cardio should be the first hit: ' + cardio[0]);
  for (const n of ['Cardio (moderate)', 'Elliptical trainer', 'Rowing machine']) if (!cardio.includes(n)) errors.push(`"cardio" search misses ${n}`);
  await page.fill('input[data-filter=hobby]', '');
  const popCount = (await page.$$('.hobby-btn:not([hidden]):not(.custom)')).length;
  if (popCount < 12 || popCount > 40) errors.push('Popular tab not restored: ' + popCount);
  await page.click('[data-action=hobbyCat][data-value=garden]');
  if ((await page.$$('.hobby-btn:not([hidden]):not(.custom)')).length < 20) errors.push('garden tab too small');
  if ((await page.$$('.hobby-btn')).length < 200) errors.push('fewer than 200 activities in the picker');
  await page.fill('input[data-filter=hobby]', 'walking with');
  await page.click('.hobby-btn:has-text("Walking with friends")');
  if ((await page.inputValue('form[data-form=addActivity] input[name=name]')) !== 'Walking with friends') errors.push('picked hobby not prefilled');
  await page.click(`form[data-form=addActivity] label.chip:has-text("${dayName}")`);
  await page.click('form[data-form=addActivity] button.primary');
  await page.waitForSelector('#activities >> text=Walking with friends');
  await page.goto(base + '#/today');
  // Completing it asks how long and how hard
  await page.click('button[data-action=activityDone]');
  await page.waitForSelector('.sheet form[data-form=activityDoneSave]');
  await page.click('.sheet button[data-action=sheetQuickMin][data-v="45"]');
  await page.click('.sheet .int-opt:has-text("Vigorous")');
  await page.click('.sheet button:has-text("Save")');
  await page.waitForSelector('text=Walking with friends logged — 45 min, vigorous');
  const actLog = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('habitlab.v1')).workouts.log).flat().find((x) => x.name === 'Walking with friends'));
  if (actLog?.minutes !== 45 || actLog?.intensity !== 'vigorous') errors.push('activity time/intensity not saved: ' + JSON.stringify(actLog));
  // Re-plan: move today's walk to another day from this week's sessions
  await page.goto(base + '#/move');
  await page.click(`.session-list button[data-action=openMoveItem][data-key="activity:${savedActId = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).profile.activities[0].id)}"]`);
  await page.waitForSelector('.sheet .move-days');
  const target = (todayIdx + 1) % 7;
  await page.click(`.sheet .move-day[data-to="${target}"]`);
  await page.waitForSelector(`text=Moved to`);
  const moves = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).workouts.moves);
  if (!Object.values(moves).flat().some((m) => m.to === target)) errors.push('move not saved: ' + JSON.stringify(moves));
  await page.click(`.session-row:has-text("moved") button[data-action=openMoveItem]`);
  await page.click('.sheet button[data-action=moveItemReset]');
  await page.waitForSelector('text=Back on its planned day');
  await page.goto(base + '#/move');
  await page.selectOption('form[data-form=logCardio] select[name=mode]', 'other');
  // Our own suggestions (not the phone's see-through autocomplete pop-up)
  if (await page.locator('form[data-form=logCardio] input[list]').count()) errors.push('activity box still uses the native autocomplete list');
  await page.type('form[data-form=logCardio] input[name=name]', 'pa');
  await page.waitForSelector('.hobby-suggest button');
  await page.click('.hobby-suggest button:has-text("Padel")');
  if ((await page.inputValue('form[data-form=logCardio] input[name=name]')) !== 'Padel') errors.push('suggestion not filled in');
  await page.fill('form[data-form=logCardio] input[name=name]', 'Padel');
  await page.fill('form[data-form=logCardio] input[name=minutes]', '40');
  await page.click('form[data-form=logCardio] button.primary');
  await page.waitForSelector('text=40 minutes logged');
  await snap('09-move-activities');
  const savedAct = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).profile.activities[0]);
  if (savedAct.strength) errors.push('unticked "builds strength" was saved as true');

  // Regression: saving Settings → About you must not switch on habits-only mode (single checkbox read as [])
  await page.goto(base + '#/settings/profile');
  await page.click('form[data-form=profile] button.primary');
  await page.waitForTimeout(200);
  const ho = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).profile.habitsOnly);
  if (ho) errors.push('saving profile turned on habits-only mode');

  // Strength session
  await page.goto(base + '#/move/session/A');
  await page.waitForSelector('text=Finish session');
  // Sets and timers: a rep set starts the rest timer; a timed set counts down, then rest
  const firstReps = page.locator('.set-row button[data-action=setDone]').first();
  if (await firstReps.count()) {
    await firstReps.click();
    await page.waitForSelector('.set-timer.rest').catch(() => errors.push('a finished set should start the rest timer'));
    if (!/Rest/.test(await page.textContent('.set-timer'))) errors.push('rest timer should say Rest');
    await page.click('.set-timer button[data-action=timerAdd][data-s="15"]');
    await page.click('.set-timer button[data-action=timerSkip]');
    await page.waitForTimeout(300);
    if ((await page.locator('.exercise .st-dot.on').count()) < 1) errors.push('the set should be ticked off');
  }
  const firstTimed = page.locator('.set-row button[data-action=setStart]').first();
  if (await firstTimed.count()) {
    await firstTimed.click();
    await page.waitForSelector('.set-timer.work').catch(() => errors.push('a timed set should start counting down'));
    const c1 = await page.textContent('.st-clock');
    await page.waitForTimeout(1300);
    if ((await page.textContent('.st-clock')) === c1) errors.push('the set timer should count down');
    await page.click('.set-timer button[data-action=timerSkip]');
    await page.waitForSelector('.set-timer.rest').catch(() => errors.push('after a timed set, rest should start'));
    await page.click('.set-timer button[data-action=timerStop]');
  }
  if (await page.locator('.set-timer').count()) errors.push('stopping should hide the timer');
  // Warm-up and cool-down are interactive: tick steps (did some), did it all, or skip
  await page.click('.routine-item[data-part=warm] >> nth=0');
  if (!(await page.locator('.routine:has(.routine-item[data-part=warm]) .tag:has-text("Did some")').count())) errors.push('ticking one warm-up step should say Did some');
  await page.click('button[data-action=routineAll][data-part=cool]');
  if (!(await page.locator('.routine:has(.routine-item[data-part=cool]) .tag:has-text("Did it")').count())) errors.push('Did it all should mark the cool-down done');
  await page.click('button:has-text("Too easy") >> nth=0');
  await page.click('button:has-text("Finish session")');
  await page.waitForSelector('.session-list');
  const strengthLog = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('habitlab.v1')).workouts.log).flat().filter((x) => x.kind === 'strength').pop());
  if (strengthLog?.warmup !== 'some' || strengthLog?.cooldown !== 'done') errors.push('warm-up / cool-down not saved with the session: ' + JSON.stringify(strengthLog));
  // The finished session is ticked off in this week's sessions, whichever day it was planned for
  if (!(await page.locator('.session-row.is-done:has-text("Strength session A")').count())) errors.push('finished Strength A should show as done in this week’s sessions');
  // Check-in
  await page.goto(base + '#/checkin');
  await answerCheckin(page);
  await page.click('button:has-text("See my adjustments")');
  await page.waitForSelector('text=Apply selected');
  await snap('06-checkin-results');
  await page.click('button:has-text("Apply selected")');
  await page.waitForSelector('text=Add something else you ate');

  // Backup export shows a copyable box; reset uses the in-page dialog (cancel keeps data)
  await page.goto(base + '#/settings/data');
  await page.click('button:has-text("Export backup")');
  await page.waitForSelector('#backup-out');
  await page.click('button:has-text("Delete all data")');
  await page.click('.modal button:has-text("Cancel")');
  await page.goto(base + '#/today');
  await page.waitForSelector('text=Add something else you ate');

  // Desktop layout
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + '#/today');
  await page.waitForTimeout(250);
  await snap('07-desktop-today');
  // No horizontal scroll on mobile
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of ['today', 'meals', 'move', 'habits', 'progress', 'settings']) {
    await page.goto(base + '#/' + route);
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) errors.push(`horizontal overflow ${over}px on ${route}`);
  }
  // Reminders: enable with permission granted → reminders scheduled
  // (Browsers can't grant notification permission to file:// pages, so only test this over http.)
  if (base.startsWith('http')) {
    await page.context().grantPermissions(['notifications'], { origin: new URL(base).origin });
    await page.goto(base + '#/settings/reminders');
    await page.waitForSelector('form[data-form=reminders]');
    await page.evaluate(() => document.querySelector('form[data-form=reminders] input[name=enabled]').closest('label').scrollIntoView({ block: 'center' }));
    await page.check('form[data-form=reminders] input[name=enabled]');
    await page.evaluate(() => document.querySelector('form[data-form=reminders] button.primary').scrollIntoView({ block: 'center' }));
    await page.click('form[data-form=reminders] button.primary');
    await page.waitForSelector('text=/On — \\d+ reminders scheduled/');
  }
  // Gamification: XP chip present, rewards page renders, at least one celebration (level 2) happened.
  await page.goto(base + '#/rewards');
  await page.waitForSelector('text=Badges');
  if (!(await page.locator('.xp-chip').count())) errors.push('missing XP chip');
  if (!celebrations) errors.push('expected a level-up/badge celebration');
  await snap('08-rewards');
  await browser.close();
  if (errors.length) {
    console.error('ERRORS:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('e2e ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
