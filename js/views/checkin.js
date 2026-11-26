// Weekly check-in: a few questions → specific, optional adjustments → apply.
import { html, esc, icon, chips, fmtWeight, toKg, fmtDelta } from '../ui/dom.js';
import * as store from '../store.js';
import { weeklyReview, applyRecs, BARRIER_OPTIONS } from '../engine/adjust.js';
import { habitById, MAX_ACTIVE } from '../engine/habits.js';
import { daysBetween, round } from '../engine/util.js';

let review = null; // {answers, result}

function scale(name, label, lo, hi) {
  return `<fieldset class="scale"><legend>${esc(label)}</legend>
    <div class="scale-opts">${[1, 2, 3, 4, 5].map((v) => `<label><input type="radio" name="${name}" value="${v}" required><span>${v}</span></label>`).join('')}</div>
    <div class="scale-ends"><span>${esc(lo)}</span><span>${esc(hi)}</span></div></fieldset>`;
}

function yesNo(name, label) {
  return `<fieldset class="scale yn"><legend>${esc(label)}</legend><div class="scale-opts" style="grid-template-columns:1fr 1fr">
    <label><input type="radio" name="${name}" value="no" required><span>No</span></label><label><input type="radio" name="${name}" value="yes" required><span>Yes</span></label></div></fieldset>`;
}

function edScreenDue(state, date) {
  const last = state.lastEdScreen || state.profile.startDate;
  return daysBetween(last, date) >= 28; // rule 25: re-screen every 4 weeks
}

function form(state) {
  const date = store.today();
  const u = state.profile.units === 'imperial' ? 'imperial' : 'metric';
  const hide = store.habitsOnly(state);
  const weighedToday = state.weights.some((w) => w.date === date);
  return html`<header class="page-head"><div><div class="eyebrow">Weekly</div><h1>Check-in</h1></div></header>
    <p class="muted" style="margin:-8px 0 14px">Be honest — there are no wrong answers, and the plan only changes in small steps.</p>
    <form data-form="review" class="card">
      ${!hide && !weighedToday ? `<label class="field"><span>Today’s weight (optional)</span><div class="inline-inputs"><input type="number" name="w" step="0.1" inputmode="decimal"><span class="unit">${u === 'imperial' ? 'lb' : 'kg'}</span></div></label>` : ''}
      ${scale('adherence', 'How closely did you follow the plan this week?', 'Not at all', 'Nearly always')}
      ${scale('hunger', 'How hungry have you felt?', 'Rarely', 'Very often')}
      ${scale('energy', 'How has your energy been?', 'Exhausted', 'Great')}
      ${scale('stress', 'How stressed have you felt?', 'Calm', 'Very stressed')}
      <div class="grid two">
        <label class="field"><span>Average sleep per night</span><div class="inline-inputs"><input type="number" name="sleepHours" min="2" max="14" step="0.5" value="7" inputmode="decimal"><span class="unit">hours</span></div></label>
        <label class="field"><span>Alcoholic drinks per day (average)</span><div class="inline-inputs"><input type="number" name="drinksPerDay" min="0" max="20" step="0.5" value="0" inputmode="decimal"><span class="unit">drinks</span></div></label>
      </div>
      <fieldset><legend>What got in the way? <span class="hint">Pick any — you’ll get a specific plan for each.</span></legend>${chips('barriers', Object.fromEntries(Object.entries(BARRIER_OPTIONS).map(([k, b]) => [k, b.label])), [])}</fieldset>
      ${edScreenDue(state, date) ? `<div class="card flat" style="margin:6px 0 18px"><div class="eyebrow" style="margin-bottom:8px">Monthly wellbeing check · over the past few weeks, have you…</div>
        ${yesNo('ed_binge', 'Felt out of control while eating?')}
        ${yesNo('ed_compensate', 'Tried to make up for eating (vomiting, laxatives, over-exercising)?')}
        ${yesNo('ed_worth', 'Felt your weight decides your worth?')}</div><input type="hidden" name="edScreened" value="1">` : ''}
      <div class="action-bar"><span class="muted need-all" style="font-size:var(--text-sm)">Answer each question to continue</span><span class="muted all-done" style="font-size:var(--text-sm)">+50 XP</span><button class="btn primary">See my adjustments ${icon('chevron')}</button></div>
    </form>`;
}

function results(state) {
  const { result } = review;
  const u = state.profile.units === 'imperial' ? 'imperial' : 'metric';
  const hide = store.habitsOnly(state);
  const groups = new Set();
  const recHtml = result.recs.map((r) => {
    const actionable = !['info'].includes(r.type) && !(r.type === 'habit');
    const habitBtn = r.type === 'habit' && r.habit && !state.habits.active.some((a) => a.id === r.habit) && state.habits.active.length < MAX_ACTIVE
      ? `<div style="margin-top:8px"><button type="button" class="btn small" data-action="addHabit" data-id="${r.habit}">${icon('plus')}Add habit: ${esc(habitById(r.habit).title)}</button></div>` : '';
    if (r.group) {
      const first = !groups.has(r.group);
      groups.add(r.group);
      return `<div class="rec group"><label><input type="radio" name="g_${r.group}" value="${r.id}" ${first ? 'checked' : ''}><div><strong>${esc(r.title)}</strong><p>${esc(r.body)}</p></div></label></div>`;
    }
    if (!actionable) return `<div class="rec"><strong>${esc(r.title)}</strong><p>${esc(hide ? stripNumbers(r.body) : r.body)}</p>${habitBtn}</div>`;
    return `<div class="rec"><label><input type="checkbox" name="accept" value="${r.id}" ${r.preselect || r.type === 'kcal' ? 'checked' : ''}><div><strong>${esc(hide ? stripNumbers(r.title) : r.title)}</strong><p>${esc(hide ? stripNumbers(r.body) : r.body)}</p></div></label></div>`;
  }).join('');
  return html`<header class="page-head"><div><div class="eyebrow">Check-in</div><h1>This week’s review</h1></div></header>
    ${hide ? '' : `<div class="stats card">
      <div class="stat"><span class="v">${fmtWeight(result.trendKg, u)}</span><span class="l">trend weight</span></div>
      <div class="stat"><span class="v">${result.rate == null ? '–' : fmtDelta(result.rate, u, 2)}</span><span class="l">per week</span></div>
      <div class="stat"><span class="v">${Math.max(0, result.lostPct).toFixed(1)}%</span><span class="l">lost so far</span></div>
      <div class="stat"><span class="v">${Math.floor(result.weeksIn) + 1}</span><span class="l">week</span></div></div>`}
    <form data-form="apply">
      ${recHtml}
      <div class="action-bar"><button type="button" class="btn ghost" data-action="redo">Change answers</button><button class="btn primary">${icon('check')}Apply selected</button></div>
      <p class="muted" style="font-size:.85rem;margin-top:10px">Changes are small on purpose. Your meal plan rebuilds automatically for the rest of the week.</p>
    </form>`;
}

function stripNumbers(text) {
  return text.replace(/[−+-]?\d[\d,.]*(\s*(→|to|–|-)\s*[−+-]?\d[\d,.]*)?\s*(kcal(\/day)?|kg(\/week)?|%)/g, '').replace(/\s{2,}/g, ' ');
}

export default {
  render(state) {
    return review ? results(state) : form(state);
  },
  actions: {
    review(formEl, ev, ctx, data) {
      const date = store.today();
      let s = ctx.state;
      if (data.w) {
        const u = s.profile.units === 'imperial' ? 'imperial' : 'metric';
        const kg = toKg(Number(data.w), u);
        if (kg > 30 && kg < 400) {
          s = structuredClone(s);
          s.weights = s.weights.filter((w) => w.date !== date).concat({ date, kg: round(kg, 0.01) }).sort((a, b) => (a.date < b.date ? -1 : 1));
          ctx.set(s, { render: false });
        }
      }
      const answers = {
        adherence: Number(data.adherence),
        hunger: Number(data.hunger),
        energy: Number(data.energy),
        stress: Number(data.stress),
        sleepHours: Number(data.sleepHours),
        drinksPerDay: Number(data.drinksPerDay),
        barriers: data.barriers || [],
        edFlags: ['binge', 'compensate', 'worth'].filter((k) => data['ed_' + k] === 'yes'),
        edScreened: !!data.edScreened,
      };
      review = { answers, result: weeklyReview(s, answers, date, { habitsOnly: store.habitsOnly(s) }) };
      ctx.rerender();
      window.scrollTo(0, 0);
    },
    redo(el, ev, ctx) {
      review = null;
      ctx.rerender();
    },
    addHabit(el, ev, ctx) {
      const id = el.dataset.id;
      ctx.update((st) => {
        if (st.habits.active.length < MAX_ACTIVE && !st.habits.active.some((a) => a.id === id)) st.habits.active.push({ id, cue: habitById(id).cue, started: store.today(), automaticity: null });
        return st;
      });
      ctx.toast('Habit added.');
    },
    apply(formEl, ev, ctx, data) {
      const date = store.today();
      const fd = new FormData(formEl);
      const ids = new Set(fd.getAll('accept'));
      for (const [k, v] of fd.entries()) if (k.startsWith('g_')) ids.add(v);
      const chosen = review.result.recs.filter((r) => ids.has(r.id));
      const { state, applied } = applyRecs(ctx.state, chosen, date);
      state.checkins = [...state.checkins, { date, answers: review.answers, applied, rate: review.result.rate }];
      if (review.answers.edScreened) state.lastEdScreen = date;
      review = null;
      ctx.set(state, { render: false });
      ctx.toast(applied.length ? 'Plan updated. See you next week!' : 'Check-in saved. Keep going!');
      ctx.go('#/today');
    },
  },
};
