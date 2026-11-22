// Today: weigh-in, today's meals (tick off), movement, habits.
import { html, esc, icon, fmtWeight, fmtDelta, toKg, fmtNum, progressBar, weightNum, fmtDate } from '../ui/dom.js';
import { ring } from '../ui/charts.js';
import * as store from '../store.js';
import { mealsFor, computeIntake, eatenSoFar, dayComplete, setMealStatus, proteinEaten, recipeDetails, mealMeta, slotLabel, safetyNotices, checkinDue, dayIndex } from './shared.js';
import { byId, swapMeal } from '../engine/meals.js';
import { habitById, streak } from '../engine/habits.js';
import { stepGoal } from '../engine/workouts.js';
import { round, addDays, weekStart } from '../engine/util.js';
import { CARDIO } from '../data/exercises.js';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function weighCard(state, date, u) {
  const todays = state.weights.find((w) => w.date === date);
  const trend = store.trendWeight(state);
  const start = state.profile.startWeightKg;
  const lost = start - trend;
  return `<div class="card"><div class="card-head"><h2>${icon('scale')} Weigh-in</h2><a href="#/progress" class="muted">Trend ${fmtWeight(trend, u)}</a></div>
    <form data-form="weigh" class="row nowrap">
      <div class="inline-inputs grow"><input type="number" inputmode="decimal" step="0.1" name="w" aria-label="Today's weight" placeholder="${todays ? round(weightNum(todays.kg, u), 0.1) : 'Today’s weight'}" required><span class="unit">${u === 'imperial' ? 'lb' : 'kg'}</span></div>
      <button class="btn primary">${todays ? 'Update' : 'Log'}</button>
    </form>
    <p class="muted" style="margin:8px 0 0;font-size:.88rem">${todays ? `Logged ${fmtWeight(todays.kg, u)} today. ` : 'Same time each morning, after the bathroom, before eating. '}${Math.abs(lost) >= 0.1 ? `Trend change since you started: <strong>${fmtDelta(-lost, u)}</strong>.` : 'Daily numbers bounce around with water — the trend is what counts.'}</p></div>`;
}

function foodCard(state, date, u, showNumbers) {
  const t = store.targets(state, date);
  const meals = mealsFor(state, date);
  const log = state.mealLog[date] || {};
  const eaten = eatenSoFar(state, date);
  const complete = dayComplete(state, date);
  const p = proteinEaten(state, date);
  const extras = state.extras[date] || [];
  const list = meals
    .map((m) => {
      const r = byId(m.recipeId);
      const st = log[m.slot]?.status;
      return `<li class="meal ${st === 'ate' ? 'done' : ''}">
        <div><div class="slot">${slotLabel(m.slot)}${st === 'skip' ? ' · skipped' : st === 'other' ? ` · ate something else${showNumbers ? ` (${fmtNum(log[m.slot].kcal)} kcal)` : ''}` : ''}</div>
          <div class="name">${esc(r.name)}</div>${mealMeta(m, showNumbers)}</div>
        <div class="actions">
          <button class="check ${st === 'ate' ? 'on' : ''}" data-action="ate" data-slot="${m.slot}" aria-label="Mark ${esc(r.name)} as eaten" title="I ate this">${icon('check')}</button>
        </div>
        <div class="row" style="grid-column:1/-1;gap:6px">
          <button class="btn small ghost" data-action="swap" data-slot="${m.slot}">${icon('swap')}Swap</button>
          <button class="btn small ghost" data-action="other" data-slot="${m.slot}">Ate something else</button>
          <button class="btn small ghost" data-action="skip" data-slot="${m.slot}">Skipped</button>
        </div>
        ${recipeDetails(m, u)}
      </li>`;
    })
    .join('');
  return `<div class="card"><div class="card-head"><h2>${icon('meals')} Today’s food</h2><a href="#/meals/${dayIndex(date)}" class="muted">Full plan →</a></div>
    ${showNumbers ? `<div class="row nowrap" style="gap:18px;align-items:center">
      ${ring(eaten, t.kcal, { label: fmtNum(eaten), sub: `of ${fmtNum(t.kcal)} kcal` })}
      <div class="grow">
        <div class="macro"><span>Protein</span>${progressBar(p, t.proteinG, { label: 'Protein' })}<span>${Math.round(p)}/${t.proteinG} g</span></div>
        <p class="muted" style="font-size:.85rem;margin:8px 0 0">${complete ? '✓ Day fully logged — this helps the app learn your real energy needs.' : 'Tick each meal (or mark it skipped / something else). Rough is fine — logging often matters more than logging perfectly.'}</p>
      </div></div>` : '<p class="muted">Regular meals, with protein and vegetables at each. Tick them off as you go.</p>'}
    <ul class="list" style="margin-top:8px">${list}</ul>
    ${extras.length ? `<div class="muted" style="font-size:.88rem;margin-top:6px">Extras: ${extras.map((x, i) => `${esc(x.label || 'extra')}${showNumbers ? ` (${fmtNum(x.kcal)} kcal)` : ''} <button class="btn small ghost" data-action="rmExtra" data-i="${i}" aria-label="Remove">${icon('x')}</button>`).join(' · ')}</div>` : ''}
    <form data-form="extra" class="row" style="margin-top:10px">
      <input type="text" name="label" placeholder="Anything else? e.g. latte, biscuit" aria-label="Extra food" class="grow" style="flex:2;min-width:150px">
      ${showNumbers ? '<input type="number" name="kcal" inputmode="numeric" placeholder="kcal" aria-label="Calories" style="width:90px" min="0" max="3000">' : ''}
      <button class="btn small">${icon('plus')}Add</button>
    </form></div>`;
}

function moveCard(state, date) {
  const { schedule } = store.schedule(state, date);
  const d = schedule[dayIndex(date)];
  const done = state.workouts.log[date] || [];
  const goal = stepGoal(state.profile.baselineSteps, state.profile.stepLevel || 0, state.profile.age);
  const steps = state.steps[date];
  const items = d.items
    .map((it) => {
      const isDone = done.some((x) => x.kind === it.kind);
      if (it.kind === 'rest') return '<p class="muted">Rest day. A relaxed walk is still a good idea.</p>';
      if (it.kind === 'strength') return `<div class="row between"><div><strong>Strength session ${it.variant}</strong><div class="muted" style="font-size:.88rem">${it.exercises.length} exercises · about ${it.minutes} min</div></div>${isDone ? '<span class="tag green">done ✓</span>' : `<a class="btn small primary" href="#/move/session/${it.variant}">Start</a>`}</div>`;
      return `<div class="row between"><div><strong>${esc(CARDIO[it.mode].label)}</strong><div class="muted" style="font-size:.88rem">${it.minutes} minutes, at a pace where you can talk</div></div>${isDone ? '<span class="tag green">done ✓</span>' : `<button class="btn small primary" data-action="cardioDone" data-mode="${it.mode}" data-min="${it.minutes}">Done</button>`}</div>`;
    })
    .join('<hr style="border:0;border-top:1px solid var(--line);margin:10px 0">');
  return `<div class="card"><div class="card-head"><h2>${icon('move')} Movement</h2><a href="#/move" class="muted">This week →</a></div>${items}
    <form data-form="steps" class="row nowrap" style="margin-top:12px">
      <div class="grow"><div class="row between" style="font-size:.88rem"><span>Steps today</span><span class="muted">goal ${fmtNum(goal)}</span></div>${progressBar(steps || 0, goal, { label: 'Steps' })}</div>
      <input type="number" name="steps" inputmode="numeric" min="0" max="100000" placeholder="${steps ?? 'steps'}" aria-label="Steps today" style="width:100px">
      <button class="btn small">Save</button></form></div>`;
}

function habitsCard(state, date) {
  const active = state.habits.active;
  if (!active.length) return `<div class="card"><h2>${icon('habits')} Habits</h2><p class="muted">No active habits. <a href="#/habits">Choose one</a> — small and specific works best.</p></div>`;
  const log = state.habits.log[date] || {};
  return `<div class="card"><div class="card-head"><h2>${icon('habits')} Habits</h2><a href="#/habits" class="muted">Manage →</a></div><ul class="list">
    ${active.map((a) => {
      const h = habitById(a.id);
      const on = !!log[a.id];
      const st = streak(state.habits.log, a.id, date);
      return `<li class="habit-item"><button class="check ${on ? 'on' : ''}" data-action="habit" data-id="${a.id}" aria-pressed="${on}" aria-label="${esc(h.title)}">${icon('check')}</button>
        <div class="grow"><strong>${esc(h.title)}</strong><p>${esc(a.cue)} → ${esc(h.title.toLowerCase())}. <em>Hard day? ${esc(h.tiny)}.</em></p></div>
        <span class="tag ${st >= 3 ? 'green' : ''}" title="Forgiving streak: one missed day doesn't break it">${icon('flame', 'tiny')} ${st}</span></li>`;
    }).join('')}</ul></div>`;
}

function banners(state, date) {
  const out = [safetyNotices(state)];
  if (state.profile.demo) out.push(`<div class="notice info">${icon('info')}<div class="grow">You’re exploring <strong>demo data</strong>. <button class="btn small" data-action="endDemo">Start my own plan</button></div></div>`);
  if (checkinDue(state, date)) out.push(`<div class="notice ok">${icon('calendar')}<div class="grow"><strong>Your weekly check-in is ready.</strong> Two minutes to review the week and adjust your plan. <a href="#/checkin">Start check-in →</a></div></div>`);
  if (state.dietBreakUntil && date <= state.dietBreakUntil) out.push(`<div class="notice info">${icon('info')}<div>Planned maintenance phase until ${fmtDate(state.dietBreakUntil)}: calories are at your estimated needs. Keep the habits going.</div></div>`);
  const calc = state.calcWeightKg ?? state.profile.weightKg;
  const trend = store.trendWeight(state);
  if (Math.abs(trend - calc) >= 2) out.push(`<div class="notice info">${icon('info')}<div class="grow">Your trend has moved ${fmtWeight(Math.abs(trend - calc), state.profile.units === 'imperial' ? 'imperial' : 'metric')} since targets were last calculated, so they’ve been refreshed for your new weight. <button class="btn small" data-action="ackRecalc">OK</button></div></div>`);
  return out.join('');
}

export default {
  render(state) {
    const date = store.today();
    const u = state.profile.units === 'imperial' ? 'imperial' : 'metric';
    const showNumbers = !store.habitsOnly(state);
    return html`<h1>${greeting()}</h1><p class="muted">${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · week ${store.weeksSinceStart(state, date) + 1}</p>
      ${banners(state, date)}
      <div class="grid two">
        <div>${showNumbers ? weighCard(state, date, u) : ''}${habitsCard(state, date)}${moveCard(state, date)}</div>
        <div>${foodCard(state, date, u, showNumbers)}</div>
      </div>`;
  },
  actions: {
    weigh(form, ev, ctx, data) {
      const s = ctx.state;
      const u = s.profile.units === 'imperial' ? 'imperial' : 'metric';
      const kg = toKg(Number(data.w), u);
      if (!(kg > 30 && kg < 400)) return ctx.toast('That number looks off — please check it.');
      const date = store.today();
      const prev = store.trendWeight(s);
      if (prev && Math.abs(kg - prev) > 8) ctx.toast('That’s a big jump from your trend — double-check the units.');
      ctx.update((st) => {
        st.weights = st.weights.filter((w) => w.date !== date).concat({ date, kg: round(kg, 0.01) }).sort((a, b) => (a.date < b.date ? -1 : 1));
        st.habits.log[date] = { ...(st.habits.log[date] || {}), ...(st.habits.active.some((a) => a.id === 'weigh_daily') ? { weigh_daily: true } : {}) };
        return st;
      });
      ctx.toast('Logged. It’s the trend that matters, not any single day.');
    },
    ate(el, ev, ctx) {
      setMeal(ctx, el.dataset.slot, (cur) => (cur?.status === 'ate' ? null : { status: 'ate' }));
    },
    skip(el, ev, ctx) {
      setMeal(ctx, el.dataset.slot, (cur) => (cur?.status === 'skip' ? null : { status: 'skip' }));
    },
    async other(el, ev, ctx) {
      const show = !store.habitsOnly(ctx.state);
      const v = show ? await ctx.ask('Roughly how many calories was it? A rough guess is fine.', { value: '500' }) : '0';
      if (v == null) return;
      setMeal(ctx, el.dataset.slot, () => ({ status: 'other', kcal: Math.max(0, Number(v) || 0) }));
    },
    swap(el, ev, ctx) {
      const date = store.today();
      const s = ctx.state;
      const wk = weekStart(date);
      const di = dayIndex(date);
      const t = store.targets(s, date);
      const meals = swapMeal(t, s.prefs, s.plans[wk].days[di], el.dataset.slot, `${date}|${Date.now()}`);
      ctx.update((st) => {
        st.plans[wk].days[di] = meals;
        return st;
      });
      ctx.toast('Swapped. Portions re-balanced to keep the day on target.');
    },
    extra(form, ev, ctx, data) {
      const date = store.today();
      if (!data.label && !data.kcal) return;
      ctx.update((st) => {
        st.extras[date] = [...(st.extras[date] || []), { label: data.label || 'Extra', kcal: Number(data.kcal) || 0 }];
        st.intake[date] = computeIntake(st, date);
        return st;
      });
    },
    rmExtra(el, ev, ctx) {
      const date = store.today();
      ctx.update((st) => {
        st.extras[date] = (st.extras[date] || []).filter((_, i) => i !== Number(el.dataset.i));
        st.intake[date] = computeIntake(st, date);
        return st;
      });
    },
    habit(el, ev, ctx) {
      const date = store.today();
      const id = el.dataset.id;
      ctx.update((st) => {
        const day = { ...(st.habits.log[date] || {}) };
        if (day[id]) delete day[id];
        else day[id] = true;
        st.habits.log[date] = day;
        return st;
      });
    },
    steps(form, ev, ctx, data) {
      const n = Number(data.steps);
      if (!(n >= 0)) return;
      const date = store.today();
      ctx.update((st) => {
        st.steps[date] = Math.round(n);
        const goal = stepGoal(st.profile.baselineSteps, st.profile.stepLevel || 0, st.profile.age);
        if (n >= goal && st.habits.active.some((a) => a.id === 'step_goal')) st.habits.log[date] = { ...(st.habits.log[date] || {}), step_goal: true };
        return st;
      });
      ctx.toast('Steps saved.');
    },
    cardioDone(el, ev, ctx) {
      const date = store.today();
      ctx.update((st) => {
        st.workouts.log[date] = [...(st.workouts.log[date] || []), { kind: 'cardio', mode: el.dataset.mode, minutes: Number(el.dataset.min) }];
        return st;
      });
      ctx.toast('Nice work. Every session counts.');
    },
    async endDemo(el, ev, ctx) {
      if (!(await ctx.confirm('Clear the demo data and set up your own plan?', { ok: 'Start my own plan' }))) return;
      ctx.set(store.emptyState(), { render: false });
      ctx.go('#/start');
    },
    ackRecalc(el, ev, ctx) {
      ctx.update((st) => {
        st.calcWeightKg = store.trendWeight(st);
        return st;
      });
    },
  },
};

function setMeal(ctx, slot, fn) {
  const date = store.today();
  ctx.update((st) => setMealStatus(st, date, slot, fn));
}

export { addDays };
