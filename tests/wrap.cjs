// Body Wrap walkthrough with demo data: gift card on Today → story cards → collect XP → medals.
// Fails on any console error. Usage: node tests/wrap.cjs [baseUrl] [screenshotDir]
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://localhost:8765/';
const shots = process.argv[3] || null;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const snap = async (name, full = false) => {
    if (!shots) return;
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `${shots}/${name}.png`, fullPage: full });
  };

  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.click('text=Explore with demo data first');
  await page.waitForSelector('.wrap-ready');
  if ((await page.locator('.body-rings .br').count()) !== 7) errors.push('expected 7 live body rings');
  const gift = await page.textContent('.wrap-ready');
  if (!/Body Wrap is ready/.test(gift) || !/\+30 XP/.test(gift)) errors.push('gift card text: ' + gift);
  await snap('w0-today');

  await page.click('.wrap-ready');
  await page.waitForSelector('.wrap-story');
  if (!(await page.evaluate(() => document.body.classList.contains('wrap-open')))) errors.push('wrap-open class missing');
  const intro = await page.textContent('.w-card');
  if (!/thank-you note/.test(intro)) errors.push('intro: ' + intro);
  await snap('w1-intro');
  const titles = [];
  for (let i = 0; i < 12 && (await page.locator('.w-tap.right').count()); i++) {
    await page.click('.w-tap.right', { position: { x: 200, y: 300 } });
    await page.waitForTimeout(80);
    titles.push(await page.textContent('.w-card .w-title'));
    if (i < 3) await snap(`w${i + 2}-card`);
  }
  if (!titles.some((t) => /thanks|party|dancing|flexing|glowing|cruising|high-fiving|felt that/.test(t))) errors.push('no organ thank-you cards: ' + titles.join(' | '));
  if (!(await page.locator('.w-fact').count()) && !(await page.locator('.w-grid').count())) errors.push('end card missing');
  // Back with the keyboard, then forward again
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('[data-action=wrapClaim]');
  await snap('w9-end');
  await page.click('[data-action=wrapClaim]');
  // Collecting unlocks the "Unwrapped" badge: its celebration shows on top of the story
  await page.waitForSelector('.modal-wrap');
  if (!/Unwrapped/.test(await page.textContent('.modal-wrap'))) errors.push('Unwrapped celebration missing');
  await snap('w9b-badge');
  while (await page.locator('.modal-wrap button').count()) {
    await page.click('.modal-wrap button >> nth=-1');
    await page.waitForTimeout(400);
  }
  await page.click('.w-btn[data-action=wrapClose]');
  await page.waitForSelector('.tg-hero');
  if (await page.locator('.wrap-ready').count()) errors.push('gift card still shown after collecting');
  if (await page.evaluate(() => document.body.classList.contains('wrap-open'))) errors.push('wrap-open class left on');

  // Tap a ring on Today → the body-part sheet: what it needs, this week, level meter
  await page.click('.body-rings .br[data-organ=heart]');
  await page.waitForSelector('.sheet.open .organ-head');
  const sheet = await page.textContent('.sheet.open');
  for (const t of ['What your heart needs', 'How to help it', 'Active minutes', 'points to Level']) if (!sheet.includes(t)) errors.push('heart sheet missing: ' + t);
  await snap('w11-heart-sheet');
  await page.click('.sheet.open [data-action=sheetClose]');
  await page.waitForTimeout(400);
  // Live wrap: rings in the story open the same sheet, above the story
  await page.click('.body-rings .br-foot');
  await page.waitForSelector('.wrap-story');
  if (!/This week so far/.test(await page.textContent('.w-kicker'))) errors.push('live wrap kicker');
  await page.click('.w-mini[data-organ=gut]');
  await page.waitForSelector('.sheet.open .organ-head');
  if (!/What your gut needs/.test(await page.textContent('.sheet.open'))) errors.push('gut sheet from wrap');
  const onTop = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.sheet.open')).zIndex) > 1000);
  if (!onTop) errors.push('sheet hidden under the wrap');
  await page.click('.sheet.open [data-action=sheetClose]');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.tg-hero');
  // Body page: levels for every body part
  await page.click('main a[href="#/body"]');
  await page.waitForSelector('.body-grid');
  if ((await page.locator('.body-tile').count()) !== 7) errors.push('expected 7 body tiles');
  if (!/Lv \d/.test(await page.textContent('.body-grid'))) errors.push('levels missing');
  await snap('w12-body', true);
  await page.click('.body-tile[data-organ=muscle]');
  await page.waitForSelector('.sheet.open .organ-head');
  await snap('w13-muscle-sheet');
  await page.click('.sheet.open [data-action=sheetClose]');
  await page.waitForTimeout(400);

  // Rewards: medal wall + badge
  await page.goto(base + '#/rewards');
  await page.waitForSelector('.medal-wall');
  if ((await page.locator('.body-medal').count()) !== 7) errors.push('expected 7 body medals');
  if (!/Unwrapped/.test(await page.textContent('main'))) errors.push('Unwrapped badge missing');
  await page.evaluate(() => document.querySelector('.medal-wall').scrollIntoView());
  await snap('w10-medals');
  await page.goto(base + '#/learn/body_wrap');
  await page.waitForSelector('#learn-body_wrap');

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('wrap ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
