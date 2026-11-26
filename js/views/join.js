// The page friends see from your shared link (#/join/<id>): your upcoming open activities and an
// "I'll join" button. Works without a Habit Lab account or any data on their device.
import { esc, icon, fmtDate } from '../ui/dom.js';
import { rpc } from '../share.js';
import { EVENT_KINDS } from './calendar.js';

let data = null; // { id, cal, error }
const joined = new Set();
let asking = null;

const myName = () => {
  try {
    return localStorage.getItem('habitlab.joinName') || '';
  } catch (e) {
    return '';
  }
};

function eventCard(e, id) {
  const k = EVENT_KINDS[e.kind] || EVENT_KINDS.other;
  const key = `${id}:${e.id}`;
  const done = joined.has(key);
  return `<li class="join-ev card">
    <div class="row nowrap" style="gap:12px;align-items:flex-start"><span class="cal-emoji big" aria-hidden="true">${k.emoji}</span>
      <div class="grow"><strong>${esc(e.title)}</strong>
        <div class="muted" style="font-size:var(--text-sm)">${esc(fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${e.time ? ` · ${esc(e.time)}` : ''}${e.place ? ` · ${esc(e.place)}` : ''}</div>
        ${e.notes ? `<div style="font-size:var(--text-sm);margin-top:4px">${esc(e.notes)}</div>` : ''}
        <div class="muted" style="font-size:var(--text-xs);margin-top:4px">${e.going ? `${e.going} joining` : 'Be the first to join'}</div></div></div>
    ${done ? `<div class="notice ok" style="margin:10px 0 0">${icon('check')}<div>You’re in! See you there.</div></div>`
      : asking === key ? `<form data-form="joinSave" data-event="${esc(e.id)}" class="row nowrap" style="gap:8px;margin-top:10px"><input type="text" name="name" maxlength="40" required value="${esc(myName())}" placeholder="Your name" aria-label="Your name" style="flex:1;min-width:0" autofocus><button class="btn primary">Join</button></form>`
      : `<button class="btn primary block" data-action="joinAsk" data-event="${esc(e.id)}" style="margin-top:10px">I’ll join</button>`}
  </li>`;
}

export default {
  render(state, params) {
    const id = params[0] || '';
    if (data?.id !== id) data = { id, cal: undefined };
    const cal = data.cal;
    const body = !/^[0-9a-f-]{36}$/i.test(id) ? '<p>This link doesn’t look right — ask for it again.</p>'
      : data.error ? `<div class="notice warn">${icon('alert')}<div>${esc(data.error)}</div></div><button class="btn" data-action="joinReload">Try again</button>`
      : cal === undefined ? '<p class="muted">Loading…</p>'
      : cal === null ? '<p>This calendar isn’t shared any more.</p>'
      : cal.events.length ? `<ul class="join-list">${cal.events.map((e) => eventCard(e, id)).join('')}</ul>` : '<p class="muted">Nothing planned to join right now — check back soon.</p>';
    return `<div class="join-page">
      <div class="eyebrow">Habit Lab</div>
      <h1>${cal?.name ? `Join ${esc(cal.name)}` : 'Join in'}</h1>
      <p class="join-intro">${cal?.name ? esc(cal.name) : 'Your friend'} is making some healthy changes — and it’s easier together. Pick something to join.</p>
      ${body}
      <p class="muted" style="font-size:var(--text-xs);margin-top:24px">Joining shares only the name you type with ${cal?.name ? esc(cal.name) : 'them'}. <a href="#/start">Make your own plan with Habit Lab</a></p>
    </div>`;
  },
  async after(root, ctx, params) {
    if (data.cal !== undefined || data.error || !/^[0-9a-f-]{36}$/i.test(data.id)) return;
    try {
      data.cal = await rpc('hl_calendar', { p_id: data.id });
    } catch (e) {
      data.error = 'Couldn’t load the calendar. Check your connection.';
    }
    ctx.rerender();
  },
  actions: {
    joinAsk(el, ev, ctx) {
      asking = `${data.id}:${el.dataset.event}`;
      ctx.rerender();
      setTimeout(() => document.querySelector('form[data-form=joinSave] input')?.focus(), 30);
    },
    async joinSave(form, ev, ctx, d) {
      const name = String(d.name || '').trim().slice(0, 40);
      if (!name) return;
      try {
        localStorage.setItem('habitlab.joinName', name);
      } catch (e) {
        /* private mode */
      }
      try {
        const r = await rpc('hl_join', { p_id: data.id, p_event: form.dataset.event, p_name: name });
        joined.add(`${data.id}:${form.dataset.event}`);
        const e = data.cal.events.find((x) => x.id === form.dataset.event);
        if (e && r?.going) e.going = r.going;
        asking = null;
        ctx.rerender();
      } catch (e) {
        ctx.toast(e.message || 'Couldn’t join — try again.');
      }
    },
    joinReload(el, ev, ctx) {
      data = null;
      ctx.rerender();
    },
  },
};
