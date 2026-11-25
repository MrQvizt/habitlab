// Web build: production security headers, no CSP violations, installable, and works offline.
// Run against tools/serve.mjs (which applies vercel.json headers): node tests/web.cjs [baseUrl]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8770/';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));

  const res = await page.goto(base);
  const h = res.headers();
  const csp = h['content-security-policy'] || '';
  for (const part of ["default-src 'none'", "script-src 'sha256-", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'none'"]) if (!csp.includes(part)) errors.push('CSP missing: ' + part);
  if (/unsafe-eval|script-src[^;]*unsafe-inline/.test(csp)) errors.push('CSP allows unsafe script');
  if (h['x-content-type-options'] !== 'nosniff') errors.push('missing nosniff');
  if (h['referrer-policy'] !== 'no-referrer') errors.push('missing referrer policy');
  // Inline script injected into the DOM must be blocked by the policy
  const blocked = await page.evaluate(async () => {
    window.__ran = false;
    const s = document.createElement('script');
    s.textContent = 'window.__ran = true';
    document.body.append(s);
    await new Promise((r) => setTimeout(r, 50));
    return !window.__ran;
  });
  if (!blocked) errors.push('CSP did not block an injected inline script');
  errors.splice(0, errors.length, ...errors.filter((e) => !/Content Security Policy/.test(e))); // the block above logs a violation on purpose

  // Installable: manifest linked and served, icons present
  const manifestHref = await page.getAttribute('link[rel=manifest]', 'href');
  if (!manifestHref) errors.push('no manifest link');
  else {
    const m = await (await page.request.get(new URL(manifestHref, base).href)).json();
    if (!m.name || !m.icons?.length || m.display !== 'standalone') errors.push('manifest incomplete');
    for (const icon of m.icons) if (!(await page.request.get(new URL(icon.src, base).href)).ok()) errors.push('icon missing: ' + icon.src);
  }

  // Works offline after the first visit
  await page.click('text=Explore with demo data first');
  await page.waitForSelector('.tg-hero');
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 15000 });
  await page.reload(); // let the active worker control the page and cache it
  await page.waitForSelector('.tg-hero');
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.tg-hero', { timeout: 15000 }).catch(() => errors.push('app did not load offline'));
  await page.goto(base + '#/progress');
  await page.waitForSelector('.hub-grid', { timeout: 15000 }).catch(() => errors.push('navigation failed offline'));
  await context.setOffline(false);

  // Storage full or blocked: the app keeps working and says clearly, on every screen, that
  // changes aren't being saved (a toast alone was replaced by the next toast).
  const full = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await full.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('full', 'QuotaExceededError');
    };
  });
  const fp = await full.newPage();
  fp.on('pageerror', (e) => errors.push('storage-full pageerror: ' + e.message));
  await fp.goto(base);
  await fp.click('text=Explore with demo data first');
  await fp.waitForSelector('.tg-hero');
  await fp.goto(base + '#/progress');
  await fp.waitForSelector('.hub-grid');
  if (!/Changes aren’t being saved/.test((await fp.locator('main .notice[role=alert]').textContent().catch(() => '')) || '')) errors.push('no persistent warning when storage is full');
  await full.close();

  await browser.close();
  const real = errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  if (real.length) {
    console.error(real.join('\n'));
    process.exit(1);
  }
  console.log('web ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
