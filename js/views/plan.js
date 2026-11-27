// Plan tomorrow (evening, ~2 minutes): when and where you'll move, a look at tomorrow's meals,
// and your habits. Deciding "when, where, how" in advance — implementation intentions — made people
// markedly more likely to follow through (meta-analysis of 94 studies, d ≈ 0.65: Gollwitzer &
// Sheeran 2006). Opened by the wind-down alarm, an evening reminder, or the card on Today.
import { esc, icon, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { addDays } from '../engine/util.js';
import { itemKey } from '../engine/workouts.js';
import { byId } from '../engine/meals.js';
import { habitById } from '../engine/habits.js';
import { itemName } from './planmove.js';
import { eventsOn, EVENT_KINDS } from './calendar.js';
import { mealsFor, slotLabel } from './shared.js';
import { toHHMM } from '../engine/schedule.js';
import { confetti } from '../ui/celebrate.js';
import * as share from '../share.js';

const ICON = { strength: '💪', cardio: '🚶', activity: '🏸' };

export function tomorrow() {
  return addDays(store.today(), 1);
}

export function isPlanned(state, date = tomorrow()) {
  return state.flags?.planned === date;
}

function moveBlock(state, date) {
  const di = (new Date(date + 'T12:00').getDay() + 6) % 7;
  const items = store.schedule(state, date).schedule[di].items.filter((i) => i.kind !== 'rest');
  const evs = eventsOn(state, date);
  const rows = items.map((it) => {
    const key = itemKey(it);
    const ev = evs.find((e) => e.planKey === key);
    return `<li class="plan-row"><span class="cal-emoji" aria-hidden="true">${ICON[it.kind] || '📌'}</span>
      <div class="grow"><strong>${esc(itemName(it))}</strong>
        <form class="plan-when" data-form="planSetWhen" data-key="${esc(key)}" data-title="${esc(itemName(it))}" data-kind="${it.kind === 'activity' ? 'sport' : it.kind === 'cardio' ? 'walk' : 'workout'}" data-ev="${esc(ev?.id || '')}">
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
  return `<div class="card"><h2 style="margin-top:0">🍽 Tomorrow’s food</h2>
    <p class="muted" style="font-size:var(--text-sm);margin-top:-4px">Happy with these? Tap one to swap it or see the recipe. Anything to take out of the freezer or pack tonight?</p>
    <ul class="plan-list">${meals.map((m) => `<li class="plan-row"><span class="meal-time">${toHHMM(m.time)}</span><div class="grow"><strong>${esc(byId(m.recipeId).name)}</strong><small>${esc(slotLabel(m.slot))}${m.leftover ? ' · leftovers' : ''}</small></div><button class="btn small ghost" data-action="openMeal" data-slot="${m.slot}" data-date="${date}">Change</button></li>`).join('')}</ul></div>`;
}

function habitBlock(state) {
  const active = store.visibleHabits(state);
  if (!active.length) return '';
  return `<div class="card"><h2 style="margin-top:0">✅ Your habits</h2>
    <ul class="plan-list">${active.map((a) => `<li class="plan-row"><div class="grow"><strong>${esc(habitById(a.id)?.title || a.id)}</strong><small>${esc(a.cue)}</small></div></li>`).join('')}</ul>
    <a class="btn small ghost" href="#/habits">Change a cue</a></div>`;
}

export default {
  render(state) {
    const date = tomorrow();
    const done = isPlanned(state, date);
    return `<header class="page-head"><div><div class="eyebrow">${esc(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div><h1>Plan tomorrow</h1></div></header>
      <p class="muted" style="margin:-8px 0 14px">Two minutes now, an easier day tomorrow. Saying <em>when and where</em> you’ll do something makes it much more likely to happen.</p>
      <div class="card"><h2 style="margin-top:0">🏃 When and where will you move?</h2>${moveBlock(state, date)}</div>
      ${mealBlock(state, date)}
      ${habitBlock(state)}
      ${done ? `<div class="notice ok">${icon('check')}<div><strong>Tomorrow is planned.</strong> Sleep well.</div></div><a class="btn block" href="#/today">Back to today</a>`
        : `<button class="btn primary large block" data-action="planDone">Tomorrow is planned ✓</button>`}
      <p class="muted" style="font-size:var(--text-xs);margin-top:12px">Why it works: <a href="#/learn/plan_ahead">the evidence</a></p>`;
  },
  actions: {
    planSetWhen(form, ev, ctx, data) {
      const time = /^\d{2}:\d{2}$/.test(data.time || '') ? data.time : '';
      if (!time) return ctx.toast('Pick a time');
      const date = tomorrow();
      const id = form.dataset.ev || `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const e = { id, planKey: form.dataset.key, title: form.dataset.title, date, time, place: String(data.place || '').trim().slice(0, 80), kind: form.dataset.kind, notes: '', public: false };
      ctx.update((st) => {
        const prev = (st.events || []).find((x) => x.id === id);
        st.events = [...(st.events || []).filter((x) => x.id !== id), { ...e, public: !!prev?.public }];
        return st;
      }, { quiet: true });
      ctx.toast(`${form.dataset.title}: ${time}${e.place ? ` at ${e.place}` : ''}`);
      share.sync(ctx);
    },
    planDone(el, ev, ctx) {
      ctx.update((st) => {
        st.flags = { ...(st.flags || {}), planned: tomorrow() };
        return st;
      }, { quiet: true });
      confetti(0.5);
      ctx.toast('Tomorrow is planned. Sleep well 🌙');
    },
  },
};
