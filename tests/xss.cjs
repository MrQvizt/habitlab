// Security: script injection. Every free-text field a person (or an imported backup) can control
// gets an HTML/script payload; then every screen, sheet and story is opened. Passes only if no
// payload ever executes and no injected element appears in the page.
// Also: prototype-pollution keys in an imported backup must not leak onto Object.prototype.
// Usage: node tests/xss.cjs [baseUrl]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8765/';

const P = (tag) => `"><img src=x data-xss="${tag}" onerror="window.__xss=(window.__xss||[]).concat('${tag}')"><svg onload="window.__xss=(window.__xss||[]).concat('${tag}-svg')">`;

(async () => {
  const browser = await browser0();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('dialog', (d) => {
    errors.push('dialog opened: ' + d.message());
    d.dismiss();
  });
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.click('text=Explore with demo data first');
  await page.waitForSelector('.tg-hero');
  await page.addLocatorHandler(page.locator('.modal-wrap'), async () => page.click('.modal-wrap button >> nth=-1'));

  // Poison every text field, then reload so the app goes through load → sanitise → render.
  await page.evaluate((payloads) => {
    const s = JSON.parse(localStorage.getItem('habitlab.v1'));
    const today = Object.keys(s.mealLog).sort().pop();
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    s.profile.activities = [{ id: 'a1', name: payloads.activity, days: [0, 1, 2, 3, 4, 5, 6], minutes: 30, intensity: 'moderate' }];
    s.extras[iso] = [{ label: payloads.extra, kcal: 200 }];
    s.habits.active = s.habits.active.map((a) => ({ ...a, cue: payloads.cue }));
    s.workouts.log[iso] = [{ kind: 'activity', name: payloads.workout, intensity: 'moderate', minutes: 20 }];
    s.affirm = { values: ['family', payloads.value], own: [payloads.own], why: payloads.why, sets: null, custom: [payloads.custom], favs: [payloads.fav] };
    s.alarms = { wake: { on: true, sound: 'uri:content://x/1|' + payloads.sound }, wind: { on: true }, bed: { on: true }, meals: { on: true } };
    s.profile.units = payloads.units;
    s.profile.pace = payloads.pace;
    s.prefs.diet = payloads.diet;
    s.prefs.dislikes = [payloads.dislike];
    s.checkins.push({ date: iso, answers: { note: payloads.note }, applied: [{ type: payloads.applied }], rate: -0.3 });
    void today;
    // Prototype pollution attempt via import-shaped JSON
    localStorage.setItem('habitlab.v1', JSON.stringify(s).replace('"profile":', '"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}},"profile":'));
  }, {
    activity: P('activity'), extra: P('extra'), cue: P('cue'), workout: P('workout'), value: P('value'), own: P('own'), why: P('why'), custom: P('custom'), fav: P('fav'),
    sound: P('sound').replace(/\|/g, ''), units: P('units'), pace: P('pace'), diet: P('diet'), dislike: P('dislike'), note: P('note'), applied: P('applied'),
  });
  await page.reload();
  await page.waitForSelector('.tg-hero');

  const routes = ['today', 'meals', 'move', 'habits', 'progress', 'journey', 'body', 'rewards', 'learn', 'shopping', 'checkin', 'settings', 'settings/profile', 'settings/day', 'settings/food', 'settings/movement', 'settings/alarms', 'settings/reminders', 'settings/appearance', 'settings/data', 'wake'];
  for (const r of routes) {
    await page.goto(base + '#/' + r);
    await page.waitForTimeout(250);
  }
  // Sheets and stories that render user text
  await page.goto(base + '#/today');
  await page.waitForSelector('.tg-hero');
  if (await page.locator('.body-rings .br').count()) {
    await page.click('.body-rings .br >> nth=0');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
  }
  await page.goto(base + '#/settings/alarms');
  await page.waitForSelector('.al-time');
  await page.click('[data-action=alarmSoundOpen][data-key=wake]');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.goto(base + '#/wrap');
  await page.waitForSelector('.wrap-story');
  for (let k = 0; k < 15 && (await page.locator('.w-tap.right').count()); k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');

  const result = await page.evaluate(() => ({
    xss: window.__xss || [],
    injected: document.querySelectorAll('[data-xss]').length,
    polluted: ({}).polluted || ({}).polluted2 || null,
  }));
  if (result.xss.length) errors.push('payload executed in: ' + [...new Set(result.xss)].join(', '));
  if (result.injected) errors.push(`${result.injected} injected element(s) in the page`);
  if (result.polluted) errors.push('Object.prototype polluted by an imported backup');
  // The payload text should still be shown — as text — where it was entered.
  await page.goto(base + '#/settings/alarms');
  await page.waitForSelector('.al-time');
  const shown = await page.evaluate(() => document.body.innerText.includes('data-xss="own"'));
  if (!shown) errors.push('own value text should be displayed literally (escaped), not dropped');

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('xss ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function browser0() {
  return require('playwright').chromium.launch();
}
