// Plan tomorrow (evening, ~2 minutes), as four short steps: how today went, tomorrow at a glance
// (meal times, when and where you'll move), anything different tomorrow, and an if-then plan for it. Deciding "when, where, how" in advance — implementation intentions — made people
// markedly more likely to follow through (meta-analysis of 94 studies, d ≈ 0.65: Gollwitzer &
// Sheeran 2006). Opened by the wind-down alarm, an evening reminder, or the card on Today.
import { esc, icon, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { addDays, weekdayOf } from '../engine/util.js';
import { itemKey } from '../engine/workouts.js';
import { byId } from '../engine/meals.js';
import { itemName, planEmoji, planKind } from './planmove.js';
import { eventsOn, EVENT_KINDS } from './calendar.js';
import { mealsFor, slotLabel } from './shared.js';
import { toHHMM } from '../engine/schedule.js';
import { confetti } from '../ui/celebrate.js';
import * as share from '../share.js';
import { SITUATIONS } from '../data/situations.js';

export { SITUATIONS };


export function tomorrow() {
  return addDays(store.today(), 1);
}

export function isPlanned(state, date = tomorrow()) {
  return state.flags?.planned === date;
}

function moveBlock(state, date) {
  const di = weekdayOf(date);
  const items = store.dayItems(state, date).filter((i) => i.kind !== 'rest');
  const evs = eventsOn(state, date);
  const rows = items.map((it) => {
    const key = itemKey(it);
    const ev = evs.find((e) => e.planKey === key);
    return `<li class="plan-row"><span class="cal-emoji" aria-hidden="true">${planEmoji(it)}</span>
      <div class="grow"><strong>${esc(itemName(it))}</strong>
        <form class="plan-when" data-form="planSetWhen" data-key="${esc(key)}" data-title="${esc(itemName(it))}" data-kind="${planKind(it)}" data-ev="${esc(ev?.id || '')}">
          <input type="time" name="time" value="${esc(ev?.time || '')}" aria-label="Time for ${esc(itemName(it))}" required>
          <input type="text" name="place" value="${esc(ev?.place || '')}" maxlength="80" placeholder="Where?" aria-label="Where for ${esc(itemName(it))}">
          <button class="btn small ${ev ? '' : 'primary'}">${ev ? 'Update' : 'Set'}</button>
        </form>
        ${ev ? `<small class="plan-set">✓ ${esc(ev.time)}${ev.place ? ` · ${esc(ev.place)}` : ''}</small>` : ''}
      </div>
      <button class="btn small ghost" data-action="openMoveItem" data-key="${esc(key)}" data-from="${di}" data-date="${date}" aria-label="Move ${esc(itemName(it))} to another day">Move</button></li>`;
  }).join('');
  const own = evs.filter((e) => !e.planKey).map((e) => `<li class="plan-row"><span class="cal-emoji" aria-hidden="true">${(EVENT_KINDS[e.kind] || EVENT_KINDS.other).emoji}</span><div class="grow"><strong>${esc(e.title)}</strong><small>${e.time ? esc(e.time) : 'Any time'}${e.place ? ` · ${esc(e.place)}` : ''}${e.public ? ' · open to friends' : ''}</small></div><button class="btn small ghost" data-action="calEdit" data-id="${esc(e.series || e.id)}" data-date="${e.date}">Edit</button></li>`).join('');
  return `<ul class="plan-list">${rows}${own}${!items.length && !evs.length ? '<li class="muted" style="padding:6px 0">Rest day on the plan — a walk still counts. Add one?</li>' : ''}</ul>
    <div class="quick-chips" style="margin-top:8px"><button type="button" data-action="calAdd" data-date="${date}" data-kind="walk">🚶 Add a walk</button><button type="button" data-action="calAdd" data-date="${date}" data-kind="cooking">🍲 Batch cooking</button><button type="button" data-action="calAdd" data-date="${date}" data-kind="other">＋ Something else</button></div>`;
}

function mealBlock(state, date) {
  if (store.habitsOnly(state)) return '';
  const meals = mealsFor(state, date);
  return `<div class="card"><h2 style="margin-top:0">🍽 Food</h2>
    <p class="muted" style="font-size:var(--text-sm);margin-top:-4px">Tap a meal to swap it or change its time. Anything to defrost or pack tonight?</p>
    <ul class="plan-list">${meals.map((m) => `<li class="plan-row"><span class="meal-time">${toHHMM(m.time)}</span><div class="grow"><strong>${esc(byId(m.recipeId).name)}</strong><small>${esc(slotLabel(m.slot))}${m.leftover ? ' · leftovers' : ''}</small></div><button class="btn small ghost" data-action="openMeal" data-slot="${m.slot}" data-date="${date}">Change</button></li>`).join('')}</ul></div>`;
}

const FACES = [['😣', 'Hard'], ['😕', 'Meh'], ['😐', 'Okay'], ['🙂', 'Good'], ['😄', 'Great']];
const STEPS = ['Today', 'Tomorrow', 'What if', 'Your plan'];

// The ritual in progress (kept until you finish or it's a new day).
let draft = null;
function draftFor(state, date) {
  if (draft?.date === date) return draft;
  const saved = state.ritual?.[date];
  const r = state.reflect?.[store.today()];
  draft = { date, step: 0, rate: r?.rate || 0, note: r?.note || '', situations: saved?.situations?.slice() || [], plans: Object.fromEntries((saved?.plans || []).map((p) => [p.sit, p.text])) };
  return draft;
}

function stepToday(d) {
  return `<div class="card rit-card"><h2>How did today go?</h2>
    <p class="muted">No judging — just noticing. It helps you see what works for you.</p>
    <div class="rit-faces" role="radiogroup" aria-label="How today went">${FACES.map(([e, l], i) => `<button role="radio" aria-checked="${d.rate === i + 1}" class="rit-face ${d.rate === i + 1 ? 'on' : ''}" data-action="ritRate" data-v="${i + 1}"><span aria-hidden="true">${e}</span><small>${l}</small></button>`).join('')}</div>
    <label class="field" style="margin-top:14px"><span>One thing that helped (or got in the way) <span class="hint">optional</span></span><input type="text" maxlength="80" data-rit-note value="${esc(d.note)}" placeholder="e.g. prepped lunch, skipped the afternoon snack"></label>
  </div>`;
}

function stepTomorrow(state, date) {
  return `<div class="card"><h2 style="margin-top:0">🏃 Movement — when and where?</h2>${moveBlock(state, date)}</div>${mealBlock(state, date)}`;
}

function stepDifferent(d) {
  return `<div class="card rit-card"><h2>Anything different tomorrow?</h2>
    <p class="muted">Plans go wrong in the moments we didn’t see coming. Pick what applies.</p>
    <div class="rit-sits">${Object.entries(SITUATIONS).map(([k, x]) => `<button class="rit-sit ${d.situations.includes(k) ? 'on' : ''}" aria-pressed="${d.situations.includes(k)}" data-action="ritSit" data-k="${k}"><span aria-hidden="true">${x.emoji}</span>${esc(x.label)}</button>`).join('')}</div>
  </div>`;
}

function stepPlan(d) {
  const sits = d.situations.length ? d.situations : ['none'];
  return `<div class="card rit-card"><h2>Your if-then plan</h2>
    <p class="muted">Decide now, so tomorrow you don’t have to. Pick one for each — or write your own.</p>
    ${sits.map((k) => {
      const x = SITUATIONS[k];
      const cur = d.plans[k] || '';
      const own = cur && !x.plans.includes(cur);
      return `<div class="rit-group"><div class="over">${x.emoji} ${esc(x.label)}</div>
        ${x.plans.map((t) => `<button class="rit-plan ${cur === t ? 'on' : ''}" aria-pressed="${cur === t}" data-action="ritPlan" data-k="${k}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}
        <input type="text" class="rit-own ${own ? 'on' : ''}" maxlength="140" data-rit-own="${k}" value="${own ? esc(cur) : ''}" placeholder="Or in your words: If …, I’ll …" aria-label="Your own plan for ${esc(x.label)}">
      </div>`;
    }).join('')}
  </div>`;
}

function summary(state, date) {
  const r = state.ritual?.[date];
  return `<div class="card rit-card rit-done"><div class="rit-moon" aria-hidden="true">🌙</div><h2>Tomorrow is planned.</h2>
    ${r?.plans?.length ? `<ul class="rit-list">${r.plans.map((p) => `<li>${esc(p.text)}</li>`).join('')}</ul><p class="muted" style="font-size:var(--text-sm)">You’ll see this on Today tomorrow.</p>` : '<p class="muted">Sleep well.</p>'}
    <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center"><a class="btn primary" href="#/today">Back to today</a><button class="btn ghost" data-action="ritRedo">Change it</button></div></div>`;
}

const readInputs = () => {
  const n = document.querySelector('[data-rit-note]');
  if (n && draft) draft.note = n.value.trim().slice(0, 80);
  for (const el of document.querySelectorAll('[data-rit-own]')) if (el.value.trim() && draft) draft.plans[el.dataset.ritOwn] = el.value.trim().slice(0, 140);
};

export default {
  render(state) {
    const date = tomorrow();
    const d = draftFor(state, date);
    if (isPlanned(state, date) && !d.editing) return `<header class="page-head"><div><div class="eyebrow">${esc(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div><h1>Plan tomorrow</h1></div></header>${summary(state, date)}`;
    const body = [stepToday(d), stepTomorrow(state, date), stepDifferent(d), stepPlan(d)][d.step];
    const last = d.step === STEPS.length - 1;
    return `<header class="page-head"><div><div class="eyebrow">${esc(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div><h1>Plan tomorrow</h1></div></header>
      <div class="rit-steps" aria-label="Step ${d.step + 1} of ${STEPS.length}">${STEPS.map((s, i) => `<button class="rit-dot ${i === d.step ? 'on' : i < d.step ? 'past' : ''}" data-action="ritStep" data-to="${i}" aria-label="${esc(s)}" ${i === d.step ? 'aria-current="step"' : ''}><span>${esc(s)}</span></button>`).join('')}</div>
      ${body}
      <div class="rit-nav">${d.step ? `<button class="btn ghost" data-action="ritStep" data-to="${d.step - 1}">${icon('back')}Back</button>` : '<span></span>'}
        ${last ? '<button class="btn primary large" data-action="planDone">Tomorrow is planned ✓</button>' : `<button class="btn primary large" data-action="ritStep" data-to="${d.step + 1}">Next</button>`}</div>
      <p class="muted" style="font-size:var(--text-xs);margin-top:12px;text-align:center">Saying <em>when, where</em> and <em>what if</em> makes plans much more likely to happen. <a href="#/learn/plan_ahead">The evidence</a></p>`;
  },
  actions: {
    ritRate(el, ev, ctx) {
      readInputs();
      draft.rate = Number(el.dataset.v);
      ctx.rerender();
    },
    ritStep(el, ev, ctx) {
      readInputs();
      draft.step = Math.max(0, Math.min(STEPS.length - 1, Number(el.dataset.to)));
      ctx.rerender();
      window.scrollTo(0, 0);
    },
    ritSit(el, ev, ctx) {
      const k = el.dataset.k;
      const has = draft.situations.includes(k);
      if (k === 'none') draft.situations = has ? [] : ['none'];
      else draft.situations = has ? draft.situations.filter((x) => x !== k) : [...draft.situations.filter((x) => x !== 'none'), k];
      ctx.rerender();
    },
    ritPlan(el, ev, ctx) {
      readInputs();
      const k = el.dataset.k;
      draft.plans[k] = draft.plans[k] === el.dataset.t ? '' : el.dataset.t;
      ctx.rerender();
    },
    ritRedo(el, ev, ctx) {
      draft.editing = true;
      draft.step = 2;
      ctx.rerender();
    },
    planSetWhen(form, ev, ctx, data) {
      const time = /^\d{2}:\d{2}$/.test(data.time || '') ? data.time : '';
      if (!time) return ctx.toast('Pick a time');
      const date = tomorrow();
      const id = form.dataset.ev || `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const place = String(data.place || '').trim().slice(0, 80);
      const e = { id, planKey: form.dataset.key, title: form.dataset.title, date, time, place, kind: form.dataset.kind, notes: '', public: false };
      ctx.update((st) => {
        const prev = (st.events || []).find((x) => x.id === id);
        if (prev?.repeat) {
          // A repeating event: change just tomorrow's — skip it in the series and add a one-off copy.
          const one = { ...prev, id: `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date, time, place };
          delete one.repeat;
          delete one.skip;
          st.events = [...st.events.map((x) => (x.id === id ? { ...x, skip: [...(x.skip || []), date].slice(-200) } : x)), one];
        } else st.events = [...(st.events || []).filter((x) => x.id !== id), prev ? { ...prev, time, place } : e]; // keep its notes, length, sharing
        return st;
      }, { quiet: true });
      ctx.toast(`${form.dataset.title}: ${time}${e.place ? ` at ${e.place}` : ''}`);
      share.sync(ctx);
    },
    planDone(el, ev, ctx) {
      readInputs();
      const date = tomorrow();
      const d = draftFor(ctx.state, date);
      const sits = d.situations.length ? d.situations : ['none'];
      const plans = sits.map((k) => ({ sit: k, text: d.plans[k] })).filter((p) => p.text);
      ctx.update((st) => {
        st.flags = { ...(st.flags || {}), planned: date };
        st.ritual = { ...(st.ritual || {}), [date]: { situations: d.situations.slice(), plans } };
        if (d.rate) st.reflect = { ...(st.reflect || {}), [store.today()]: { rate: d.rate, ...(d.note ? { note: d.note } : {}) } };
        return st;
      }, { quiet: true });
      d.editing = false;
      confetti(0.5);
      ctx.toast('Tomorrow is planned. Sleep well 🌙');
    },
  },
};

/** On the day: the if-then plans you made last night, to tick off when you used one. */
export function ritualCard(state, date) {
  const r = state.ritual?.[date];
  if (!r?.plans?.length) return '';
  const kept = new Set(r.kept || []);
  return `<section class="card rit-today" aria-label="Your plan for today"><div class="over">🌙 Your plan for today</div>
    <ul>${r.plans.map((p, i) => `<li><button class="rit-keep ${kept.has(i) ? 'on' : ''}" aria-pressed="${kept.has(i)}" data-action="ritKept" data-i="${i}" data-date="${date}"><span class="check ${kept.has(i) ? 'on' : ''}" aria-hidden="true">${kept.has(i) ? icon('check') : ''}</span><span class="grow">${esc(p.text)}</span></button></li>`).join('')}</ul></section>`;
}

export const ritualActions = {
  ritKept(el, ev, ctx) {
    const i = Number(el.dataset.i);
    const date = el.dataset.date;
    ctx.update((st) => {
      const r = st.ritual?.[date];
      if (!r) return st;
      const k = new Set(r.kept || []);
      k.has(i) ? k.delete(i) : k.add(i);
      r.kept = [...k].sort();
      return st;
    }, { quiet: true });
    if (!el.classList.contains('on')) ctx.toast('Plan kept — that’s how habits are built');
  },
};
