// Activity calendar, Google/Outlook style: Day, 3 days, Week, Month and Schedule views of your
// planned sessions and your own events (walks, batch cooking, a gym class…). Events can repeat,
// can be opened to friends (js/share.js), and can be moved by long-pressing and dragging them to
// another day (and, in the time-grid views, another time).
import { esc, icon, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { addDays, weekStart, weekOrder } from '../engine/util.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { itemName } from './planmove.js';
import { itemKey } from '../engine/workouts.js';
import { expand, FREQS, repeatLabel } from '../engine/recur.js';
import { buzz } from '../ui/celebrate.js';
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
const VIEWS = [['day', 'Day'], ['3day', '3 days'], ['week', 'Week'], ['month', 'Month'], ['list', 'Schedule']];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const H0 = 6; // first hour shown in the time grid
const H1 = 24;
const PX = 48; // pixels per hour

const loadView = () => {
  try {
    const v = localStorage.getItem('habitlab.calView');
    return VIEWS.some(([k]) => k === v) ? v : '3day';
  } catch (e) {
    return '3day';
  }
};
let view = null;
let anchor = null;
let scrolled = '';
let gridScroll = 0;
let ctxRef = null;

const weekdayOf = (iso) => (new Date(iso + 'T12:00').getDay() + 6) % 7;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const newId = () => `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** The id friends join for one occurrence (repeating events: one per date). */
export const occId = (e) => (e.series ? `${e.series}_${e.date.replace(/-/g, '')}` : e.id);

/** Your events on a date (repeats included), by time. */
export function eventsOn(state, date) {
  return expand(state.events, date, date);
}

const plannedOn = (state, date) => store.schedule(state, date).schedule[weekdayOf(date)].items.filter((i) => i.kind !== 'rest');
const planKind = (it) => (it.kind === 'activity' ? 'sport' : it.kind === 'cardio' ? 'walk' : 'workout');
const planEmoji = (it) => (it.kind === 'strength' ? '💪' : it.kind === 'cardio' ? '🚶' : '🏸');

/** Planned sessions not yet given a time on that day. */
function looseplan(state, date, evs) {
  const linked = new Set(evs.map((e) => e.planKey).filter(Boolean));
  return plannedOn(state, date).filter((it) => !linked.has(itemKey(it)));
}

// ---------- pieces ----------
const dragAttrs = (e) => `data-drag="event" data-id="${esc(e.series || e.id)}" data-date="${e.date}"`;
const planAttrs = (it, date) => `data-drag="plan" data-key="${esc(itemKey(it))}" data-from="${weekdayOf(date)}" data-date="${date}" data-title="${esc(itemName(it))}" data-kind="${planKind(it)}"`;

function chip(e) {
  const k = EVENT_KINDS[e.kind] || EVENT_KINDS.other;
  return `<button class="cal-chip k-${e.kind}" data-action="calEdit" ${dragAttrs(e)} title="${esc(e.title)}">${k.emoji} ${e.time ? `<b>${esc(e.time)}</b> ` : ''}${esc(e.title)}${e.series ? ' ↻' : ''}</button>`;
}
const planChip = (it, date) => `<button class="cal-chip plan" data-action="calFromPlan" ${planAttrs(it, date)}>${planEmoji(it)} ${esc(itemName(it))}</button>`;

function eventRow(state, e) {
  const k = EVENT_KINDS[e.kind] || EVENT_KINDS.other;
  const joins = share.signupsFor(occId(e));
  return `<li><button class="cal-ev" data-action="calEdit" ${dragAttrs(e)}><span class="cal-emoji" aria-hidden="true">${k.emoji}</span><span class="grow"><strong>${esc(e.title)}${e.series ? ' <span class="muted" aria-label="repeats">↻</span>' : ''}</strong><small>${e.time ? esc(e.time) : 'Any time'}${e.place ? ` · ${esc(e.place)}` : ''}</small></span>${e.public ? `<span class="tag ${joins.length ? 'green' : ''}">${joins.length ? `${joins.length} joining` : 'Open to friends'}</span>` : ''}</button></li>`;
}

// ---------- Schedule (list) ----------
function listView(state, from, days = 14) {
  const today = store.today();
  const all = expand(state.events, from, addDays(from, days - 1));
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    const evs = all.filter((e) => e.date === d);
    const plan = looseplan(state, d, evs);
    out.push(`<section class="cal-day ${d === today ? 'today' : ''}" data-drop-date="${d}" aria-label="${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}">
      <div class="cal-date"><b>${esc(fmtDate(d, { weekday: 'short' }))}</b><span>${new Date(d + 'T12:00').getDate()}</span></div>
      <ul class="cal-items">
        ${plan.map((it) => `<li><button class="cal-plan" data-action="calFromPlan" ${planAttrs(it, d)}><span class="cal-emoji" aria-hidden="true">${planEmoji(it)}</span><span class="grow">${esc(itemName(it))}<small>From your plan · tap to set a time and place</small></span></button></li>`).join('')}
        ${evs.map((e) => eventRow(state, e)).join('')}
        <li><button class="cal-add" data-action="calAdd" data-date="${d}">${icon('plus')} Add</button></li>
      </ul></section>`);
  }
  return `<div class="cal">${out.join('')}</div>`;
}

// ---------- Day / 3 days / Week (time grid) ----------
/** Side-by-side lanes for overlapping events in one day. */
function lanes(evs) {
  const items = evs.map((e) => ({ e, s: toMin(e.time), f: toMin(e.time) + (e.dur || 60) })).sort((a, b) => a.s - b.s || b.f - a.f);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanesEnd = [];
    for (const it of cluster) {
      let l = lanesEnd.findIndex((end) => end <= it.s);
      if (l < 0) l = lanesEnd.push(0) - 1;
      lanesEnd[l] = it.f;
      it.lane = l;
    }
    for (const it of cluster) out.push({ ...it, n: lanesEnd.length });
    cluster = [];
  };
  for (const it of items) {
    if (it.s >= clusterEnd && cluster.length) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.f);
  }
  if (cluster.length) flush();
  return out;
}

function gridView(state, days) {
  const today = store.today();
  const all = expand(state.events, days[0], days.at(-1));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hours = [];
  for (let h = H0; h < H1; h++) hours.push(`<span style="top:${(h - H0) * PX}px">${String(h).padStart(2, '0')}:00</span>`);
  const head = days.map((d) => `<button class="cg-dayhead ${d === today ? 'today' : ''}" data-action="calGoDay" data-date="${d}" aria-label="${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}"><span>${DAY_SHORT[weekdayOf(d)]}</span><b>${new Date(d + 'T12:00').getDate()}</b></button>`).join('');
  const allday = days.map((d) => {
    const evs = all.filter((e) => e.date === d);
    return `<div class="cg-adcell" data-drop-date="${d}">${looseplan(state, d, evs).map((it) => planChip(it, d)).join('')}${evs.filter((e) => !e.time).map(chip).join('')}</div>`;
  }).join('');
  const cols = days.map((d) => {
    const timed = all.filter((e) => e.date === d && e.time);
    const blocks = lanes(timed).map(({ e, s, f, lane, n }) => {
      const top = Math.max(0, (s - H0 * 60) / 60 * PX);
      const height = Math.max(24, (Math.min(f, H1 * 60) - Math.max(s, H0 * 60)) / 60 * PX - 2);
      const k = EVENT_KINDS[e.kind] || EVENT_KINDS.other;
      return `<button class="cg-ev k-${e.kind}" data-action="calEdit" ${dragAttrs(e)} style="top:${top}px;height:${height}px;left:calc(${(lane / n) * 100}% + 1px);width:calc(${100 / n}% - 3px)"><b>${k.emoji} ${esc(e.title)}${e.series ? ' ↻' : ''}</b><small>${esc(e.time)}${e.place ? ` · ${esc(e.place)}` : ''}</small></button>`;
    }).join('');
    const nowLine = d === today && nowMin >= H0 * 60 ? `<span class="cg-now" style="top:${(nowMin - H0 * 60) / 60 * PX}px" aria-hidden="true"></span>` : '';
    return `<div class="cg-col ${d === today ? 'today' : ''}" role="group" data-drop-date="${d}" data-grid="1" data-action="calSlot" data-date="${d}" aria-label="${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}: tap a time to add">${nowLine}${blocks}</div>`;
  }).join('');
  return `<div class="cg" style="--cols:${days.length}">
    <div class="cg-head"><span class="cg-gutter"></span>${head}</div>
    <div class="cg-allday"><span class="cg-gutter">All day</span>${allday}</div>
    <div class="cg-scroll" role="region" aria-label="Times of day" tabindex="0"><div class="cg-body" style="height:${(H1 - H0) * PX}px"><div class="cg-hours" aria-hidden="true">${hours.join('')}</div>${cols}</div></div>
  </div>`;
}

// ---------- Month ----------
function monthView(state, monthAnchor) {
  const today = store.today();
  const first = monthAnchor.slice(0, 8) + '01';
  const start = weekStart(first);
  const month = first.slice(0, 7);
  const days = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));
  while (days.length > 35 && days.at(-7).slice(0, 7) !== month) days.splice(-7);
  const all = expand(state.events, days[0], days.at(-1));
  const head = weekOrder().map((d) => `<span>${DAY_SHORT[d].slice(0, 2)}</span>`).join('');
  const cells = days.map((d) => {
    const evs = all.filter((e) => e.date === d);
    const plan = looseplan(state, d, evs);
    // Compact on a phone: emoji + time (or the first word); the full title is in the label.
    const mini = (e) => `<button class="cal-chip mini k-${e.kind}" data-action="calEdit" ${dragAttrs(e)} aria-label="${esc(`${e.title}${e.time ? ` at ${e.time}` : ''}`)}">${(EVENT_KINDS[e.kind] || EVENT_KINDS.other).emoji}${esc(e.time || e.title.split(' ')[0])}</button>`;
    const miniPlan = (it) => `<button class="cal-chip mini plan" data-action="calFromPlan" ${planAttrs(it, d)} aria-label="${esc(itemName(it))} (planned)">${planEmoji(it)}</button>`;
    const items = [...evs.map(mini), ...(plan.length ? [`<span class="cm-plans">${plan.map(miniPlan).join('')}</span>`] : [])];
    return `<div class="cm-cell ${d.slice(0, 7) !== month ? 'other' : ''} ${d === today ? 'today' : ''}" data-drop-date="${d}">
      <button class="cm-date" data-action="calGoDay" data-date="${d}" aria-label="${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}">${new Date(d + 'T12:00').getDate()}</button>
      ${items.slice(0, 3).join('')}${items.length > 3 ? `<button class="cm-more" data-action="calGoDay" data-date="${d}">+${items.length - 3}</button>` : ''}</div>`;
  }).join('');
  return `<div class="cm"><div class="cm-head">${head}</div><div class="cm-grid">${cells}</div></div>`;
}

// ---------- range + title ----------
function rangeOf(v, a) {
  if (v === 'day') return [a];
  if (v === '3day') return [a, addDays(a, 1), addDays(a, 2)];
  if (v === 'week') {
    const s = weekStart(a);
    return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(s, i));
  }
  return [a];
}

function titleOf(v, a) {
  const days = rangeOf(v, a);
  if (v === 'month' || v === 'list') return new Date(a + 'T12:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (days.length === 1) return fmtDate(a, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${fmtDate(days[0], { day: 'numeric', month: 'short' })} – ${fmtDate(days.at(-1), { day: 'numeric', month: 'short' })}`;
}

function shift(v, a, dir) {
  if (v === 'month') {
    const d = new Date(a.slice(0, 7) + '-15T12:00');
    d.setMonth(d.getMonth() + dir);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return addDays(a, dir * ({ day: 1, '3day': 3, week: 7, list: 14 }[v] || 1));
}

// ---------- editor ----------
function editorHtml(state, ev, occDate) {
  const e = ev || { id: '', title: '', date: store.today(), time: '', place: '', kind: 'walk', notes: '', public: false };
  const isNew = !ev?.id;
  const r = e.repeat || null;
  const joins = e.id ? share.signupsFor(e.repeat && occDate ? occId({ ...e, series: e.id, date: occDate }) : e.id) : [];
  const days = r?.days?.length ? r.days : [weekdayOf(e.date)];
  return `<div class="sheet-head"><div><div class="over">${isNew ? 'New in your calendar' : 'Your calendar'}</div><h2>${isNew ? 'Plan something' : esc(e.title)}</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <form data-form="calSave" data-id="${esc(e.id)}" data-plan="${esc(e.planKey || '')}">
      ${isNew ? `<div class="quick-chips" style="margin-bottom:8px">${QUICK.map(([k, t]) => `<button type="button" data-action="calQuick" data-kind="${k}" data-title="${esc(t)}">${EVENT_KINDS[k].emoji} ${esc(t)}</button>`).join('')}</div>` : ''}
      ${r && occDate ? `<div class="notice info" style="margin:0 0 10px">${icon('info')}<div>${esc(repeatLabel(r))}. Changes here apply to every repeat — to move just one, long-press it in the calendar and drag it.</div></div>` : ''}
      <label class="field"><span>What</span><input type="text" name="title" maxlength="60" required value="${esc(e.title)}" placeholder="e.g. Walk round the lake"></label>
      <div class="grid two" style="gap:0 12px;margin:0">
        <label class="field"><span>${r ? 'Starts' : 'Day'}</span><input type="date" name="date" required value="${esc(e.date)}" min="${addDays(store.today(), -7)}"></label>
        <label class="field"><span>Time</span><input type="time" name="time" value="${esc(e.time || '')}"></label>
      </div>
      <label class="field"><span>How long</span><select name="dur">${[15, 30, 45, 60, 90, 120, 180].map((m) => `<option value="${m}" ${(e.dur || 60) === m ? 'selected' : ''}>${m < 60 ? `${m} min` : `${m / 60} h`}</option>`).join('')}</select></label>
      <fieldset class="field cal-repeat" style="border:0;padding:0;margin:0 0 12px"><legend style="font-weight:600;margin-bottom:6px">Repeat</legend>
        <select name="repeat" data-change="calRepeatKind" aria-label="Repeat">${[['', 'Doesn’t repeat'], ...Object.entries(FREQS)].map(([k, l]) => `<option value="${k}" ${(r?.freq || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div class="cal-rdays" ${r && (r.freq === 'weekly' || r.freq === 'biweekly') ? '' : 'hidden'}>${weekOrder().map((d) => `<label class="chip small"><input type="checkbox" name="rday" value="${d}" ${days.includes(d) ? 'checked' : ''}><span>${DAY_SHORT[d]}</span></label>`).join('')}</div>
        <label class="field cal-until" style="margin:8px 0 0" ${r ? '' : 'hidden'}><span>Until <span class="hint">optional</span></span><input type="date" name="until" value="${esc(r?.until || '')}"></label>
      </fieldset>
      <label class="field"><span>Where <span class="hint">optional</span></span><input type="text" name="place" maxlength="80" value="${esc(e.place || '')}" placeholder="e.g. the park by the library"></label>
      <label class="field"><span>Type</span><select name="kind">${Object.entries(EVENT_KINDS).map(([k, v]) => `<option value="${k}" ${k === e.kind ? 'selected' : ''}>${v.emoji} ${v.label}</option>`).join('')}</select></label>
      <label class="field"><span>Note <span class="hint">optional</span></span><input type="text" name="notes" maxlength="140" value="${esc(e.notes || '')}" placeholder="e.g. bring water, 5 km loop"></label>
      <label class="row nowrap cal-public"><input type="checkbox" name="public" value="1" ${e.public ? 'checked' : ''}><span><strong>Open to friends</strong><small>Shows on your shared calendar so people can say “I’ll join”. Only what, when and where is shared.</small></span></label>
      ${joins.length ? `<div class="notice ok" style="margin-top:10px">${icon('check')}<div><strong>${joins.length} joining:</strong> ${joins.map((j) => esc(j.name)).join(', ')}</div></div>` : ''}
      <div class="row" style="margin-top:14px;flex-wrap:wrap"><button class="btn primary">${isNew ? 'Add to calendar' : 'Save'}</button>
        ${isNew ? '' : r && occDate ? `<button type="button" class="btn ghost danger" data-action="calDeleteOne" data-id="${esc(e.id)}" data-date="${occDate}">Delete this one</button><button type="button" class="btn ghost danger" data-action="calDelete" data-id="${esc(e.id)}">Delete all</button>` : `<button type="button" class="btn ghost danger" data-action="calDelete" data-id="${esc(e.id)}">Delete</button>`}</div>
      <p class="muted" style="font-size:var(--text-xs);margin:10px 0 0">Tip: long-press anything in the calendar and drag it to another day.</p>
    </form>`;
}

// ---------- moving things (drag and drop) ----------
const saveEvents = (ctx, fn) => ctx.update((st) => {
  st.events = fn([...(st.events || [])]).sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
  return st;
}, { quiet: true });

function movePlan(st, key, fromDay, date, toDate) {
  const wk = weekStart(date);
  const to = weekdayOf(toDate);
  const list = [...(st.workouts.moves?.[wk] || [])];
  const prev = list.find((m) => m.key === key && m.to === fromDay);
  if (prev) prev.to = to;
  else list.push({ key, from: fromDay, to });
  st.workouts.moves = { ...(st.workouts.moves || {}), [wk]: list.filter((m) => m.from !== m.to) };
}

/** Drop handler: an event (or one repeat of it) or a planned session onto a day, maybe a time. */
export function dropOn(ctx, d, toDate, time) {
  if (!toDate) return;
  if (d.kind === 'event') {
    const e = (ctx.state.events || []).find((x) => x.id === d.id);
    if (!e || (d.date === toDate && (!time || time === e.time))) return;
    if (e.repeat) {
      saveEvents(ctx, (list) => {
        const rest = list.filter((x) => x.id !== e.id);
        const { repeat, skip, ...one } = e;
        void repeat;
        return [...rest, { ...e, skip: [...(skip || []), d.date].slice(-200) }, { ...one, id: newId(), date: toDate, time: time || e.time }];
      });
      ctx.toast(`Moved just this one to ${fmtDate(toDate, { weekday: 'long' })}${time ? ` ${time}` : ''} — the rest still repeat`);
    } else {
      ctx.update((st) => {
        const sameWeek = weekStart(e.date) === weekStart(toDate);
        if (e.planKey && sameWeek && e.date !== toDate) movePlan(st, e.planKey, weekdayOf(e.date), e.date, toDate);
        st.events = (st.events || []).map((x) => (x.id === e.id ? { ...x, date: toDate, ...(time ? { time } : {}) } : x));
        return st;
      }, { quiet: true });
      ctx.toast(`Moved to ${fmtDate(toDate, { weekday: 'long' })}${time ? ` ${time}` : ''}`);
    }
  } else if (d.kind === 'plan') {
    if (weekStart(d.date) !== weekStart(toDate)) return ctx.toast('Planned sessions move within their own week. Add a walk or a session to another week with ＋.');
    ctx.update((st) => {
      if (d.date !== toDate) movePlan(st, d.key, Number(d.from), d.date, toDate);
      if (time) st.events = [...(st.events || []).filter((x) => !(x.planKey === d.key && x.date === toDate)), { id: newId(), planKey: d.key, title: d.title, date: toDate, time, place: '', kind: d.kindOf || 'workout', notes: '', public: false }];
      return st;
    }, { quiet: true });
    ctx.toast(`${d.title}: ${fmtDate(toDate, { weekday: 'long' })}${time ? ` at ${time}` : ''}`);
  }
  share.sync(ctx);
}

// Long-press (≈0.4 s) picks an item up; drag it over a day (or a time in the grid) and let go.
// A quick swipe still scrolls; a tap still opens it.
let pending = null;
let drag = null;
let swallowClick = false;
const LONG = 400;

function targetAt(x, y) {
  // Look through everything under the finger (a toast or the ghost may be on top of the day).
  const cell = document.elementsFromPoint(x, y).map((n) => n.closest?.('[data-drop-date]')).find(Boolean);
  if (!cell) return null;
  let time = null;
  if (cell.dataset.grid) {
    const r = cell.getBoundingClientRect();
    const m = Math.round(((y - r.top) / PX * 60 + H0 * 60) / 15) * 15;
    time = hhmm(Math.max(H0 * 60, Math.min(23 * 60 + 45, m)));
  }
  return { cell, date: cell.dataset.dropDate, time };
}

function begin(el, x, y) {
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.className = `${el.className} cal-ghost`;
  ghost.removeAttribute('data-action');
  ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${Math.min(r.width, 220)}px;height:auto;pointer-events:none;z-index:200`;
  document.body.append(ghost);
  drag = { el, ghost, dx: x - r.left, dy: y - r.top, data: { kind: el.dataset.drag, id: el.dataset.id, date: el.dataset.date, key: el.dataset.key, from: el.dataset.from, title: el.dataset.title, kindOf: el.dataset.kind }, over: null };
  el.classList.add('cal-dragging-src');
  document.body.classList.add('cal-dragging');
  buzz(15);
}

function finish(drop, x, y) {
  if (!drag) return;
  const t = drop ? targetAt(x, y) : null;
  drag.ghost.remove();
  drag.el.classList.remove('cal-dragging-src');
  document.querySelectorAll('.cal-drop-over').forEach((c) => c.classList.remove('cal-drop-over'));
  document.body.classList.remove('cal-dragging');
  const data = drag.data;
  drag = null;
  swallowClick = true;
  setTimeout(() => (swallowClick = false), 350);
  if (t && ctxRef) dropOn(ctxRef, data, t.date, t.time);
}

document.addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest?.('[data-drag]');
  if (!el || ev.button > 0 || !el.closest('.cal-view')) return;
  const x = ev.clientX;
  const y = ev.clientY;
  pending = { el, x, y, timer: setTimeout(() => {
    if (pending) begin(el, pending.x, pending.y);
    pending = null;
  }, LONG) };
});
document.addEventListener('pointermove', (ev) => {
  if (pending && Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y) > 8) {
    clearTimeout(pending.timer);
    pending = null;
  }
  if (pending) {
    pending.x = ev.clientX;
    pending.y = ev.clientY;
  }
  if (!drag) return;
  drag.ghost.style.left = `${ev.clientX - drag.dx}px`;
  drag.ghost.style.top = `${ev.clientY - drag.dy}px`;
  const t = targetAt(ev.clientX, ev.clientY);
  if (t?.cell !== drag.over) {
    drag.over?.classList.remove('cal-drop-over');
    t?.cell.classList.add('cal-drop-over');
    drag.over = t?.cell || null;
  }
  drag.ghost.dataset.time = t?.time || '';
});
const end = (drop) => (ev) => {
  if (pending) {
    clearTimeout(pending.timer);
    pending = null;
  }
  if (drag) finish(drop, ev.clientX, ev.clientY);
};
document.addEventListener('pointerup', end(true));
document.addEventListener('pointercancel', end(false));
// While dragging on a touch screen, don't scroll the page.
document.addEventListener('touchmove', (ev) => drag && ev.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (ev) => (pending || drag) && ev.target.closest?.('[data-drag]') && ev.preventDefault());
// The tap that ends a drag shouldn't also open the item.
document.addEventListener('click', (ev) => {
  if (swallowClick) {
    ev.stopPropagation();
    ev.preventDefault();
    swallowClick = false;
  }
}, true);

// ---------- the screen ----------
export default {
  render(state) {
    const today = store.today();
    view ||= loadView();
    if (!anchor) anchor = today;
    const pub = (state.events || []).filter((e) => e.public && (e.repeat || e.date >= today)).length;
    const body = view === 'list' ? listView(state, anchor) : view === 'month' ? monthView(state, anchor) : gridView(state, rangeOf(view, anchor));
    const showsToday = view === 'month' ? anchor.slice(0, 7) === today.slice(0, 7) : view === 'week' ? weekStart(anchor) === weekStart(today) : anchor === today;
    return `<header class="page-head"><div><div class="eyebrow">Move</div><h1>Calendar</h1></div><button class="btn small primary" data-action="calAdd" data-date="${view === 'month' || view === 'week' ? today : anchor}" aria-label="Add to calendar">${icon('plus')} Add</button></header>
      ${share.shareCardHtml(state, pub)}
      <div class="segmented cal-views" role="tablist" aria-label="Calendar view">${VIEWS.map(([k, l]) => `<button role="tab" class="${view === k ? 'on' : ''}" aria-selected="${view === k}" data-action="calView" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="cal-nav">
        <button class="icon-btn cal-back" data-action="calShift" data-d="-1" aria-label="Earlier">${icon('chevron')}</button>
        <strong class="grow">${esc(titleOf(view, anchor))}</strong>
        ${showsToday ? '' : '<button class="btn small" data-action="calShift" data-d="0">Today</button>'}
        <button class="icon-btn" data-action="calShift" data-d="1" aria-label="Later">${icon('chevron')}</button>
      </div>
      <div class="cal-view">${body}</div>
      <p class="muted" style="font-size:var(--text-xs);margin-top:8px">Long-press anything and drag it to another day${view === 'month' || view === 'list' ? '' : ' or time'}. ${view === 'month' || view === 'list' ? '' : 'Tap an empty time to add something there.'}</p>`;
  },
  after(root, ctx) {
    ctxRef = ctx;
    share.refresh(ctx);
    // Open the time grid at the morning (or just before now on today), once per view/date.
    const sc = root.querySelector('.cg-scroll');
    if (!sc) return;
    const key = `${view}|${anchor}`;
    if (scrolled !== key) {
      const d = new Date();
      const startH = rangeOf(view, anchor).includes(store.today()) ? Math.max(H0, d.getHours() - 1) : 7;
      gridScroll = (startH - H0) * PX;
      scrolled = key;
    }
    sc.scrollTop = gridScroll; // re-renders replace the grid; keep where you were
    sc.addEventListener('scroll', () => (gridScroll = sc.scrollTop), { passive: true });
  },
  actions: {
    calView(el, ev, ctx) {
      view = el.dataset.v;
      try {
        localStorage.setItem('habitlab.calView', view);
      } catch (e) {
        /* private mode */
      }
      if (view === 'week' || view === 'month' || view === 'list') anchor = view === 'month' ? anchor.slice(0, 8) + '01' : anchor;
      ctx.rerender();
    },
    calShift(el, ev, ctx) {
      const d = Number(el.dataset.d);
      anchor = d === 0 ? store.today() : shift(view, anchor, d);
      ctx.rerender();
    },
    calGoDay(el, ev, ctx) {
      anchor = el.dataset.date;
      view = 'day';
      ctx.rerender();
    },
    calSlot(el, ev, ctx) {
      if (ev.target !== el) return; // a tap on an event opens it instead
      const r = el.getBoundingClientRect();
      const m = Math.floor(((ev.clientY - r.top) / PX * 60 + H0 * 60) / 30) * 30;
      calendarActions.calAdd({ dataset: { date: el.dataset.date, time: hhmm(Math.min(23 * 60 + 30, m)) } }, ev, ctx);
    },
    ...share.shareActions,
  },
};

/** Global actions (also used from Today and evening planning). */
export const calendarActions = {
  calAdd(el, ev, ctx) {
    openSheet(editorHtml(ctx.state, { id: '', title: '', date: el.dataset.date || store.today(), time: el.dataset.time || '', place: '', kind: el.dataset.kind || 'walk', notes: '', public: false }), { label: 'Add to calendar' });
  },
  calFromPlan(el, ev, ctx) {
    const existing = (ctx.state.events || []).find((x) => x.date === el.dataset.date && x.planKey === el.dataset.key);
    if (existing) return openSheet(editorHtml(ctx.state, existing), { label: 'Edit' });
    openSheet(editorHtml(ctx.state, { id: '', title: el.dataset.title, date: el.dataset.date, time: '', place: '', kind: el.dataset.kind, notes: '', public: false, planKey: el.dataset.key }), { label: 'Set a time' });
  },
  calQuick(el) {
    const f = el.closest('form');
    f.querySelector('[name=title]').value = el.dataset.title;
    f.querySelector('[name=kind]').value = el.dataset.kind;
    f.querySelector('[name=time]').focus();
  },
  calRepeatKind(el) {
    const f = el.closest('form');
    const v = el.value;
    f.querySelector('.cal-rdays').hidden = !(v === 'weekly' || v === 'biweekly');
    f.querySelector('.cal-until').hidden = !v;
  },
  calEdit(el, ev, ctx) {
    const e = (ctx.state.events || []).find((x) => x.id === el.dataset.id);
    if (e) openSheet(editorHtml(ctx.state, e, e.repeat ? el.dataset.date : null), { label: 'Edit' });
  },
  calSave(form, ev, ctx, data) {
    const title = String(data.title || '').trim().slice(0, 60);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')) return;
    const id = form.dataset.id || newId();
    const prev = (ctx.state.events || []).find((x) => x.id === id);
    const planKey = /^(strength|activity|cardio):[\w-]{1,60}$/.test(form.dataset.plan || '') ? form.dataset.plan : undefined;
    const freq = FREQS[data.repeat] ? data.repeat : '';
    const rdays = [...form.querySelectorAll('input[name=rday]:checked')].map((i) => Number(i.value));
    const until = /^\d{4}-\d{2}-\d{2}$/.test(data.until || '') && data.until >= data.date ? data.until : '';
    const repeat = freq ? { freq, ...(freq === 'weekly' || freq === 'biweekly' ? { days: rdays.length ? rdays.sort() : [weekdayOf(data.date)] } : {}), ...(until ? { until } : {}) } : undefined;
    const e = {
      id, ...(planKey ? { planKey } : {}), title, date: data.date, time: /^\d{2}:\d{2}$/.test(data.time || '') ? data.time : '',
      dur: [15, 30, 45, 60, 90, 120, 180].includes(Number(data.dur)) ? Number(data.dur) : 60,
      place: String(data.place || '').trim().slice(0, 80), kind: EVENT_KINDS[data.kind] ? data.kind : 'other', notes: String(data.notes || '').trim().slice(0, 140), public: data.public === '1',
      ...(repeat ? { repeat, ...(prev?.skip?.length ? { skip: prev.skip } : {}) } : {}),
    };
    closeSheet();
    saveEvents(ctx, (list) => [...list.filter((x) => x.id !== id), e]);
    ctx.toast(form.dataset.id ? 'Saved' : `Added — ${repeat ? repeatLabel(repeat).toLowerCase() : fmtDate(e.date, { weekday: 'long' })}${e.time ? ` at ${e.time}` : ''}`);
    share.sync(ctx);
  },
  async calDelete(el, ev, ctx) {
    const e = (ctx.state.events || []).find((x) => x.id === el.dataset.id);
    if (!(await ctx.confirm(e?.repeat ? 'Delete every repeat of this from your calendar?' : 'Delete this from your calendar?', { ok: 'Delete' }))) return;
    closeSheet();
    saveEvents(ctx, (list) => list.filter((x) => x.id !== el.dataset.id));
    share.sync(ctx);
  },
  calDeleteOne(el, ev, ctx) {
    closeSheet();
    saveEvents(ctx, (list) => list.map((x) => (x.id === el.dataset.id ? { ...x, skip: [...(x.skip || []), el.dataset.date].slice(-200) } : x)));
    ctx.toast('Deleted just this one');
    share.sync(ctx);
  },
};
