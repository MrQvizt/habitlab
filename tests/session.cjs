// Strength session drafts: progress is kept when you leave or close the app; leaving asks whether
// you're done; coming back offers to continue or start fresh. Usage: node tests/session.cjs [baseUrl]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8771/';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.click('text=Explore with demo data first');
  await page.waitForSelector('.tg-hero');
  await page.addLocatorHandler(page.locator('.modal-wrap'), async () => page.click('.modal-wrap button >> nth=-1'));
  const draft = () => page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.sessionDraft') || 'null'));
  const strengthLogs = () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('habitlab.v1')).workouts.log).flat().filter((x) => x.kind === 'strength').length);

  // Make some progress: rate one exercise, finish a set, tick a warm-up step
  await page.goto(base + '#/move/session/A');
  await page.waitForSelector('.exercise');
  await page.click('.exercise >> nth=0 >> button[data-action=rate][data-value=right]');
  const setBtn = page.locator('.set-row button[data-action=setDone]').first();
  if (await setBtn.count()) await setBtn.click();
  if (await page.locator('.set-timer').count()) await page.click('.set-timer button[data-action=timerStop]');
  await page.click('.routine-item[data-part=warm] >> nth=0');
  const d1 = await draft();
  if (!d1 || d1.variant !== 'A' || !Object.keys(d1.ratings).length) errors.push('progress should be saved as a draft as you go: ' + JSON.stringify(d1));

  // Leaving by a tab asks whether you're done or will continue later
  await page.click('.bottomnav a[href="#/today"]');
  await page.waitForSelector('.sheet h2:has-text("You’ve made progress")').catch(() => errors.push('leaving with progress should ask'));
  if (!(await page.evaluate(() => location.hash)).startsWith('#/move/session')) errors.push('should stay on the session until you choose');
  await page.click('.sheet button[data-action=leaveLater]');
  await page.waitForFunction(() => location.hash === '#/today');

  // Close and reopen the app: Move offers to continue; the session offers continue / start fresh
  await page.reload();
  await page.goto(base + '#/move');
  await page.waitForSelector('.session-list');
  if (!(await page.locator('.session-row a[href="#/move/session/A"]:has-text("Continue")').count())) errors.push('Move should say Continue for a saved session');
  await page.goto(base + '#/move/session/A');
  await page.waitForSelector('.draft-card').catch(() => errors.push('the session should offer to continue'));
  await page.click('.draft-card button[data-action=draftContinue]');
  await page.waitForTimeout(200);
  if (!(await page.locator('.exercise >> nth=0 >> button[data-action=rate][data-value=right][aria-pressed=true]').count())) errors.push('Continue should bring back the rating');
  if (!(await page.locator('.routine-item[data-part=warm][aria-pressed=true]').count())) errors.push('Continue should bring back the warm-up ticks');

  // The back button keeps the draft too
  await page.goto(base + '#/move');
  await page.waitForSelector('.toast.show >> text=Your session is saved').catch(() => errors.push('leaving by back should say the session is saved'));
  if (!(await draft())) errors.push('back should keep the draft');

  // Start fresh clears it
  await page.goto(base + '#/move/session/A');
  await page.click('.draft-card button[data-action=draftFresh]');
  await page.waitForTimeout(200);
  if (await draft()) errors.push('Start fresh should clear the draft');
  if (await page.locator('button[data-action=rate][aria-pressed=true]').count()) errors.push('Start fresh should start with nothing marked');

  // "I'm done" from the leave prompt finishes and logs the session
  const before = await strengthLogs();
  await page.click('.exercise >> nth=0 >> button[data-action=rate][data-value=easy]');
  await page.click('.bottomnav a[href="#/you"]');
  await page.waitForSelector('.sheet button[data-action=leaveFinish]');
  await page.click('.sheet button[data-action=leaveFinish]');
  await page.waitForFunction(() => location.hash === '#/move');
  if ((await strengthLogs()) !== before + 1) errors.push('I’m done should log the session');
  if (await draft()) errors.push('finishing should clear the draft');

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('session ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
