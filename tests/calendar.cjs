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
  let extraJoin = false;
  await mock(ctx, { hl_publish: null, hl_signups: () => (eventId ? [{ event: eventId, name: 'Sam', at: new Date().toISOString() }, ...(extraJoin ? [{ event: eventId, name: 'James', at: new Date().toISOString() }] : [])] : []), hl_cheers: () => (eventId ? [{ id: 7, name: 'Maria', message: 'So proud of you!', at: new Date().toISOString() }] : []) });
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
  // Opens in the 3-day time grid; switch to Schedule (list) for the steps below
  await page.waitForSelector('.cg');
  if ((await page.locator('.cg-col').count()) !== 3) errors.push('3-day view should show 3 columns');
  // Your meals and sleep are in the calendar too: tap a meal to open it; both can be hidden
  if ((await page.locator('.cg-meal').count()) < 3) errors.push('3-day view should show planned meals');
  if ((await page.locator('.cg-sleep.am').count()) !== 3 || (await page.locator('.cg-sleep.pm').count()) !== 3) errors.push('3-day view should show wake and bed times');
  await page.click('.cg-meal >> nth=0');
  await page.waitForSelector('.sheet [data-action="sheetClose"]');
  await page.click('.sheet [data-action="sheetClose"]');
  await page.waitForSelector('.sheet-scrim', { state: 'detached' }).catch(() => {});
  await page.click('[data-action="calLayer"][data-k="meals"]');
  if ((await page.locator('.cg-meal').count()) !== 0) errors.push('hiding meals should remove them from the calendar');
  await page.click('[data-action="calLayer"][data-k="sleep"]');
  if ((await page.locator('.cg-sleep').count()) !== 0) errors.push('hiding sleep should remove it from the calendar');
  await page.click('[data-action="calLayer"][data-k="meals"]');
  await page.click('[data-action="calLayer"][data-k="sleep"]');
  if (!(await page.locator('.cg-meal').count())) errors.push('meals should come back when switched on');
  await page.click('.cal-views [data-v="list"]');
  await page.waitForSelector('.cal-day');
  if (!(await page.locator('.cal-plan').count())) errors.push('planned sessions not shown on the calendar');
  // Add: walk today at 23:58 in the park, open to friends
  await page.click('.page-head button[data-action=calAdd]');
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
  // A walk in the calendar can be ticked off: how long, how hard → it counts as movement
  await page.click('.k-event button[data-action=eventDone]');
  await page.waitForSelector('.sheet form[data-form=activityDoneSave]');
  await page.fill('.sheet input[name=minutes]', '40');
  await page.click('.sheet .int-opt:has-text("Easy")');
  await page.click('.sheet form[data-form=activityDoneSave] button.primary');
  await page.waitForSelector('.k-event.is-done:has-text("Walk with friends")').catch(() => errors.push('ticked calendar walk should show as done'));
  const walkLog = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('habitlab.v1')); const d = Object.keys(s.workouts.log).sort().pop(); return s.workouts.log[d].find((x) => x.evId); });
  if (!walkLog || walkLog.minutes !== 40 || walkLog.intensity !== 'easy' || walkLog.name !== 'Walk with friends') errors.push('calendar walk should be logged as movement: ' + JSON.stringify(walkLog));
  await page.reload();
  await page.waitForSelector('.k-event.is-done:has-text("Walk with friends")').catch(() => errors.push('done walk should stay done after reload'));
  // Plan tomorrow: give tomorrow's first planned session a time and place; it's linked, not duplicated
  await page.goto(base + '#/plan');
  await page.waitForSelector('main h1:has-text("Plan tomorrow")'); // not Today's evening "Plan tomorrow" card
  const tmr = ymd(new Date(Date.now() + 864e5));
  if (await page.locator('form[data-form=planSetWhen]').count()) {
    const key = await page.getAttribute('form[data-form=planSetWhen] >> nth=0', 'data-key');
    await page.fill('form[data-form=planSetWhen] >> nth=0 >> input[name=time]', '07:15');
    await page.fill('form[data-form=planSetWhen] >> nth=0 >> input[name=place]', 'Gym');
    await page.click('form[data-form=planSetWhen] >> nth=0 >> button');
    await page.waitForSelector('.plan-set:has-text("07:15 · Gym")');
    const pe = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).events);
    const linked = pe.filter((e) => e.planKey === key && e.date === tmr);
    if (linked.length !== 1 || linked[0].time !== '07:15') errors.push('plan time not saved as a linked event: ' + JSON.stringify(pe));
    // Updating keeps one event
    await page.fill('form[data-form=planSetWhen] >> nth=0 >> input[name=time]', '07:45');
    await page.click('form[data-form=planSetWhen] >> nth=0 >> button');
    await page.waitForSelector('.plan-set:has-text("07:45")');
    if ((await page.evaluate((k) => JSON.parse(localStorage.getItem('habitlab.v1')).events.filter((e) => e.planKey === k).length, key)) !== 1) errors.push('updating the time duplicated the event');
    // On the calendar the session shows once, with its time
    await page.goto(base + '#/calendar');
    await page.waitForSelector('.cal-ev:has-text("07:45")');
  } else {
    await page.waitForSelector('text=Rest day on the plan');
  }
  await page.goto(base + '#/plan');
  await page.click('button[data-action=planDone]');
  await page.waitForSelector('text=Tomorrow is planned.');
  if ((await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).flags.planned)) !== tmr) errors.push('planned flag');

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
  // Cheers and joins live in the inbox: not listed on the calendar card; Today and the top bar say something's new
  if (/So proud of you!/.test(await page.textContent('.share-card'))) errors.push('cheers should be in the inbox, not on the calendar card');
  if (!(await page.locator('.share-card a[href="#/inbox"]').count())) errors.push('calendar card should link to the inbox');
  await page.goto(base + '#/today');
  await page.waitForSelector('.inbox-note:has-text("Maria sent you a cheer")', { timeout: 8000 }).catch(() => errors.push('Today should say Maria sent a cheer'));
  if ((await page.textContent('.topbar .inbox-badge').catch(() => '')) !== '1') errors.push('top bar inbox should show 1 new');
  await page.click('.topbar .inbox-btn');
  await page.waitForSelector('.inbox-item:has-text("So proud of you!")');
  if (!(await page.locator('.inbox-item.new:has-text("Maria")').count())) errors.push('the new cheer should be marked new in the inbox');
  if (!(await page.locator('.inbox-item:has-text("Sam"):has-text("Joining you: Walk with friends")').count())) errors.push('joins should be in the inbox');
  await page.goto(base + '#/today');
  await page.waitForTimeout(300);
  if (await page.locator('.inbox-note').count()) errors.push('after opening the inbox, Today’s note should go away');
  if (await page.locator('.topbar .inbox-badge').count()) errors.push('after opening the inbox, the badge should go away');
  if ((await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).share.seen)) !== 7) errors.push('seen cheer not remembered');

  // A new friend joins while the app is open → an in-app message (the phone also notifies in the background)
  extraJoin = true;
  await page.waitForTimeout(21000); // the app checks at most every 20 s
  await page.goto(base + '#/calendar');
  await page.waitForSelector('.toast.show >> text=James is joining you', { timeout: 8000 }).catch(() => errors.push('no in-app message when a friend joins'));

  // ---- Views: Day / 3 days / Week / Month / Schedule ----
  await page.goto(base + '#/calendar');
  for (const [v, sel, n] of [['day', '.cg-col', 1], ['3day', '.cg-col', 3], ['week', '.cg-col', 7], ['month', '.cm-cell', 35]]) {
    await page.click(`.cal-views [data-v="${v}"]`);
    await page.waitForSelector(sel);
    const c = await page.locator(sel).count();
    if (v === 'month' ? c < n : c !== n) errors.push(`${v} view: ${c} ${sel}`);
  }
  // Month → tap a date → that day
  await page.click(`.cm-cell[data-drop-date="${today}"] .cm-date`);
  await page.waitForSelector('.cg-col');
  if ((await page.locator('.cg-col').count()) !== 1) errors.push('tapping a month date should open the day');

  // ---- Repeating: a yoga session every week on today's weekday ----
  await page.click('.cal-views [data-v="list"]');
  await page.waitForSelector('.cal-day');
  await page.click(`.cal-day[data-drop-date="${today}"] button[data-action=calAdd]`);
  await page.fill('.sheet input[name=title]', 'Yoga');
  await page.fill('.sheet input[name=time]', '07:00');
  await page.selectOption('.sheet select[name=repeat]', 'weekly');
  await page.waitForSelector('.sheet .cal-rdays:not([hidden])');
  await page.click('.sheet button:has-text("Add to calendar")');
  await page.waitForSelector('.cal-ev:has-text("Yoga")');
  const yogaRows = await page.locator('.cal-ev:has-text("Yoga")').count();
  if (yogaRows !== 2) errors.push(`weekly event should show on 2 days in 14: ${yogaRows}`);
  const yoga = (await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).events)).find((e) => e.title === 'Yoga');
  if (yoga?.repeat?.freq !== 'weekly') errors.push('repeat not saved: ' + JSON.stringify(yoga));

  // ---- Long-press and drag: next week's yoga → the day after (just that one moves) ----
  const wk = ymd(new Date(Date.now() + 7 * 864e5));
  const wk1 = ymd(new Date(Date.now() + 8 * 864e5));
  const noSheet = () => page.waitForFunction(() => !document.querySelector('.sheet, .sheet-scrim'), null, { timeout: 5000 }).catch(() => {});
  const dragTo = async (src, dst, dy = 0) => {
    await noSheet();
    const a = await page.locator(src).boundingBox();
    const b2 = await page.locator(dst).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + a.width / 2 + ((b2.x + b2.width / 2) - (a.x + a.width / 2)) * i / 8, a.y + a.height / 2 + ((b2.y + (dy || b2.height / 2)) - (a.y + a.height / 2)) * i / 8);
    await page.mouse.up();
    await page.waitForTimeout(400);
  };
  await page.locator(`.cal-day[data-drop-date="${wk1}"]`).scrollIntoViewIfNeeded();
  await dragTo(`.cal-day[data-drop-date="${wk}"] .cal-ev:has-text("Yoga")`, `.cal-day[data-drop-date="${wk1}"]`);
  let evs = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).events);
  const series = evs.find((e) => e.id === yoga.id);
  const moved = evs.find((e) => e.title === 'Yoga' && !e.repeat);
  if (!series?.skip?.includes(wk) || moved?.date !== wk1 || moved?.time !== '07:00') errors.push('dragging one repeat should move just that one: ' + JSON.stringify(evs.filter((e) => e.title === 'Yoga')));
  if (await page.locator('.sheet.open').count()) errors.push('the tap ending a drag opened the item');
  // Delete just today's yoga
  await page.click(`.cal-day[data-drop-date="${today}"] .cal-ev:has-text("Yoga")`);
  await page.click('.sheet button[data-action=calDeleteOne]');
  await page.waitForTimeout(300);
  evs = await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).events);
  if (!evs.find((e) => e.id === yoga.id)?.skip?.includes(today)) errors.push('delete this one');

  // ---- Drag in the time grid: the walk (moved to 09:00 today) → tomorrow at 10:00 ----
  await page.evaluate((id) => {
    const st = JSON.parse(localStorage.getItem('habitlab.v1'));
    st.events = st.events.map((e) => (e.id === id ? { ...e, time: '09:00' } : e));
    localStorage.setItem('habitlab.v1', JSON.stringify(st));
  }, eventId);
  await page.reload();
  await page.click('.cal-views [data-v="3day"]');
  await page.waitForSelector('.cg-col');
  await page.evaluate(() => (document.querySelector('.cg-scroll').scrollTop = (8 - 6) * 48));
  await page.locator('.cg-scroll').scrollIntoViewIfNeeded();
  await noSheet();
  const tmrISO = ymd(new Date(Date.now() + 864e5));
  const a = await page.locator('.cg-ev:has-text("Walk with friends")').boundingBox();
  const tmrCol = await page.locator(`.cg-col[data-drop-date="${tmrISO}"]`).boundingBox();
  const y10 = tmrCol.y + (10 - 6) * 48 + 2;
  await page.mouse.move(a.x + a.width / 2, a.y + 4);
  await page.mouse.down();
  await page.waitForTimeout(600);
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + a.width / 2 + (tmrCol.x + tmrCol.width / 2 - a.x - a.width / 2) * i / 8, a.y + 4 + (y10 - a.y - 4) * i / 8);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const walk = (await page.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).events)).find((e) => e.id === eventId);
  if (walk?.date !== ymd(new Date(Date.now() + 864e5)) || walk?.time !== '10:00') errors.push('drag in the grid should set day and time: ' + JSON.stringify(walk));
  // A short tap still opens it (no drag)
  await page.click('.cg-ev:has-text("Walk with friends")');
  await page.waitForSelector('.sheet.open');
  await page.keyboard.press('Escape');
  await ctx.close();

  // ---- A friend opens the link (no Habit Lab data on their phone) ----
  const fctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const calId = link.split('/').pop();
  await mock(fctx, {
    hl_calendar: (b) => (b.p_id === calId ? { name: 'Alex', events: [{ id: 'ev1', title: 'Walk with friends', date: today, time: '23:58', place: 'Lake loop', kind: 'walk', notes: '', going: 0 }] } : null),
    hl_join: (b) => (b.p_name ? { going: 1 } : null),
    hl_cheer: null,
  });
  const fp = await fctx.newPage();
  fp.on('pageerror', (e) => errors.push('friend pageerror: ' + e.message));
  await fp.goto(base + '#/join/' + calId);
  await fp.waitForSelector('.join-ev');
  if (!/Alex has asked for your support/.test(await fp.textContent('h1'))) errors.push('join heading: ' + (await fp.textContent('h1')));
  if (!/No app, no account/.test(await fp.textContent('main'))) errors.push('should say no app or account is needed');
  if (await fp.locator('text=Get started').count()) errors.push('friend sent to the get-started page');
  if (await fp.locator('.bottomnav a').count()) errors.push('join page should not show the app navigation');
  await fp.click('button[data-action=joinAsk]');
  await fp.fill('form[data-form=joinSave] input[name=name]', 'Sam');
  await fp.click('form[data-form=joinSave] button');
  await fp.waitForSelector('text=You’re in!');
  // Add to my calendar: an .ics file with the activity
  const [dl] = await Promise.all([fp.waitForEvent('download'), fp.click('button[data-action=joinIcs]')]);
  const ics = require('fs').readFileSync(await dl.path(), 'utf8');
  if (!/BEGIN:VEVENT/.test(ics) || !/SUMMARY:Walk with friends with Alex/.test(ics) || !/LOCATION:Lake loop/.test(ics) || !new RegExp(`DTSTART:${today.replace(/-/g, '')}T235800`).test(ics)) errors.push('ics: ' + ics);
  // Send a cheer
  await fp.click('form[data-form=joinCheer] button[data-action=joinCheerQuick] >> nth=0');
  await fp.click('form[data-form=joinCheer] button:has-text("Send cheer")');
  await fp.waitForSelector('text=Sent!');
  if (!calls.some((c) => c.fn === 'hl_cheer' && c.body.p_name === 'Sam' && c.body.p_message === 'So proud of you!')) errors.push('cheer call');
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
