// Sharing your calendar: the activities you open to friends are published to a small Supabase
// database (project "habitlab"); friends open your link and tap "I'll join". Only what, when and
// where is shared, plus the names people type when they join. Nothing else leaves the device.
// Server side: four functions (hl_publish / hl_calendar / hl_join / hl_signups) over locked tables.
import { esc, icon } from './ui/dom.js';
import * as store from './store.js';
import { addDays } from './engine/util.js';
import { expand } from './engine/recur.js';

export const SUPABASE_URL = 'https://jwjabhcebwnzhfphsuwg.supabase.co';
// Publishable key: safe to ship in an app (it only reaches the four functions above).
export const PUBLISHABLE_KEY = 'sb_publishable_wRKoEGC_8OtpR9SoT8tGkQ_Z9rhDWjl';
export const SHARE_BASE = 'https://habitlab-eight.vercel.app/';

let signups = []; // [{event, name, at}] for your calendar
let cheers = []; // [{id, name, message, at}] newest first
let lastFetch = 0;

export async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (e) {
    body = null;
  }
  if (!res.ok) throw new Error(body?.message || 'The calendar service didn’t answer. Try again in a moment.');
  return body;
}

const randomHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${randomHex(4)}-${randomHex(2)}-4${randomHex(2).slice(1)}-a${randomHex(2).slice(1)}-${randomHex(6)}`);

export const shareLink = (state) => (state.share?.id ? `${SHARE_BASE}#/join/${state.share.id}` : '');
export const signupsFor = (eventId) => signups.filter((s) => s.event === eventId);
export const cheersList = () => cheers;
/** Cheers you haven't seen yet (newer than the last one you dismissed). */
export const newCheers = (state) => cheers.filter((c) => c.id > (state.share?.seen || 0));
const cheerHtml = (c) => `<li><strong>${esc(c.name)}</strong> <span class="muted">${esc(new Date(c.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))}</span><div>${esc(c.message)}</div></li>`;

/** Today: a card with new cheers from friends. */
export function cheerCardHtml(state) {
  const fresh = newCheers(state);
  if (!fresh.length) return '';
  return `<section class="card cheer-card" aria-label="Cheers from friends"><div class="row between nowrap"><h2 style="margin:0;font-size:var(--text-lg)">💌 ${fresh.length === 1 ? `${esc(fresh[0].name)} is cheering you on` : `${fresh.length} friends are cheering you on`}</h2><button class="btn small ghost" data-action="cheersSeen" data-id="${fresh[0].id}">Thanks!</button></div>
    <ul class="cheer-list">${fresh.slice(0, 3).map(cheerHtml).join('')}</ul></section>`;
}

/** The events friends can see: open to friends, from yesterday on. */
export function publicEvents(state) {
  const from = addDays(store.today(), -1);
  // Repeating events are shared as their next 8 weeks of dates, each joinable on its own.
  return expand((state.events || []).filter((e) => e.public), from, addDays(from, 56)).slice(0, 200)
    .map((e) => ({ id: e.series ? `${e.series}_${e.date.replace(/-/g, '')}` : e.id, title: e.title, date: e.date, time: e.time, place: e.place, kind: e.kind, notes: e.notes }));
}

/** Publish after a change (only once you've created a link). */
export async function sync(ctx) {
  const s = ctx.state.share;
  if (!s?.id) return;
  try {
    await rpc('hl_publish', { p_id: s.id, p_key: s.key, p_name: s.name || '', p_events: publicEvents(ctx.state) });
    watch(ctx.state); // keep notification titles up to date
  } catch (e) {
    ctx.toast('Couldn’t update your shared calendar — you may be offline. It updates next time.');
  }
}

/** Fetch who's joining (at most every 20 s). */
let loadedOnce = false;

/** "Walk with friends · Fri 27 Nov 07:30" for each shared event id (what notifications say). */
function titlesFor(state) {
  const out = {};
  for (const e of publicEvents(state)) out[e.id] = `${e.title} · ${new Date(e.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}${e.time ? ` ${e.time}` : ''}`;
  return out;
}

/** Tell the phone to watch for joins and cheers in the background (Android app), or stop. */
export async function watch(state) {
  const p = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.HabitAlarm : null;
  if (!p?.setFriendsWatch) return;
  const on = !!state.share?.id && state.reminders?.friendsOn !== false;
  try {
    await p.setFriendsWatch({ on, id: state.share?.id || null, key: state.share?.key || null, titles: on ? titlesFor(state) : {} });
  } catch (e) {
    /* older app build */
  }
}

/** Fetch who's joining and cheers (at most every 20 s); say so when something new arrives. */
export async function refresh(ctx, force = false) {
  const s = ctx.state.share;
  if (!s?.id || (!force && Date.now() - lastFetch < 20000)) return;
  lastFetch = Date.now();
  try {
    const [list, ch] = await Promise.all([rpc('hl_signups', { p_id: s.id, p_key: s.key }), rpc('hl_cheers', { p_id: s.id, p_key: s.key }).catch(() => cheers)]);
    const changed = (Array.isArray(list) && JSON.stringify(list) !== JSON.stringify(signups)) || (Array.isArray(ch) && JSON.stringify(ch) !== JSON.stringify(cheers));
    if (loadedOnce && Array.isArray(list)) {
      const had = new Set(signups.map((x) => `${x.event}|${x.name}`));
      const titles = titlesFor(ctx.state);
      const fresh = list.filter((x) => !had.has(`${x.event}|${x.name}`));
      if (fresh.length) ctx.toast(fresh.length === 1 ? `🙌 ${fresh[0].name} is joining you — ${titles[fresh[0].event] || 'your activity'}` : `🙌 ${fresh.length} friends just joined your activities`);
    }
    if (loadedOnce && Array.isArray(ch) && ch.length && (!cheers.length || ch[0].id > cheers[0].id)) ctx.toast(`💌 ${ch[0].name} sent you a cheer: “${ch[0].message}”`);
    if (Array.isArray(list)) signups = list;
    if (Array.isArray(ch)) cheers = ch;
    loadedOnce = true;
    // Seen in the app: the phone won't notify about these again.
    const p = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.HabitAlarm : null;
    p?.friendsSeen?.({ signups, cheer: cheers[0]?.id || 0 }).catch(() => {});
    if (changed) ctx.rerender();
  } catch (e) {
    /* offline: keep what we have */
  }
}

export function shareCardHtml(state, pubCount) {
  const s = state.share;
  if (!s?.id) {
    return `<div class="card share-card"><h2 style="margin-top:0;font-size:var(--text-lg)">${icon("star")} Make changes together</h2>
      <p class="muted" style="font-size:var(--text-sm);margin-top:-4px">Share a link to your calendar. Friends see the activities you mark <strong>Open to friends</strong> and can tap “I’ll join”. Only what, when and where is shared.</p>
      <form data-form="shareCreate" class="row nowrap" style="gap:8px"><input type="text" name="name" maxlength="40" required placeholder="Your first name" aria-label="Your first name" style="flex:1;min-width:0"><button class="btn primary small">Create my link</button></form></div>`;
  }
  const link = shareLink(state);
  const total = signups.length;
  return `<div class="card share-card"><div class="row between nowrap"><h2 style="margin:0;font-size:var(--text-lg)">${icon("star")} Your shared calendar</h2>${total ? `<span class="tag green">${total} joining</span>` : ''}</div>
    <p class="muted" style="font-size:var(--text-sm);margin:6px 0 8px">${pubCount ? `${pubCount} upcoming ${pubCount === 1 ? 'activity is' : 'activities are'} open to friends.` : 'Nothing open to friends yet — tap an activity and switch on “Open to friends”.'}</p>
    <div class="share-link"><input type="text" readonly value="${esc(link)}" aria-label="Your calendar link"><button class="btn small" data-action="shareCopy">Copy</button>${navigator.share ? '<button class="btn small primary" data-action="shareNative">Share</button>' : ''}</div>
    ${cheers.length ? `<div class="over" style="margin-top:12px">💌 Cheers from friends</div><ul class="cheer-list">${cheers.slice(0, 5).map(cheerHtml).join('')}</ul>` : ''}
    <button class="btn ghost small" data-action="shareStop" style="margin-top:8px">Stop sharing</button></div>`;
}

export const shareActions = {
  cheersSeen(el, ev, ctx) {
    const id = Number(el.dataset.id) || 0;
    ctx.update((st) => {
      if (st.share) st.share = { ...st.share, seen: Math.max(st.share.seen || 0, id) };
      return st;
    }, { quiet: true });
  },
  async shareCreate(form, ev, ctx, data) {
    const name = String(data.name || '').trim().slice(0, 40);
    if (!name) return;
    const share = { id: uuid(), key: randomHex(24), name };
    try {
      await rpc('hl_publish', { p_id: share.id, p_key: share.key, p_name: name, p_events: publicEvents(ctx.state) });
    } catch (e) {
      return ctx.toast('Couldn’t create your link — check your connection and try again.');
    }
    ctx.update((st) => {
      st.share = share;
      return st;
    }, { quiet: true });
    ctx.toast('Your link is ready — share it with friends.');
    watch(ctx.state);
  },
  async shareCopy(el, ev, ctx) {
    try {
      await navigator.clipboard.writeText(shareLink(ctx.state));
      ctx.toast('Link copied');
    } catch (e) {
      document.querySelector('.share-link input')?.select();
    }
  },
  async shareNative(el, ev, ctx) {
    try {
      await navigator.share({ title: 'Join me', text: `I’m making some healthy changes — join me for a walk or two? ${ctx.state.share?.name ? `— ${ctx.state.share.name}` : ''}`, url: shareLink(ctx.state) });
    } catch (e) {
      /* cancelled */
    }
  },
  async shareStop(el, ev, ctx) {
    if (!(await ctx.confirm('Stop sharing? Your link stops working and the list of who’s joining is deleted.', { ok: 'Stop sharing' }))) return;
    const s = ctx.state.share;
    try {
      await rpc('hl_unpublish', { p_id: s.id, p_key: s.key });
    } catch (e) {
      return ctx.toast('Couldn’t reach the calendar service — try again when you’re online.');
    }
    signups = [];
    cheers = [];
    ctx.update((st) => {
      delete st.share;
      return st;
    }, { quiet: true });
    ctx.toast('Sharing stopped');
    watch(ctx.state);
  },
};
