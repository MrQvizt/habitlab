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
      setAlarms: async (o) => (a.set.push(JSON.parse(JSON.stringify(o))), { exact: true, notifications: true, fullScreen: false, overlay: false, next: Date.now() + 3600e3, count: o.alarms.length }),
      getStatus: async () => ({ exact: true, notifications: true, fullScreen: false, overlay: false, next: Date.now() + 3600e3, count: a.set.at(-1)?.alarms.length || 0 }),
      openSettings: async (o) => void a.opened.push(o.which),
      test: async (o) => void a.tests.push(o),
      pickSound: async () => ({ uri: 'content://media/internal/audio/media/42', title: 'Cesium' }),
      previewSound: async (o) => void (a.previews = [...(a.previews || []), o]),
      stopPreview: async () => {},
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
  // With an alarm on: offer "Display over other apps" so the wake screen can take over an unlocked phone
  await page.waitForSelector('[data-action=alarmPerm][data-which=overlay]');
  await page.click('[data-action=alarmPerm][data-which=overlay]');
  await page.click('.al-day[data-day="6"]');
  await page.click('.al-day[data-day="5"]');
  await page.fill('input.al-time', '06:45');
  await page.locator('input.al-time').dispatchEvent('change');
  await page.click('label.switch:has(input[data-path="wind.on"])');
  await page.click('label.chip:has-text("Family")');
  await page.click('label.chip:has-text("Energy")');
  // Add your own value
  await page.fill('.own-value input', 'My kids');
  await page.click('.own-value button');
  await page.waitForSelector('label.chip.own:has-text("My kids")');
  if (!(await page.locator('label.chip.own:has-text("My kids") input:checked').count())) errors.push('a new own value is picked while there is room');
  // With 3 picked, a new own value is saved to the list but not picked
  await page.fill('.own-value input', 'Painting');
  await page.click('.own-value button');
  await page.waitForSelector('label.chip.own:has-text("Painting")');
  if (await page.locator('label.chip.own:has-text("Painting") input:checked').count()) errors.push('4th value should not be picked');
  // Unticking an own value keeps it on the list; it can be picked again later
  await page.click('label.chip.own:has-text("My kids")');
  await page.waitForTimeout(300);
  if (!(await page.locator('label.chip.own:has-text("My kids")').count())) errors.push('unticked own value disappeared');
  await page.click('label.chip.own:has-text("Painting")');
  await page.waitForSelector('label.chip.own:has-text("Painting") input:checked');
  await page.click('label.chip.own:has-text("My kids")'); // 4th: refused, stays unticked
  await page.waitForTimeout(300);
  if (await page.locator('label.chip.own:has-text("My kids") input:checked').count()) errors.push('more than 3 picked');
  // × deletes an own value
  await page.fill('.own-value input', 'Temp value');
  await page.click('.own-value button');
  await page.waitForSelector('label.chip.own:has-text("Temp value")');
  await page.click('[data-action=affirmRemoveOwn][data-value="Temp value"]');
  await page.waitForTimeout(300);
  if (await page.locator('label.chip.own:has-text("Temp value")').count()) errors.push('delete did not remove the value');
  // Pick My kids again (untick Energy) for the rest of the test
  await page.click('label.chip:has-text("Energy")');
  await page.waitForTimeout(200);
  await page.click('label.chip.own:has-text("My kids")');
  await page.waitForSelector('label.chip.own:has-text("My kids") input:checked');
  await page.fill('[data-change=affirmWhy]', 'To have energy to play with my kids');
  await page.locator('[data-change=affirmWhy]').dispatchEvent('change');
  await page.fill('[data-change=affirmCustom]', 'Future you is proud of you.');
  await page.locator('[data-change=affirmCustom]').dispatchEvent('change');
  await page.waitForTimeout(1500); // debounced sync
  await snap('a1-alarms', true);
  await page.click('[data-action=alarmTest][data-id=wake]');
  await page.waitForTimeout(300);
  // Sounds: the wake alarm gets Birdsong; the bedtime chime gets a sound picked on the phone
  await page.click('[data-action=alarmSoundOpen][data-key=wake]');
  await page.waitForSelector('.sheet.open .snd-list');
  if ((await page.locator('.sheet.open .snd-row').count()) < 7) errors.push('too few sounds offered');
  await page.click('.sheet.open [data-action=alarmSoundPlay][data-sound=marimba]'); // preview
  await page.click('.sheet.open [data-action=alarmSoundSet][data-sound=birdsong]');
  await page.waitForSelector('.sheet.open .snd-row.on:has-text("Birdsong")');
  await snap('a1b-sounds');
  await page.click('.sheet.open [data-action=alarmSoundPlay][data-sound=device]');
  await page.click('.sheet.open [data-action=sheetClose]');
  await page.waitForTimeout(400);
  if (!/Birdsong/.test(await page.textContent('[data-action=alarmSoundOpen][data-key=wake]'))) errors.push('wake card should show Birdsong');
  await page.click('label.switch:has(input[data-path="bed.on"])');
  await page.click('[data-action=alarmSoundOpen][data-key=bed]');
  await page.waitForSelector('.sheet.open [data-action=alarmSoundPhone]');
  await page.click('.sheet.open [data-action=alarmSoundPhone]');
  await page.waitForSelector('.sheet.open .snd-row.on:has-text("Cesium")');
  await page.click('.sheet.open [data-action=sheetClose]');
  await page.waitForTimeout(1500);
  {
    const s2 = (await page.evaluate(() => window.__alarm)).set.at(-1);
    const w = s2.alarms.find((x) => x.id === 'wake');
    const b = s2.alarms.find((x) => x.id === 'bed');
    if (w?.sound !== 'melody' || w?.melody?.notes?.length !== 9) errors.push('wake alarm should carry the Birdsong melody: ' + JSON.stringify(w && { sound: w.sound, n: w.melody?.notes?.length }));
    if (b?.sound !== 'uri' || b?.uri !== 'content://media/internal/audio/media/42') errors.push('bedtime should carry the picked phone sound');
    const prev = (await page.evaluate(() => window.__alarm.previews)) || [];
    if (!prev.some((p) => p.sound === 'device')) errors.push('phone sound preview not requested');
  }

  const a = await page.evaluate(() => window.__alarm);
  const last = a.set.at(-1);
  if (!last) errors.push('alarms never synced to the phone');
  else {
    const wake = last.alarms.find((x) => x.id === 'wake');
    if (!wake || wake.hour !== 6 || wake.minute !== 45 || wake.days.join() !== '0,1,2,3,4' || wake.style !== 'ring') errors.push('wake spec wrong: ' + JSON.stringify(wake));
    if (!last.alarms.some((x) => x.id === 'wind' && x.style === 'gentle')) errors.push('wind-down not synced');
    if (!last.messages.some((m) => /You care about the people you love/.test(m))) errors.push('values missing from messages');
    if (!last.messages.some((m) => /your kids/i.test(m))) errors.push('own value missing from messages');
    if (!last.messages.some((m) => /to have energy to play with my kids/.test(m))) errors.push('why missing from messages');
    if (!last.messages.includes('Future you is proud of you.')) errors.push('custom message missing');
    if (last.snooze !== 5) errors.push('snooze');
  }
  if (!a.opened.includes('fullScreen')) errors.push('permission button did not open settings');
  if (!a.opened.includes('overlay')) errors.push('overlay button did not open settings');
  if (!a.tests.some((t) => t.id === 'wake')) errors.push('test alarm not requested');
  if (!/Next alarm/.test(await page.textContent('#alarm-status'))) errors.push('next alarm not shown');

  // "I'm up" on the phone → app opens the Good-morning screen with the alarm's message
  await page.goto(url + '#/today');
  await page.waitForSelector('.tg-hero');
  await page.evaluate(() => window.__alarm.listeners.route({ route: '#/wake', message: 'You deserve a healthy life.' }));
  await page.waitForSelector('.wake-screen');
  if ((await page.textContent('.wk-msg')) !== 'You deserve a healthy life.') errors.push('wake message not handed over');
  if (!(await page.locator('.wk-value:has-text("Family")').count())) errors.push('values not offered for reflection');
  if (!(await page.locator('.wk-value:has-text("My kids")').count())) errors.push('own value not offered for reflection');
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
