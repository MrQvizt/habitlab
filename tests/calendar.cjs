// Calendar + sharing: add an event (shows on Today at its time), open it to friends, create a share
// link (Supabase calls are mocked — no real data), see who's joining; the friend's join page.
// Usage: node tests/calendar.cjs [baseUrl]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8771/';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = ymd(new Date());
  const calls = [];
  const mock = async (ctx, answers) => ctx.route('https://jwjabhcebwnzhfphsuwg.supabase.co/rest/v1/rpc/*', async (route) => {
    const fn = route.request().url().split('/').pop();
    const body = route.request().postDataJSON();
    calls.push({ fn, body });
    const a = answers[fn];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(typeof a === 'function' ? a(body) : a ?? null) });
  });

  // ---- You: add an event, share it ----
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let eventId = null;
  await mock(ctx, { hl_publish: null, hl_signups: () => (eventId ? [{ event: eventId, name: 'Sam', at: new Date().toISOString() }] : []) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.click('text=Explore with demo data first');
  await page.waitForSelector('.tg-hero');
  await page.addLocatorHandler(page.locator('.modal-wrap'), async () => page.click('.modal-wrap button >> nth=-1'));
  await page.goto(base + '#/move');
  await page.click('a.cal-link');
  await page.waitForSelector('.cal-day');
  if (!(await page.locator('.cal-plan').count())) errors.push('planned sessions not shown on the calendar');
  // Add: walk today at 23:58 in the park, open to friends
  await page.click('button[data-action=calAdd] >> nth=-1');
  await page.click('.sheet button[data-action=calQuick]:has-text("Walk with friends")');
  await page.fill('.sheet input[name=time]', '23:58');
  await page.fill('.sheet input[name=place]', 'Lake loop');
  await page.check('.sheet input[name=public]');
  await page.click('.sheet button:has-text("Add to calendar")');
  await page.waitForSelector('.cal-ev:has-text("Walk with friends")');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')));
  const ev = st.events.find((e) => e.title === 'Walk with friends');
  if (!ev || ev.date !== today || ev.time !== '23:58' || ev.place !== 'Lake loop' || !ev.public) errors.push('event not saved: ' + JSON.stringify(ev));
  eventId = ev?.id;
  // It shows on Today's timeline at its time
  await page.goto(base + '#/today');
  await page.waitForSelector('.k-event:has-text("Walk with friends")');
  if (!/23:58/.test(await page.textContent('.k-event'))) errors.push('event time not on Today');
  // Share: create a link (publishes only open events)
  await page.goto(base + '#/calendar');
  await page.fill('form[data-form=shareCreate] input[name=name]', 'Alex');
  await page.click('form[data-form=shareCreate] button');
  await page.waitForSelector('.share-link input');
  const link = await page.inputValue('.share-link input');
  if (!/^https:\/\/habitlab-eight\.vercel\.app\/#\/join\/[0-9a-f-]{36}$/.test(link)) errors.push('share link: ' + link);
  const pub = calls.filter((c) => c.fn === 'hl_publish').at(-1);
  if (!pub || pub.body.p_events.length !== 1 || pub.body.p_events[0].title !== 'Walk with friends' || 'public' in pub.body.p_events[0]) errors.push('publish payload: ' + JSON.stringify(pub?.body));
  if (!pub || pub.body.p_key.length < 32 || pub.body.p_name !== 'Alex') errors.push('publish key/name');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).share);
  if (!saved?.key || saved.key !== pub?.body.p_key) errors.push('share key not kept on the device');
  // Who's joining
  await page.reload();
  await page.waitForSelector('.cal-ev:has-text("1 joining")', { timeout: 8000 }).catch(() => errors.push('sign-up count not shown'));
  await page.click('.cal-ev:has-text("Walk with friends")');
  await page.waitForSelector('.sheet :text("Sam")').catch(() => errors.push('sign-up names not shown to the owner'));
  await page.keyboard.press('Escape');
  await ctx.close();

  // ---- A friend opens the link (no Habit Lab data on their phone) ----
  const fctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const calId = link.split('/').pop();
  await mock(fctx, {
    hl_calendar: (b) => (b.p_id === calId ? { name: 'Alex', events: [{ id: 'ev1', title: 'Walk with friends', date: today, time: '23:58', place: 'Lake loop', kind: 'walk', notes: '', going: 0 }] } : null),
    hl_join: (b) => (b.p_name ? { going: 1 } : null),
  });
  const fp = await fctx.newPage();
  fp.on('pageerror', (e) => errors.push('friend pageerror: ' + e.message));
  await fp.goto(base + '#/join/' + calId);
  await fp.waitForSelector('.join-ev');
  if (!/Join Alex/.test(await fp.textContent('h1'))) errors.push('join heading');
  if (await fp.locator('.bottomnav a').count()) errors.push('join page should not show the app navigation');
  await fp.click('button[data-action=joinAsk]');
  await fp.fill('form[data-form=joinSave] input[name=name]', 'Sam');
  await fp.click('form[data-form=joinSave] button');
  await fp.waitForSelector('text=You’re in!');
  if (!calls.some((c) => c.fn === 'hl_join' && c.body.p_name === 'Sam' && c.body.p_event === 'ev1')) errors.push('join call');
  // XSS: hostile event text from the server is shown as text
  await fp.unroute('https://jwjabhcebwnzhfphsuwg.supabase.co/rest/v1/rpc/*');
  await mock(fctx, { hl_calendar: { name: '<img src=x onerror=window.__x=1>', events: [{ id: 'e2', title: '<script>window.__x=1</script>', date: today, time: '', place: '<b>p</b>', kind: 'walk', notes: '', going: 0 }] } });
  await fp.goto(base + '#/join/00000000-0000-4000-8000-000000000009');
  await fp.reload();
  await fp.waitForSelector('.join-ev');
  if (await fp.evaluate(() => window.__x)) errors.push('XSS on the join page');
  // Unknown calendar
  await fp.unroute('https://jwjabhcebwnzhfphsuwg.supabase.co/rest/v1/rpc/*');
  await mock(fctx, { hl_calendar: null });
  await fp.goto(base + '#/join/00000000-0000-4000-8000-0000000000aa');
  await fp.reload();
  await fp.waitForSelector('text=isn’t shared any more');
  await fctx.close();

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('calendar ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
