// Accounts: create an account on a phone that already has progress (it goes up to the account),
// keep saving in the background, then log in on a fresh phone and get everything back.
// Supabase Auth and the data functions are mocked — no real accounts are made.
// Usage: node tests/account.cjs [baseUrl]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8771/';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const cloud = { data: null, saved_at: 0, saves: 0 };
  const users = {};
  const SUPA = 'https://jwjabhcebwnzhfphsuwg.supabase.co';
  const session = (email) => ({ access_token: `tok_${email}`, refresh_token: `ref_${email}`, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { email } });
  const mock = async (ctx) => {
    await ctx.route(`${SUPA}/auth/v1/**`, async (route) => {
      const url = route.request().url();
      const body = route.request().postDataJSON() || {};
      const json = (status, b) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
      if (url.includes('/signup')) {
        if (users[body.email]) return json(422, { error_code: 'user_already_exists', msg: 'User already registered' });
        users[body.email] = body.password;
        return json(200, session(body.email));
      }
      if (url.includes('grant_type=password')) return users[body.email] === body.password ? json(200, session(body.email)) : json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      if (url.includes('/logout')) return route.fulfill({ status: 204, body: '' });
      if (url.endsWith('/auth/v1/user')) return json(200, { email: 'test@example.com' });
      return json(404, { msg: 'not mocked' });
    });
    await ctx.route(`${SUPA}/rest/v1/rpc/hl_*`, async (route) => {
      const fn = route.request().url().split('/').pop();
      if (!/^Bearer tok_/.test(route.request().headers().authorization || '')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"no"}' });
      if (fn === 'hl_my_data') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? { data: cloud.data, saved_at: cloud.saved_at } : null) });
      if (fn === 'hl_save_my_data') {
        const b = route.request().postDataJSON();
        cloud.data = b.p_data;
        cloud.saved_at = b.p_saved_at;
        cloud.saves++;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(new Date().toISOString()) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });
  };
  const toastText = (page) => page.textContent('.toast');

  // ---- Phone A: progress already on the phone, then create an account ----
  const a = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mock(a);
  const pa = await a.newPage();
  pa.on('pageerror', (e) => errors.push('A pageerror: ' + e.message));
  await pa.goto(base);
  await pa.evaluate(() => localStorage.clear());
  await pa.goto(base);
  await pa.click('text=Explore with demo data first');
  await pa.waitForSelector('.tg-hero');
  // Make it "real" progress (demo data is never uploaded)
  await pa.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('habitlab.v1'));
    s.profile.demo = false;
    localStorage.setItem('habitlab.v1', JSON.stringify(s));
  });
  await pa.reload();
  await pa.addLocatorHandler(pa.locator('.modal-wrap'), async () => pa.click('.modal-wrap button >> nth=-1'));
  const weighInsA = await pa.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).weights.length);
  await pa.goto(base + '#/settings');
  await pa.click('a[href="#/account"]');
  await pa.click('[data-action=accountMode][data-m=signup]');
  await pa.fill('form[data-form=accountSubmit] input[name=email]', 'test@example.com');
  await pa.fill('form[data-form=accountSubmit] input[name=password]', 'longenough1');
  await pa.click('form[data-form=accountSubmit] button.primary');
  await pa.waitForFunction(() => location.hash === '#/today');
  if (!/saved to your account/.test(await toastText(pa))) errors.push('A: should say progress is saved: ' + (await toastText(pa)));
  if (!cloud.data || cloud.data.weights.length !== weighInsA) errors.push(`A: account should hold this phone's ${weighInsA} weigh-ins, has ${cloud.data?.weights?.length}`);
  // Background saving: log a weigh-in, it reaches the account a few seconds later
  const savesBefore = cloud.saves;
  await pa.click('.bottomnav .tab-log');
  await pa.click('.sheet .ql-tile[data-action=openWeigh]');
  await pa.click('.sheet button[data-action=sheetStep][data-d^="-"]');
  await pa.click('.sheet button:has-text("Save weigh-in")');
  await pa.waitForTimeout(5500);
  if (cloud.saves <= savesBefore) errors.push('A: a new weigh-in should be saved to the account in the background');
  await pa.goto(base + '#/account');
  await pa.waitForSelector('main >> text=test@example.com').catch(() => errors.push('A: account page should show the email'));
  const finalA = await pa.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')));

  // ---- Phone B: brand new, log in from the welcome screen, everything comes back ----
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mock(b);
  const pb = await b.newPage();
  pb.on('pageerror', (e) => errors.push('B pageerror: ' + e.message));
  await pb.goto(base);
  await pb.click('a[href="#/account"]');
  await pb.fill('form[data-form=accountSubmit] input[name=email]', 'test@example.com');
  await pb.fill('form[data-form=accountSubmit] input[name=password]', 'wrong');
  await pb.click('form[data-form=accountSubmit] button.primary');
  await pb.waitForSelector('.toast.show >> text=Wrong email or password');
  await pb.fill('form[data-form=accountSubmit] input[name=password]', 'longenough1');
  await pb.click('form[data-form=accountSubmit] button.primary');
  await pb.waitForSelector('.tg-hero');
  if (!/Welcome back/.test(await toastText(pb))) errors.push('B: should welcome you back: ' + (await toastText(pb)));
  const restored = await pb.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')));
  if (restored.weights.length !== finalA.weights.length) errors.push(`B: weigh-ins restored ${restored.weights.length} of ${finalA.weights.length}`);
  if (Object.keys(restored.habits.log).length !== Object.keys(finalA.habits.log).length) errors.push('B: habit history should be restored');
  // Log out: data stays on the phone
  await pb.goto(base + '#/account');
  await pb.click('[data-action=accountLogout]');
  await pb.click('.modal-wrap button >> nth=-1');
  await pb.waitForSelector('form[data-form=accountSubmit]');
  if (!(await pb.evaluate(() => JSON.parse(localStorage.getItem('habitlab.v1')).profile))) errors.push('B: logging out should keep the data on the phone');
  if (await pb.evaluate(() => localStorage.getItem('habitlab.account'))) errors.push('B: logging out should forget the login');

  // ---- The confirmation email opened in a phone's browser (no progress there): say what to do next ----
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mock(c);
  const pc = await c.newPage();
  pc.on('pageerror', (e) => errors.push('C pageerror: ' + e.message));
  await pc.goto(base + '#access_token=tok_test%40example.com&refresh_token=ref_x&expires_in=3600&token_type=bearer&type=signup');
  await pc.waitForSelector('main >> text=Email confirmed').catch(() => errors.push('C: the confirmation link should say the email is confirmed'));
  if (!(await pc.locator('main >> text=Save your progress → Log in').count())) errors.push('C: should tell you to log in in the app');
  if (/access_token/.test(await pc.evaluate(() => location.href))) errors.push('C: the login tokens should be removed from the address');

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('account ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
