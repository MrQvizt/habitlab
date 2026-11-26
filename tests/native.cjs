// Simulates the Android (Capacitor) environment in Chromium with a mock LocalNotifications plugin that
// mirrors the native bridge's surface (window.Capacitor.Plugins.LocalNotifications), then checks the
// app requests permission, creates the channel, schedules specific reminders and routes taps.
// Usage: node tests/native.cjs [url-of-www/index.html]
const { chromium } = require('playwright');
const path = require('path');
const url = process.argv[2] || 'file://' + path.join(__dirname, '..', 'www', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(() => {
    const calls = (window.__ln = { schedule: [], cancel: [], channels: [], listeners: {}, perm: 'prompt' });
    const ln = {
      checkPermissions: async () => ({ display: calls.perm }),
      requestPermissions: async () => ((calls.perm = 'granted'), { display: 'granted' }),
      createChannel: async (c) => void calls.channels.push(c),
      // Like the real bridge, options cross a JSON boundary (Dates become strings).
      schedule: async (o) => void calls.schedule.push(JSON.parse(JSON.stringify(o))),
      getPending: async () => ({ notifications: (calls.schedule.at(-1)?.notifications || []).map((n) => ({ id: n.id })) }),
      cancel: async (o) => void calls.cancel.push(o),
      addListener: (ev, cb) => ((calls.listeners[ev] = cb), { remove() {} }),
    };
    // Preferences mock persists in sessionStorage, standing in for Android SharedPreferences
    // (which survive the WebView's storage being cleared).
    const prefs = {
      get: async ({ key }) => ({ value: sessionStorage.getItem('prefs:' + key) }),
      set: async ({ key, value }) => void sessionStorage.setItem('prefs:' + key, value),
    };
    window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: ln, Preferences: prefs } };
  });
  await page.goto(url);
  await page.click('text=Explore with demo data');
  await page.waitForSelector('text=demo data');
  await page.addLocatorHandler(page.locator('.celebrate-modal'), async () => page.click('.celebrate-modal button'));
  await page.goto(url + '#/settings/reminders');
  await page.waitForSelector('text=arrive even when the app is closed');
  await page.evaluate(() => document.querySelector('form[data-form=reminders]').scrollIntoView({ block: 'center' }));
  await page.check('form[data-form=reminders] input[name=enabled]');
  await page.click('form[data-form=reminders] button.primary');
  await page.waitForSelector('text=/On — \\d+ reminders scheduled for the next 7 days/');
  const ln = await page.evaluate(() => window.__ln);
  const last = ln.schedule.at(-1)?.notifications || [];
  if (ln.perm !== 'granted') errors.push('permission not requested');
  if (!ln.channels.length) errors.push('channel not created');
  if (last.length < 20) errors.push(`expected ~7 days of reminders, got ${last.length}`);
  for (const n of last) {
    if (!n.title || !n.body || !n.schedule?.at || !n.extra?.route || n.channelId !== 'reminders' || n.smallIcon !== 'ic_stat_notify') { errors.push('bad notification payload: ' + JSON.stringify(n)); break; }
    if (new Date(n.schedule.at) <= new Date()) { errors.push('reminder in the past'); break; }
  }
  if (new Set(last.map((n) => n.id)).size !== last.length) errors.push('duplicate ids');
  if (!last.some((n) => /Planned: /.test(n.body))) errors.push('no specific meal reminder');
  // Logging a meal reschedules (debounced) and drops that meal's reminder for today.
  const before = ln.schedule.length;
  await page.goto(url + '#/today');
  await page.click('.tg-food button[data-action=mealCheck] >> nth=0');
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__ln.schedule.length);
  if (after <= before) errors.push('no reschedule after logging');
  // A tap on a notification routes to its screen.
  await page.evaluate(() => window.__ln.listeners.localNotificationActionPerformed({ notification: { extra: { route: '#/checkin' } } }));
  await page.waitForSelector('h1:has-text("Check-in")');
  // Updates keep progress: wipe the WebView's storage, relaunch, and the native copy is restored.
  await page.waitForTimeout(800);
  const xpBefore = await page.textContent('.xp-chip');
  if (!(await page.evaluate(() => !!sessionStorage.getItem('prefs:habitlab.state')))) errors.push('state not mirrored to native preferences');
  await page.evaluate(() => localStorage.clear());
  await page.goto(url + '#/today');
  await page.reload();
  await page.waitForSelector('text=Your saved progress was restored.');
  await page.waitForSelector('text=demo data');
  const xpAfter = await page.textContent('.xp-chip');
  if (xpBefore !== xpAfter) errors.push(`progress changed after restore: ${xpBefore} → ${xpAfter}`);
  console.log(`scheduled ${last.length}; sample:`, last.slice(0, 3).map((n) => `${n.schedule.at} | ${n.title} | ${n.body}`).join('\n  '));
  await browser.close();
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('native ok');
})().catch((e) => { console.error(e); process.exit(1); });
