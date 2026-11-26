// Activity calendar: your planned week plus your own events (walks, batch cooking, a gym class,
// a habit you want to do at a set time). Events can be opened to friends, who can sign up from
// your shared link (js/share.js).
import { esc, icon, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { addDays, weekStart } from '../engine/util.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { itemName } from './planmove.js';
import { itemKey } from '../engine/workouts.js';
import * as share from '../share.js';

export const EVENT_KINDS = {
  walk: { label: 'Walk', emoji: '🚶' },
  workout: { label: 'Workout', emoji: '💪' },
  sport: { label: 'Sport / class', emoji: '🏸' },
  outdoors: { label: 'Outdoors', emoji: '🥾' },
  cooking: { label: 'Batch cooking', emoji: '🍲' },
  shopping: { label: 'Food shopping', emoji: '🛒' },
  habit: { label: 'Habit', emoji: '✅' },
  other: { label: 'Other', emoji: '📌' },
};
const QUICK = [['walk', 'Walk'], ['cooking', 'Batch cooking'], ['workout', 'Gym'], ['outdoors', 'Hike'], ['sport', 'Swim'], ['shopping', 'Food shopping'], ['cooking', 'Meal prep'], ['walk', 'Walk with friends']];

let anchor = null; // first day shown (agenda of 14 days)

/** Your events on a date, by time. */
export function eventsOn(state, date) {
  return (state.events || []).filter((e) => e.date === date).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}

const plannedOn = (state, date) => store.schedule(state, date).schedule[(new Date(date + 'T12:00').getDay() + 6) % 7].items.filter((i) => i.kind !== 'rest');

function eventRow(state, e) {
  const k = EVENT_KINDS[e.kind] || EVENT_KINDS.other;
  const joins = share.signupsFor(e.id);
  return `<li><button class="cal-ev" data-action="calEdit" data-id="${esc(e.id)}"><span class="cal-emoji" aria-hidden="true">${k.emoji}</span><span class="grow"><strong>${esc(e.title)}</strong><small>${e.time ? esc(e.time) : 'Any time'}${e.place ? ` · ${esc(e.place)}` : ''}</small></span>${e.public ? `<span class="tag ${joins.length ? 'green' : ''}">${joins.length ? `${joins.length} joining` : 'Open to friends'}</span>` : ''}</button></li>`;
}

function agenda(state, from, days = 14) {
  const today = store.today();
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    const evs = eventsOn(state, d);
    const plan = plannedOn(state, d);
    out.push(`<section class="cal-day ${d === today ? 'today' : ''}" aria-label="${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}">
      <div class="cal-date"><b>${esc(fmtDate(d, { weekday: 'short' }))}</b><span>${new Date(d + 'T12:00').getDate()}</span></div>
      <ul class="cal-items">
        ${plan.map((it) => `<li><button class="cal-plan" data-action="calFromPlan" data-date="${d}" data-key="${esc(itemKey(it))}" data-title="${esc(itemName(it))}" data-kind="${it.kind === 'activity' ? 'sport' : it.kind === 'cardio' ? 'walk' : 'workout'}"><span class="cal-emoji" aria-hidden="true">${it.kind === 'strength' ? '💪' : it.kind === 'cardio' ? '🚶' : '🏸'}</span><span class="grow">${esc(itemName(it))}<small>From your plan · tap to set a time and place</small></span></button></li>`).join('')}
        ${evs.map((e) => eventRow(state, e)).join('')}
        <li><button class="cal-add" data-action="calAdd" data-date="${d}">${icon('plus')} Add</button></li>
      </ul></section>`);
  }
  return out.join('');
}

function editorHtml(state, ev) {
  const e = ev || { id: '', title: '', date: store.today(), time: '', place: '', kind: 'walk', notes: '', public: false };
  const isNew = !ev?.id;
  const joins = e.id ? share.signupsFor(e.id) : [];
  return `<div class="sheet-head"><div><div class="over">${isNew ? 'New in your calendar' : 'Your calendar'}</div><h2>${isNew ? 'Plan something' : esc(e.title)}</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <form data-form="calSave" data-id="${esc(e.id)}">
      ${isNew ? `<div class="quick-chips" style="margin-bottom:8px">${QUICK.map(([k, t]) => `<button type="button" data-action="calQuick" data-kind="${k}" data-title="${esc(t)}">${EVENT_KINDS[k].emoji} ${esc(t)}</button>`).join('')}</div>` : ''}
      <label class="field"><span>What</span><input type="text" name="title" maxlength="60" required value="${esc(e.title)}" placeholder="e.g. Walk round the lake"></label>
      <div class="grid two" style="gap:0 12px;margin:0">
        <label class="field"><span>Day</span><input type="date" name="date" required value="${esc(e.date)}" min="${addDays(store.today(), -7)}"></label>
        <label class="field"><span>Time</span><input type="time" name="time" value="${esc(e.time || '')}"></label>
      </div>
      <label class="field"><span>Where <span class="hint">optional</span></span><input type="text" name="place" maxlength="80" value="${esc(e.place || '')}" placeholder="e.g. the park by the library"></label>
      <label class="field"><span>Type</span><select name="kind">${Object.entries(EVENT_KINDS).map(([k, v]) => `<option value="${k}" ${k === e.kind ? 'selected' : ''}>${v.emoji} ${v.label}</option>`).join('')}</select></label>
      <label class="field"><span>Note <span class="hint">optional</span></span><input type="text" name="notes" maxlength="140" value="${esc(e.notes || '')}" placeholder="e.g. bring water, 5 km loop"></label>
      <label class="row nowrap cal-public"><input type="checkbox" name="public" value="1" ${e.public ? 'checked' : ''}><span><strong>Open to friends</strong><small>Shows on your shared calendar so people can say “I’ll join”. Only what, when and where is shared.</small></span></label>
      ${joins.length ? `<div class="notice ok" style="margin-top:10px">${icon('check')}<div><strong>${joins.length} joining:</strong> ${joins.map((j) => esc(j.name)).join(', ')}</div></div>` : ''}
      <div class="row" style="margin-top:14px"><button class="btn primary">${isNew ? 'Add to calendar' : 'Save'}</button>${isNew ? '' : `<button type="button" class="btn ghost danger" data-action="calDelete" data-id="${esc(e.id)}">Delete</button>`}</div>
    </form>`;
}

let draft = null;

export default {
  render(state) {
    const today = store.today();
    if (!anchor || anchor < addDays(today, -28)) anchor = today;
    const pub = (state.events || []).filter((e) => e.public && e.date >= today).length;
    return `<header class="page-head"><div><div class="eyebrow">Move</div><h1>Calendar</h1></div></header>
      <p class="muted" style="margin:-8px 0 12px">Your plan, plus your own walks, batch cooking and plans with friends. Deciding <em>when and where</em> makes it far more likely to happen.</p>
      ${share.shareCardHtml(state, pub)}
      <div class="row between nowrap" style="margin:6px 0 10px">
        <button class="btn small ghost" data-action="calShift" data-d="-7">${icon('chevron')} Earlier</button>
        ${anchor !== today ? '<button class="btn small" data-action="calShift" data-d="0">Today</button>' : ''}
        <button class="btn small ghost" data-action="calShift" data-d="7">Later ${icon('chevron')}</button>
      </div>
      <div class="cal">${agenda(state, anchor)}</div>
      <button class="btn primary block" data-action="calAdd" data-date="${today}" style="margin-top:12px">${icon('plus')} Add to calendar</button>`;
  },
  after(root, ctx) {
    share.refresh(ctx);
  },
  actions: {
    calShift(el, ev, ctx) {
      const d = Number(el.dataset.d);
      anchor = d === 0 ? store.today() : addDays(anchor, d);
      ctx.rerender();
    },
    ...share.shareActions,
  },
};

/** Global actions (also used from Today and evening planning). */
export const calendarActions = {
  calAdd(el, ev, ctx) {
    draft = null;
    openSheet(editorHtml(ctx.state, { id: '', title: '', date: el.dataset.date || store.today(), time: el.dataset.time || '', place: '', kind: el.dataset.kind || 'walk', notes: '', public: false }), { label: 'Add to calendar' });
  },
  calFromPlan(el, ev, ctx) {
    openSheet(editorHtml(ctx.state, { id: '', title: el.dataset.title, date: el.dataset.date, time: '', place: '', kind: el.dataset.kind, notes: '', public: false, planKey: el.dataset.key }), { label: 'Set a time' });
  },
  calQuick(el) {
    const f = el.closest('form');
    f.querySelector('[name=title]').value = el.dataset.title;
    f.querySelector('[name=kind]').value = el.dataset.kind;
    f.querySelector('[name=time]').focus();
  },
  calEdit(el, ev, ctx) {
    const e = (ctx.state.events || []).find((x) => x.id === el.dataset.id);
    if (e) openSheet(editorHtml(ctx.state, e), { label: 'Edit' });
  },
  calSave(form, ev, ctx, data) {
    const title = String(data.title || '').trim().slice(0, 60);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')) return;
    const id = form.dataset.id || `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const e = { id, title, date: data.date, time: /^\d{2}:\d{2}$/.test(data.time || '') ? data.time : '', place: String(data.place || '').trim().slice(0, 80), kind: EVENT_KINDS[data.kind] ? data.kind : 'other', notes: String(data.notes || '').trim().slice(0, 140), public: data.public === '1' };
    closeSheet();
    ctx.update((st) => {
      const list = (st.events || []).filter((x) => x.id !== id);
      st.events = [...list, e].sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
      return st;
    }, { quiet: true });
    ctx.toast(form.dataset.id ? 'Saved' : `Added — ${fmtDate(e.date, { weekday: 'long' })}${e.time ? ` at ${e.time}` : ''}`);
    share.sync(ctx);
  },
  async calDelete(el, ev, ctx) {
    if (!(await ctx.confirm('Delete this from your calendar?', { ok: 'Delete' }))) return;
    closeSheet();
    ctx.update((st) => {
      st.events = (st.events || []).filter((x) => x.id !== el.dataset.id);
      return st;
    }, { quiet: true });
    share.sync(ctx);
  },
};

void weekStart;
