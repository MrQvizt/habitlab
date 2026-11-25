// Alarm clock + morning messages, with a mock of the native HabitAlarm plugin standing in for
// android/.../alarm/HabitAlarmPlugin.java (same method names and payloads).
// Checks: settings page → alarms synced to the phone; values + why → messages; "I'm up" route opens
// the Good-morning screen with the alarm's message; reflection earns XP once.
// Usage: node tests/alarms.cjs [url-of-www/index.html] [screenshotDir]
const { chromium } = require('playwright');
const path = require('path');
const url = process.argv[2] || 'file://' + path.join(__dirname, '..', 'www', 'index.html');
const shots = process.argv[3] || null;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const snap = async (name, full = false) => {
    if (!shots) return;
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${shots}/${name}.png`, fullPage: full });
  };
  await page.addInitScript(() => {
    const a = (window.__alarm = { set: [], tests: [], opened: [], listeners: {}, route: null });
    const ln = {
      checkPermissions: async () => ({ display: 'granted' }),
      requestPermissions: async () => ({ display: 'granted' }),
      createChannel: async () => {},
      schedule: async () => {},
      getPending: async () => ({ notifications: [] }),
      cancel: async () => {},
      addListener: () => ({ remove() {} }),
    };
    const habitAlarm = {
      setAlarms: async (o) => (a.set.push(JSON.parse(JSON.stringify(o))), { exact: true, notifications: true, fullScreen: false, next: Date.now() + 3600e3, count: o.alarms.length }),
      getStatus: async () => ({ exact: true, notifications: true, fullScreen: false, next: Date.now() + 3600e3, count: a.set.at(-1)?.alarms.length || 0 }),
      openSettings: async (o) => void a.opened.push(o.which),
      test: async (o) => void a.tests.push(o),
      consumeRoute: async () => {
        const r = a.route;
        a.route = null;
        return r || { route: null, message: null };
      },
      addListener: (ev, cb) => ((a.listeners[ev] = cb), { remove() {} }),
    };
    const prefs = { get: async ({ key }) => ({ value: sessionStorage.getItem('prefs:' + key) }), set: async ({ key, value }) => void sessionStorage.setItem('prefs:' + key, value) };
    window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: ln, Preferences: prefs, HabitAlarm: habitAlarm } };
  });
  await page.goto(url);
  await page.click('text=Explore with demo data');
  await page.waitForSelector('text=demo data');
  await page.addLocatorHandler(page.locator('.modal-wrap'), async () => page.click('.modal-wrap button >> nth=-1'));

  await page.goto(url + '#/settings');
  await page.waitForSelector('text=Alarms & wake-up');
  await page.goto(url + '#/settings/alarms');
  await page.waitForSelector('.al-time');
  // Permission check shows the full-screen warning with a fix button
  await page.waitForSelector('[data-action=alarmPerm][data-which=fullScreen]');
  await page.click('[data-action=alarmPerm][data-which=fullScreen]');
  // Wake alarm on, weekdays only, then values and why
  await page.click('label.switch:has(input[data-path="wake.on"])');
  await page.waitForSelector('.alarm-card.on');
  await page.click('.al-day[data-day="6"]');
  await page.click('.al-day[data-day="5"]');
  await page.fill('input.al-time', '06:45');
  await page.locator('input.al-time').dispatchEvent('change');
  await page.click('label.switch:has(input[data-path="wind.on"])');
  await page.click('label.chip:has-text("Family")');
  await page.click('label.chip:has-text("Energy")');
  await page.fill('[data-change=affirmWhy]', 'To have energy to play with my kids');
  await page.locator('[data-change=affirmWhy]').dispatchEvent('change');
  await page.fill('[data-change=affirmCustom]', 'Future you is proud of you.');
  await page.locator('[data-change=affirmCustom]').dispatchEvent('change');
  await page.waitForTimeout(1500); // debounced sync
  await snap('a1-alarms', true);
  await page.click('[data-action=alarmTest][data-id=wake]');
  await page.waitForTimeout(300);

  const a = await page.evaluate(() => window.__alarm);
  const last = a.set.at(-1);
  if (!last) errors.push('alarms never synced to the phone');
  else {
    const wake = last.alarms.find((x) => x.id === 'wake');
    if (!wake || wake.hour !== 6 || wake.minute !== 45 || wake.days.join() !== '0,1,2,3,4' || wake.style !== 'ring') errors.push('wake spec wrong: ' + JSON.stringify(wake));
    if (!last.alarms.some((x) => x.id === 'wind' && x.style === 'gentle')) errors.push('wind-down not synced');
    if (!last.messages.some((m) => /Family matters to you/.test(m))) errors.push('values missing from messages');
    if (!last.messages.some((m) => /to have energy to play with my kids/.test(m))) errors.push('why missing from messages');
    if (!last.messages.includes('Future you is proud of you.')) errors.push('custom message missing');
    if (last.snooze !== 9) errors.push('snooze');
  }
  if (!a.opened.includes('fullScreen')) errors.push('permission button did not open settings');
  if (!a.tests.some((t) => t.id === 'wake')) errors.push('test alarm not requested');
  if (!/Next alarm/.test(await page.textContent('#alarm-status'))) errors.push('next alarm not shown');

  // "I'm up" on the phone → app opens the Good-morning screen with the alarm's message
  await page.goto(url + '#/today');
  await page.waitForSelector('.tg-hero');
  await page.evaluate(() => window.__alarm.listeners.route({ route: '#/wake', message: 'You deserve a healthy life.' }));
  await page.waitForSelector('.wake-screen');
  if ((await page.textContent('.wk-msg')) !== 'You deserve a healthy life.') errors.push('wake message not handed over');
  if (!(await page.locator('.wk-value:has-text("Family")').count())) errors.push('values not offered for reflection');
  if (!(await page.locator('.w-btn[disabled]').count())) errors.push('start should wait for a reflection');
  await snap('a2-wake');
  await page.click('.wk-heart');
  await page.click('.wk-value:has-text("Family")');
  await snap('a3-wake-chosen');
  await page.click('.w-btn');
  await page.waitForSelector('.tg-hero');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')));
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  if (!st.wakes?.[today]) errors.push('morning intention not recorded');
  if (!st.affirm.favs.includes('You deserve a healthy life.')) errors.push('favourite not saved');
  if (await page.evaluate(() => document.body.classList.contains('wrap-open'))) errors.push('overlay class left on');
  // Learn card
  await page.goto(url + '#/learn/morning_mind');
  await page.waitForSelector('#learn-morning_mind');

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('alarms ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
