// Your account: log in with email and password so your progress is saved online and comes back on a
// new phone. Uses Supabase Auth (same project as the shared calendar) over plain fetch. Your data is
// stored as one private copy that only you can read (functions hl_my_data / hl_save_my_data, which
// check who is logged in). The login itself is kept on this device, outside your app data.
import { SUPABASE_URL, PUBLISHABLE_KEY, SHARE_BASE } from './share.js';
import { mergeStates, isDemo } from './sync.js';
import * as store from './store.js';

const KEY = 'habitlab.account';
const PUSH_DELAY = 4000;

const read = () => {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || 'null');
    return a && typeof a.access_token === 'string' && typeof a.refresh_token === 'string' ? a : null;
  } catch (e) {
    return null;
  }
};
const write = (a) => {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch (e) {
    /* storage blocked */
  }
};

let session = read();
let pushTimer = null;
let synced = false; // pulled from the account since this launch (until then, don't overwrite it)
let busy = null;
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());
export const onChange = (f) => listeners.add(f);

export const current = () => (session ? { email: session.email, lastSync: session.lastSync || 0, pending: !!pushTimer, confirmed: !!justConfirmed } : null);
let justConfirmed = false;
/** Opened from the confirmation email (in a browser): the account page says what to do next. */
export function markConfirmed() {
  justConfirmed = true;
  whoAmI().then(notify);
}

/** Plain-language messages for what Supabase Auth answers. */
function friendly(body, status) {
  const code = body?.error_code || body?.code || body?.error || '';
  const msg = String(body?.msg || body?.message || body?.error_description || '');
  if (/invalid_credentials|invalid_grant/.test(code) || /invalid login/i.test(msg)) return 'Wrong email or password.';
  if (/email_not_confirmed/.test(code) || /not confirmed/i.test(msg)) return 'Confirm your email first — open the link we sent you, then log in.';
  if (/user_already_exists|email_exists/.test(code) || /already registered/i.test(msg)) return 'There’s already an account with this email — log in instead.';
  if (/weak_password/.test(code) || /password should/i.test(msg)) return 'Pick a longer password (at least 8 characters).';
  if (/email_address_invalid|validation_failed/.test(code) || /invalid.*email|email.*invalid/i.test(msg)) return 'That email address doesn’t look right.';
  if (/rate_limit|over_email_send_rate_limit/.test(code) || status === 429) return 'Too many tries — wait a little and try again.';
  if (/signup_disabled/.test(code)) return 'New accounts are switched off right now.';
  if (/email_address_not_authorized/.test(code) || /not authorized/i.test(msg)) return 'We can’t send email to that address yet. Ask the app owner to turn on email for everyone.';
  return msg || 'Something went wrong — check your connection and try again.';
}

async function auth(path, body, { method = 'POST', token } = {}) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method,
      headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('You seem to be offline — try again when you have a connection.');
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = null;
  }
  if (!res.ok) throw new Error(friendly(json, res.status));
  return json;
}

function keep(tokens, extra = {}) {
  if (!tokens?.access_token) return null;
  session = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at || Math.floor(Date.now() / 1000) + (Number(tokens.expires_in) || 3600),
    email: tokens.user?.email || extra.email || session?.email || '',
    lastSync: session?.lastSync || 0,
    ...extra,
  };
  write(session);
  notify();
  return session;
}

async function token() {
  if (!session) return null;
  if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
  try {
    keep(await auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token }));
    return session.access_token;
  } catch (e) {
    if (/Wrong email|invalid|expired|not found/i.test(e.message)) {
      session = null; // the login ran out: log in again
      write(null);
      notify();
    }
    throw e;
  }
}

async function rpc(fn, args = {}) {
  const t = await token();
  if (!t) throw new Error('Log in first.');
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  } catch (e) {
    throw new Error('You seem to be offline.');
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(json?.message || 'Couldn’t reach your account.');
  return json;
}

/** Create an account. Returns { confirm: true } when an email confirmation is needed first. */
export async function signUp(email, password) {
  const r = await auth(`signup?redirect_to=${encodeURIComponent(SHARE_BASE)}`, { email, password });
  if (r?.access_token) {
    keep(r, { email });
    return { confirm: false };
  }
  return { confirm: true };
}

export async function logIn(email, password) {
  keep(await auth('token?grant_type=password', { email, password }), { email });
}

export async function resetPassword(email) {
  await auth(`recover?redirect_to=${encodeURIComponent(SHARE_BASE)}`, { email });
}

export async function setPassword(password) {
  const t = await token();
  await auth('user', { password }, { method: 'PUT', token: t });
}

/** Log out on this phone. Your data stays on the phone and in your account. */
export async function logOut() {
  const t = session?.access_token;
  clearTimeout(pushTimer);
  pushTimer = null;
  session = null;
  synced = false;
  write(null);
  notify();
  if (t) auth('logout', null, { token: t }).catch(() => {});
}

/**
 * A link from an email (confirm your address / reset your password) brings tokens in the address:
 * #access_token=…&refresh_token=…&type=signup|recovery. Keep the login and say what it was for.
 */
export function takeTokensFromUrl() {
  const h = location.hash || '';
  if (!/access_token=/.test(h) || h.startsWith('#/')) {
    if (/error_description=/.test(h) && !h.startsWith('#/')) {
      const p = new URLSearchParams(h.slice(1));
      history.replaceState(null, '', location.pathname + location.search + '#/account');
      return { error: p.get('error_description') || 'That link didn’t work — it may have expired.' };
    }
    return null;
  }
  const p = new URLSearchParams(h.slice(1));
  keep({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in'), expires_at: Number(p.get('expires_at')) || undefined });
  const type = p.get('type') || 'signup';
  history.replaceState(null, '', location.pathname + location.search + (type === 'recovery' ? '#/account/new-password' : '#/account'));
  return { type };
}

/** Fill in the email for a login that came from a link. */
async function whoAmI() {
  if (session && !session.email) {
    try {
      const u = await auth('user', null, { method: 'GET', token: await token() });
      if (u?.email) keep({ ...session, user: u });
    } catch (e) {
      /* fine */
    }
  }
}

/**
 * Bring this phone and your account together: fetch the account's copy, merge it with this phone's,
 * keep the result here and save it to the account. Returns what happened, for a message.
 */
export function syncNow(ctx) {
  if (!session) return Promise.resolve(null);
  if (busy) return busy;
  busy = (async () => {
    await whoAmI();
    const remote = await rpc('hl_my_data');
    const cloud = remote?.data ? store.migrate(remote.data) : null;
    const local = ctx.state;
    const next = mergeStates(local, cloud);
    let outcome = 'same';
    const plain = (s) => JSON.stringify({ ...s, savedAt: 0 });
    if (next !== local) {
      const merged = store.migrate(structuredClone(next));
      if (plain(merged) !== plain(local)) {
        outcome = !local.profile || isDemo(local) ? 'restored' : 'merged';
        ctx.set(merged, { quiet: true });
      }
    } else if (!cloud?.profile && local.profile && !isDemo(local)) outcome = 'uploaded';
    synced = true;
    await push(ctx.state);
    return outcome;
  })().finally(() => {
    busy = null;
  });
  return busy;
}

async function push(state) {
  clearTimeout(pushTimer);
  pushTimer = null;
  if (!session || !synced || !state?.profile || isDemo(state)) return;
  await rpc('hl_save_my_data', { p_data: state, p_saved_at: state.savedAt || Date.now() });
  session.lastSync = Date.now();
  write(session);
  notify();
}

/** After every change: save it to your account a few seconds later (changes in a burst go together). */
export function queue(ctx) {
  if (!session || !synced) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(ctx.state).catch(() => {}), PUSH_DELAY);
}

/** On start (and when the app comes back to the front): catch up with your account. */
export function start(ctx) {
  if (!session) return;
  syncNow(ctx).catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (!session) return;
    if (document.visibilityState === 'hidden' && pushTimer) push(ctx.state).catch(() => {});
    if (document.visibilityState === 'visible') syncNow(ctx).catch(() => {});
  });
}

/** Delete your account's copy of your data (the account login itself stays). */
export async function deleteCloudCopy() {
  await rpc('hl_delete_my_data');
}
