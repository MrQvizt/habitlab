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
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '450' : undefined));
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
  await page.waitForSelector('text=Today’s food');
  await snap('04-today');

  // Interact on Today
  await page.fill('input[name=w]', '107.6');
  await page.click('form[data-form=weigh] button');
  await page.click('.meal button.check >> nth=0');
  await page.click('button:has-text("Swap") >> nth=1');
  await page.click('button:has-text("Ate something else") >> nth=2');
  await page.click('.habit-item button.check >> nth=0');
  await page.fill('input[name=steps]', '5200');
  await page.click('form[data-form=steps] button');

  for (const route of ['meals', 'shopping', 'move', 'habits', 'progress', 'learn', 'settings', 'checkin']) {
    await page.goto(base + '#/' + route);
    await page.waitForTimeout(250);
    await snap('05-' + route);
  }
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
  await page.waitForSelector('text=Today’s food');

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
