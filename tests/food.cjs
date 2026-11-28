// Food logging on a phone: search a big database, set amounts in grams or household units, build a
// counter meal ("chipotle" → burrito builder), create your own food, save a meal and reuse it,
// choose a swap, and move a meal's time for one day.
// Usage: node tests/food.cjs [baseUrl]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8771/';

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
  await page.addLocatorHandler(page.locator('.modal-wrap:not(:has(#modal-input))'), async () => page.click('.modal-wrap button >> nth=-1'));
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')));
  const openLog = async () => {
    await page.click('.bottomnav .tab-log');
    await page.click('.sheet .ql-tile[data-action=openExtra]');
    await page.waitForSelector('.sheet [data-food-search]');
  };

  // 1. Grams: 150 g of kiwi from the USDA tables
  await openLog();
  await page.fill('.sheet [data-food-search]', 'kiwi green');
  await page.click('.sheet .food-hit:has-text("Kiwi, green, raw")');
  await page.click('.sheet .fi-unit[data-u=g]');
  await page.fill('.sheet [data-food-grams]', '150');
  if ((await page.inputValue('.sheet input[name=kcal]')) !== '92') errors.push('150 g kiwi should be 92 kcal, got ' + (await page.inputValue('.sheet input[name=kcal]')));
  // 2. "chipotle" offers the burrito builder; extra guac counts 1.5×
  await page.fill('.sheet [data-food-search]', 'chipotle');
  await page.click('.sheet .food-build:has-text("Burrito")');
  for (const k of ['base.tortilla', 'protein.chicken', 'rice.white_rice', 'beans.black_beans', 'extras.guac', 'extras.guac']) await page.click(`.sheet [data-k="${k}"]`);
  if (!/extra/.test(await page.textContent('.sheet [data-k="extras.guac"]'))) errors.push('tapping twice should mean extra');
  await page.click('.sheet [data-action=buildAdd]');
  await page.waitForSelector('.sheet .food-item:has-text("Burrito with chicken")');
  const expected = 92 + 320 + 180 + 210 + 130 + Math.round(230 * 1.5);
  const got = Number(await page.inputValue('.sheet input[name=kcal]'));
  if (Math.abs(got - expected) > 1) errors.push(`kiwi + burrito should be about ${expected} kcal, got ${got}`);
  // 3. Save it as one of my meals
  await page.click('.sheet [data-action=mealSave]');
  await page.fill('#modal-input', 'Burrito Friday');
  await page.click('.modal-wrap button.primary');
  await page.waitForSelector('.toast.show >> text=Burrito Friday');
  await page.click('.sheet form > button.primary:has-text("Add")');
  await page.waitForSelector('.tg-day .k-extra:has-text("Burrito")');
  const s1 = await st();
  if (s1.foods.meals[0]?.name !== 'Burrito Friday' || s1.foods.meals[0].items.length !== 2) errors.push('saved meal not stored: ' + JSON.stringify(s1.foods.meals));
  const last = Object.values(s1.extras).flat().at(-1);
  if (!(last.fib >= 10)) errors.push('fibre from the kiwi and beans should be saved: ' + JSON.stringify(last));

  // 4. Reuse the saved meal; create your own food from the label
  await openLog();
  if (await page.locator('.sheet .food-quick:has-text("pizza"), .sheet .food-quick:has-text("Burger")').count()) errors.push('no takeaway tiles before you ask');
  await page.click('.sheet .side-chip:has-text("Burrito Friday")');
  if ((await page.locator('.sheet .food-item').count()) !== 2) errors.push('saved meal should add its two items');
  await page.fill('.sheet [data-food-search]', 'zqx office lunch');
  await page.click('.sheet .food-none button:has-text("Create it")');
  await page.fill('.sheet [data-nf=name]', 'Office chicken wrap');
  await page.fill('.sheet [data-nf=kcal]', '480');
  await page.fill('.sheet [data-nf=p]', '32');
  await page.fill('.sheet [data-nf=fib]', '5');
  await page.click('.sheet [data-action=foodCreateSave]');
  await page.waitForSelector('.sheet .food-item:has-text("Office chicken wrap")');
  await page.keyboard.press('Escape');
  await openLog();
  await page.fill('.sheet [data-food-search]', 'office');
  if (!(await page.locator('.sheet .food-hit:has-text("Office chicken wrap") >> text=yours').count())) errors.push('your food should be findable and marked as yours');
  await page.keyboard.press('Escape');

  // 5. Swap: choose from a few options
  await page.goto(base + '#/today');
  await page.click('.tg-day button[data-action=openMeal] >> nth=-1');
  await page.click('.sheet button:has-text("Swap")');
  await page.waitForSelector('.sheet .swap-opt');
  const n = await page.locator('.sheet .swap-opt').count();
  if (n < 3) errors.push(`swap should show at least 3 options, shows ${n}`);
  await page.click('.sheet [data-action=sheetSwapMore]');
  await page.waitForSelector('.sheet .swap-opt');
  const choice = (await page.textContent('.sheet .swap-opt >> nth=0 >> strong')).replace('★ ', '').trim();
  await page.click('.sheet .swap-opt >> nth=0');
  await page.waitForSelector('.toast.show >> text=Swapped for');
  if (!(await page.textContent('.sheet h2')).includes(choice)) errors.push('swap did not plan the meal you chose');

  // 6. Move this meal to another time for this day only
  await page.click('.sheet [data-action=sheetMealTime]');
  await page.fill('.sheet input[name=time]', '21:15');
  await page.click('.sheet .meal-time-edit button.primary');
  await page.waitForSelector('.sheet .meal-time-row:has-text("21:15")');
  const s2 = await st();
  const today = Object.keys(s2.mealTimes)[0];
  if (!today || !Object.values(s2.mealTimes[today]).includes('21:15')) errors.push('moved time not stored: ' + JSON.stringify(s2.mealTimes));
  await page.click('.sheet [data-action=sheetMealTime]');
  await page.click('.sheet [data-action=sheetMealTimeReset]');
  await page.waitForSelector('.sheet .meal-time-row:not(:has-text("21:15"))');

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('food ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
