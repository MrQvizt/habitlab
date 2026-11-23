// End-to-end walkthrough: onboarding → every page → check-in. Fails on any console error.
// Usage: node tests/e2e.cjs [baseUrl] [screenshotDir]
const { chromium } = require('playwright');
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
  await page.click('.tg-food button[data-action=mealCheck] >> nth=0');
  await page.waitForSelector('.toast.show >> text=Meal logged');
  await page.click('.toast button:has-text("Undo")');
  if (await page.locator('.tg-food button[data-action=mealCheck].on').count()) errors.push('undo did not clear the meal tick');
  await page.click('.tg-food button[data-action=mealCheck] >> nth=0');
  // Meal sheet: swap, then "something else" with quick chips
  await page.click('.tg-food button[data-action=openMeal] >> nth=1');
  await page.waitForSelector('.sheet.open');
  await page.click('.sheet button:has-text("Swap")');
  await page.waitForSelector('.toast.show >> text=Swapped for');
  await page.click('.sheet button:has-text("Something else")');
  await page.click('.sheet .quick-chips button:has-text("700")');
  await page.click('.sheet button:has-text("Save")');
  await page.waitForSelector('text=Something else · 700 kcal');
  // Escape closes a sheet
  await page.click('.tg-food button[data-action=openMeal] >> nth=2');
  await page.waitForSelector('.sheet.open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (await page.locator('.sheet').count()) errors.push('Escape did not close the sheet');
  // Habit row + steps sheet
  await page.click('button[data-action=habitCheck] >> nth=0');
  await page.click('button[data-action=openSteps]');
  await page.fill('.sheet input[name=steps]', '5200');
  await page.click('.sheet button:has-text("Save steps")');
  await page.waitForSelector('text=5,200 steps');

  for (const route of ['meals', 'shopping', 'move', 'habits', 'progress', 'learn', 'settings', 'checkin']) {
    await page.goto(base + '#/' + route);
    await page.waitForTimeout(250);
    await snap('05-' + route);
  }
  // Regular activity: add one for today, see it planned, log it, check XP/quest credit
  const todayIdx = await page.evaluate(() => (new Date().getDay() + 6) % 7);
  const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][todayIdx];
  await page.goto(base + '#/move');
  await page.click('button:has-text("Add an activity you already do")');
  await page.fill('form[data-form=addActivity] input[name=name]', 'Walking with friends');
  await page.click(`form[data-form=addActivity] label.chip:has-text("${dayName}")`);
  await page.click('form[data-form=addActivity] button.primary');
  await page.waitForSelector('#activities >> text=Walking with friends');
  await page.goto(base + '#/today');
  await page.click('button[data-action=activityDone]');
  await page.waitForSelector('text=Walking with friends logged');
  await page.goto(base + '#/move');
  await page.selectOption('form[data-form=logCardio] select[name=mode]', 'other');
  await page.fill('form[data-form=logCardio] input[name=name]', 'Padel');
  await page.fill('form[data-form=logCardio] input[name=minutes]', '40');
  await page.click('form[data-form=logCardio] button.primary');
  await page.waitForSelector('text=40 minutes logged');
  await snap('09-move-activities');
  const savedAct = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).profile.activities[0]);
  if (savedAct.strength) errors.push('unticked "builds strength" was saved as true');

  // Regression: saving Settings → About you must not switch on habits-only mode (single checkbox read as [])
  await page.goto(base + '#/settings');
  await page.click('form[data-form=profile] button.primary');
  await page.waitForTimeout(200);
  const ho = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).profile.habitsOnly);
  if (ho) errors.push('saving profile turned on habits-only mode');

  // Strength session
  await page.goto(base + '#/move/session/A');
  await page.waitForSelector('text=Finish session');
  await page.click('button:has-text("Too easy") >> nth=0');
  await page.click('button:has-text("Finish session")');
  await page.waitForSelector('text=Week plan');
  // Check-in
  await page.goto(base + '#/checkin');
  await page.click('button:has-text("See my adjustments")');
  await page.waitForSelector('text=Apply selected');
  await snap('06-checkin-results');
  await page.click('button:has-text("Apply selected")');
  await page.waitForSelector('text=Add something else you ate');

  // Backup export shows a copyable box; reset uses the in-page dialog (cancel keeps data)
  await page.goto(base + '#/settings');
  await page.click('button:has-text("Export backup")');
  await page.waitForSelector('#backup-out');
  await page.click('button:has-text("Delete everything")');
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
    await page.goto(base + '#/settings');
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
