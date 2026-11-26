// The page friends land on from your shared link (#/join/<id>). They don't need the app or an
// account: it says who asked for their support, lets them join an activity with just a first name
// (and add it to their own calendar), or send a short cheer. Nothing is stored on their phone except
// the name they typed, so it's filled in next time.
import { esc, icon, fmtDate } from '../ui/dom.js';
import { rpc } from '../share.js';
import { EVENT_KINDS } from './calendar.js';

let data = null; // { id, cal, error }
const joined = new Set();
let asking = null;
let cheered = false;

const myName = () => {
  try {
    return localStorage.getItem('habitlab.joinName') || '';
  } catch (e) {
    return '';
  }
};
const rememberName = (n) => {
  try {
    localStorage.setItem('habitlab.joinName', n);
  } catch (e) {
    /* private mode */
  }
};

/** A calendar file for one activity, so a guest can add it to their own phone calendar. */
export function icsFor(e, host) {
  const d = e.date.replace(/-/g, '');
  const pad = (n) => String(n).padStart(2, '0');
  let when;
  if (e.time) {
    const [h, m] = e.time.split(':').map(Number);
    const end = h * 60 + m + 60;
    when = `DTSTART:${d}T${pad(h)}${pad(m)}00\r\nDTEND:${d}T${pad(Math.floor(end / 60) % 24)}${pad(end % 60)}00`;
  } else {
    const next = new Date(e.date + 'T12:00');
    next.setDate(next.getDate() + 1);
    when = `DTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
  }
  const clean = (s) => String(s || '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/[\r\n]+/g, ' ');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Habit Lab//Join//EN', 'BEGIN:VEVENT', `UID:${clean(e.id)}@habitlab`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, when,
    `SUMMARY:${clean(e.title)}${host ? ` with ${clean(host)}` : ''}`, e.place ? `LOCATION:${clean(e.place)}` : '', e.notes ? `DESCRIPTION:${clean(e.notes)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}

function eventCard(e, id, host) {
  const k = EVENT_KINDS[e.kind] || EVENT_KINDS.other;
  const key = `${id}:${e.id}`;
  const done = joined.has(key);
  return `<li class="join-ev card">
    <div class="row nowrap" style="gap:12px;align-items:flex-start"><span class="cal-emoji big" aria-hidden="true">${k.emoji}</span>
      <div class="grow"><strong>${esc(e.title)}</strong>
        <div class="muted" style="font-size:var(--text-sm)">${esc(fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${e.time ? ` · ${esc(e.time)}` : ''}${e.place ? ` · ${esc(e.place)}` : ''}</div>
        ${e.notes ? `<div style="font-size:var(--text-sm);margin-top:4px">${esc(e.notes)}</div>` : ''}
        <div class="muted" style="font-size:var(--text-xs);margin-top:4px">${e.going ? `${e.going} joining` : 'Be the first to join'}</div></div></div>
    ${done ? `<div class="notice ok" style="margin:10px 0 0">${icon('check')}<div class="grow">You’re in! ${esc(host)} will see you’re coming.</div></div>
        <button class="btn block" data-action="joinIcs" data-event="${esc(e.id)}" style="margin-top:8px">${icon('calendar')} Add to my calendar</button>`
      : asking === key ? `<form data-form="joinSave" data-event="${esc(e.id)}" class="row nowrap" style="gap:8px;margin-top:10px"><input type="text" name="name" maxlength="40" required value="${esc(myName())}" placeholder="Your first name" aria-label="Your first name" style="flex:1;min-width:0" autocomplete="given-name"><button class="btn primary">Join</button></form>`
      : `<button class="btn primary block" data-action="joinAsk" data-event="${esc(e.id)}" style="margin-top:10px">I’ll join</button>`}
  </li>`;
}

function cheerBlock(host) {
  if (cheered) return `<div class="card join-cheer"><div class="notice ok" style="margin:0">${icon('check')}<div>Sent! ${esc(host)} will see your cheer in the app.</div></div></div>`;
  return `<div class="card join-cheer"><h2>💌 Can’t make it? Send a cheer</h2>
    <p class="muted" style="font-size:var(--text-sm);margin-top:-4px">A few kind words go a long way on a hard day.</p>
    <form data-form="joinCheer">
      <input type="text" name="name" maxlength="40" required value="${esc(myName())}" placeholder="Your first name" aria-label="Your first name" autocomplete="given-name">
      <textarea name="message" maxlength="200" rows="2" required placeholder="e.g. So proud of you — keep going!" aria-label="Your message" style="margin-top:8px"></textarea>
      <div class="quick-chips" style="margin-top:6px">${['So proud of you!', 'You’ve got this 💪', 'One step at a time — I’m with you.'].map((t) => `<button type="button" data-action="joinCheerQuick" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <button class="btn block" style="margin-top:10px">Send cheer</button>
    </form></div>`;
}

export default {
  render(state, params) {
    const id = params[0] || '';
    if (data?.id !== id) {
      data = { id, cal: undefined };
      cheered = false;
    }
    const cal = data.cal;
    const host = cal?.name || 'Your friend';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return `<div class="join-page"><h1>Hmm, that link isn’t complete</h1><p>Ask for it again — it should end with a long code.</p></div>`;
    if (data.error) return `<div class="join-page"><div class="notice warn">${icon('alert')}<div>${esc(data.error)}</div></div><button class="btn" data-action="joinReload">Try again</button></div>`;
    if (cal === undefined) return '<div class="join-page"><p class="muted">Loading…</p></div>';
    if (cal === null) return `<div class="join-page"><h1>This calendar isn’t shared any more</h1><p class="muted">Ask your friend for a new link.</p></div>`;
    return `<div class="join-page">
      <div class="join-hero">
        <div class="join-wave" aria-hidden="true">👋</div>
        <h1>${esc(host)} has asked for your support</h1>
        <p class="join-intro">${esc(host)} is making some healthy changes — and it’s so much easier with friends. Join a walk or an activity, or just send a few kind words.</p>
        <ul class="join-promises">
          <li>${icon('check')} No app, no account — just your first name</li>
          <li>${icon('check')} Only ${esc(host)} sees who’s joining</li>
        </ul>
      </div>
      <h2 class="join-h">Join ${esc(host)}</h2>
      ${cal.events.length ? `<ul class="join-list">${cal.events.map((e) => eventCard(e, id, host)).join('')}</ul>` : `<p class="muted">Nothing to join right now — ${esc(host)} will add plans soon. Keep this link.</p>`}
      ${cheerBlock(host)}
      <p class="muted join-foot">Want a plan of your own? Habit Lab is free and private. <a href="#/start">Make your own</a></p>
    </div>`;
  },
  async after(root, ctx) {
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
      rememberName(name);
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
    joinIcs(el) {
      const e = data?.cal?.events.find((x) => x.id === el.dataset.event);
      if (!e) return;
      const url = URL.createObjectURL(new Blob([icsFor(e, data.cal.name)], { type: 'text/calendar' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${e.title.replace(/[^\w-]+/g, '-').toLowerCase() || 'activity'}.ics`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    joinCheerQuick(el) {
      const t = el.closest('form').querySelector('textarea');
      if (t) t.value = el.dataset.v;
    },
    async joinCheer(form, ev, ctx, d) {
      const name = String(d.name || '').trim().slice(0, 40);
      const message = String(d.message || '').trim().slice(0, 200);
      if (!name || !message) return;
      rememberName(name);
      try {
        await rpc('hl_cheer', { p_id: data.id, p_name: name, p_message: message });
        cheered = true;
        ctx.rerender();
      } catch (e) {
        ctx.toast(e.message || 'Couldn’t send — try again.');
      }
    },
    joinReload(el, ev, ctx) {
      data = null;
      ctx.rerender();
    },
  },
};
