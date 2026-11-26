// Sharing your calendar: the activities you open to friends are published to a small Supabase
// database (project "habitlab"); friends open your link and tap "I'll join". Only what, when and
// where is shared, plus the names people type when they join. Nothing else leaves the device.
// Server side: four functions (hl_publish / hl_calendar / hl_join / hl_signups) over locked tables.
import { esc, icon } from './ui/dom.js';
import * as store from './store.js';
import { addDays } from './engine/util.js';

export const SUPABASE_URL = 'https://jwjabhcebwnzhfphsuwg.supabase.co';
// Publishable key: safe to ship in an app (it only reaches the four functions above).
const PUBLISHABLE_KEY = 'sb_publishable_wRKoEGC_8OtpR9SoT8tGkQ_Z9rhDWjl';
export const SHARE_BASE = 'https://habitlab-eight.vercel.app/';

let signups = []; // [{event, name, at}] for your calendar
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

/** The events friends can see: open to friends, from yesterday on. */
export function publicEvents(state) {
  const from = addDays(store.today(), -1);
  return (state.events || []).filter((e) => e.public && e.date >= from).map(({ id, title, date, time, place, kind, notes }) => ({ id, title, date, time, place, kind, notes }));
}

/** Publish after a change (only once you've created a link). */
export async function sync(ctx) {
  const s = ctx.state.share;
  if (!s?.id) return;
  try {
    await rpc('hl_publish', { p_id: s.id, p_key: s.key, p_name: s.name || '', p_events: publicEvents(ctx.state) });
  } catch (e) {
    ctx.toast('Couldn’t update your shared calendar — you may be offline. It updates next time.');
  }
}

/** Fetch who's joining (at most every 20 s). */
export async function refresh(ctx, force = false) {
  const s = ctx.state.share;
  if (!s?.id || (!force && Date.now() - lastFetch < 20000)) return;
  lastFetch = Date.now();
  try {
    const list = await rpc('hl_signups', { p_id: s.id, p_key: s.key });
    if (Array.isArray(list) && JSON.stringify(list) !== JSON.stringify(signups)) {
      signups = list;
      ctx.rerender();
    }
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
    <button class="btn ghost small" data-action="shareStop" style="margin-top:8px">Stop sharing</button></div>`;
}

export const shareActions = {
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
    ctx.update((st) => {
      delete st.share;
      return st;
    }, { quiet: true });
    ctx.toast('Sharing stopped');
  },
};
