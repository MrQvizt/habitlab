// Progress: weight trend chart, milestones, rate, activity history, waist, check-in history.
import { html, esc, icon, fmtWeight, fmtDelta, weightNum, toKg, fmtDate } from '../ui/dom.js';
import { weightChart, barChart } from '../ui/charts.js';
import * as store from '../store.js';
import { trendSeries, weeklyRate } from '../engine/trend.js';
import { milestones, bmi, bmiCategory } from '../engine/calc.js';
import { addDays, weekStart, round, cmToIn, inToCm } from '../engine/util.js';

let range = 'all';

export default {
  render(state) {
    const date = store.today();
    const p = state.profile;
    const u = p.units === 'imperial' ? 'imperial' : 'metric';
    const hide = store.habitsOnly(state);
    const series = trendSeries(state.weights);
    const shown = range === 'all' ? series : series.slice(-(range === '4w' ? 28 : 84));
    const trend = store.trendWeight(state);
    const start = p.startWeightKg;
    const lost = start - trend;
    const pct = (lost / start) * 100;
    const rate = weeklyRate(state.weights, date, 21);
    const ms = milestones(start);
    const conv = (kg) => weightNum(kg, u);

    // Activity minutes per week (last 8 weeks)
    const wk = weekStart(date);
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(wk, -7 * (7 - i)));
    const mins = weeks.map((w) => {
      let m = 0;
      for (let d = 0; d < 7; d++) for (const x of state.workouts.log[addDays(w, d)] || []) m += x.minutes || 0;
      return { label: `${Number(w.slice(8))}/${Number(w.slice(5, 7))}`, value: m };
    });
    const loggedDays = Object.keys(state.mealLog).filter((d) => d > addDays(date, -28) && Object.keys(state.mealLog[d]).length).length;
    const weighDays = state.weights.filter((w) => w.date > addDays(date, -28)).length;

    const weightSection = hide ? '' : html`
      <div class="stats card">
        <div class="stat"><span class="v">${fmtWeight(trend, u)}</span><span class="l">trend weight</span></div>
        <div class="stat"><span class="v">${fmtDelta(-lost, u)}</span><span class="l">since ${fmtDate(p.startDate, { day: 'numeric', month: 'short' })}</span></div>
        <div class="stat"><span class="v">${pct >= 0 ? pct.toFixed(1) : '0.0'}%</span><span class="l">of starting weight</span></div>
        <div class="stat"><span class="v">${rate == null ? '–' : `${fmtDelta(rate, u, 2)}`}</span><span class="l">per week (last 3 weeks)</span></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Weight trend</h2><div class="segmented">${[['4w', '4 weeks'], ['12w', '12 weeks'], ['all', 'All']].map(([k, l]) => `<button type="button" class="${range === k ? 'on' : ''}" data-action="range" data-value="${k}">${l}</button>`).join('')}</div></div>
        ${weightChart(shown, { goal: p.phase === 'maintain' ? null : p.goalWeightKg, band: p.phase === 'maintain' && state.maintainKg ? { lo: state.maintainKg - 2, hi: state.maintainKg + 2 } : null, milestones: p.phase === 'maintain' ? [] : ms, conv, unitLabel: u === 'imperial' ? 'lb' : 'kg' })}
        ${p.phase === 'maintain' && state.maintainKg ? `<p style="font-size:.9rem;margin-top:6px"><strong>Maintenance:</strong> keep your trend between ${fmtWeight(state.maintainKg - 2, u)} and ${fmtWeight(state.maintainKg + 2, u)}. If it drifts above, the check-in starts a short reset plan.</p>` : ''}
        <p class="muted" style="font-size:.85rem;margin-top:6px">Dots are daily weigh-ins; the line is your smoothed trend. Water, salt, hormones and digestion move daily weight by 1–2 kg — the line shows what’s really happening.</p>
      </div>
      <div class="card"><h2>Milestones</h2><ul class="list">
        ${ms.map((m) => {
          const hit = trend <= m.weightKg;
          return `<li class="row nowrap"><span class="check ${hit ? 'on' : ''}" aria-hidden="true">${icon('check')}</span><div class="grow"><strong>${m.pct}% — ${fmtWeight(m.weightKg, u)}</strong>${hit ? ' <span class="tag green">reached</span>' : ` <span class="muted" style="font-size:.85rem">${fmtWeight(trend - m.weightKg, u)} to go</span>`}<div class="muted" style="font-size:.86rem">${esc(m.info)}</div></div></li>`;
        }).join('')}
        ${p.goalWeightKg ? `<li><strong>Your goal: ${fmtWeight(p.goalWeightKg, u)}</strong> <span class="muted">— BMI ${bmi(p.goalWeightKg, p.heightCm).toFixed(1)}</span></li>` : ''}
      </ul><p class="muted" style="font-size:.85rem">Current BMI ${bmi(trend, p.heightCm).toFixed(1)} (${bmiCategory(bmi(trend, p.heightCm))}). BMI is a rough screening number — waist size, blood tests and how you feel matter too.</p></div>`;

    return html`<h1>Progress</h1>
      ${weightSection}
      <div class="grid two">
        <div class="card"><h2>Consistency (last 28 days)</h2>
          <div class="stats" style="grid-template-columns:1fr 1fr">
            ${hide ? '' : `<div class="stat"><span class="v">${weighDays}</span><span class="l">days weighed</span></div>`}
            <div class="stat"><span class="v">${loggedDays}</span><span class="l">days with meals logged</span></div>
          </div>
          <p class="muted" style="font-size:.86rem;margin-top:8px">Logging often — even roughly — is one of the strongest predictors of success. These numbers matter more than the scale.</p></div>
        <div class="card"><h2>Active minutes per week</h2>${barChart(mins, { target: 150, unit: ' min' })}</div>
      </div>
      ${hide ? '' : `<div class="grid two">
        <div class="card"><h2>Weigh-ins</h2>
          <form data-form="addWeight" class="row"><input type="date" name="date" value="${date}" max="${date}" required style="width:160px" aria-label="Date"><div class="inline-inputs grow"><input type="number" name="w" step="0.1" inputmode="decimal" required placeholder="weight" aria-label="Weight"><span class="unit">${u === 'imperial' ? 'lb' : 'kg'}</span></div><button class="btn small primary">Add</button></form>
          <table class="simple" style="margin-top:10px"><tr><th>Date</th><th class="right">Weight</th><th class="right">Trend</th><th></th></tr>
          ${series.filter((s) => s.kg != null).slice(-12).reverse().map((s) => `<tr><td>${fmtDate(s.date)}</td><td class="right">${fmtWeight(s.kg, u)}</td><td class="right muted">${fmtWeight(s.trend, u)}</td><td class="right"><button class="btn small ghost" data-action="delWeight" data-date="${s.date}" aria-label="Delete">${icon('trash')}</button></td></tr>`).join('')}
          </table></div>
        <div class="card"><h2>Waist</h2><p class="muted" style="font-size:.88rem">Measure around your middle, level with your belly button, breathing out. Often drops even when the scale stalls.</p>
          <form data-form="addWaist" class="row"><div class="inline-inputs grow"><input type="number" name="v" step="0.5" inputmode="decimal" required aria-label="Waist"><span class="unit">${u === 'imperial' ? 'in' : 'cm'}</span></div><button class="btn small primary">Add</button></form>
          <table class="simple" style="margin-top:10px">${(state.waist || []).slice(-8).reverse().map((w) => `<tr><td>${fmtDate(w.date)}</td><td class="right">${u === 'imperial' ? `${round(cmToIn(w.cm), 0.5)} in` : `${w.cm} cm`}</td></tr>`).join('')}</table></div>
      </div>`}
      <div class="card"><h2>Check-in history</h2>${state.checkins.length ? `<table class="simple"><tr><th>Date</th><th>Rate</th><th>Changes</th></tr>${state.checkins.slice().reverse().map((c) => `<tr><td>${fmtDate(c.date)}</td><td>${c.rate == null || hide ? '–' : fmtDelta(c.rate, u, 2) + '/wk'}</td><td style="font-size:.86rem">${esc(describe(c.applied, hide))}</td></tr>`).join('')}</table>` : '<p class="muted">Your weekly check-ins will appear here.</p>'}</div>`;
  },
  actions: {
    range(el, ev, ctx) {
      range = el.dataset.value;
      ctx.rerender();
    },
    addWeight(form, ev, ctx, data) {
      const u = ctx.state.profile.units === 'imperial' ? 'imperial' : 'metric';
      const kg = toKg(Number(data.w), u);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '') || data.date > store.today()) return ctx.toast('Please pick a date (today or earlier).');
      if (!(kg > 30 && kg < 400)) return ctx.toast('Please check that number.');
      ctx.update((st) => {
        st.weights = st.weights.filter((w) => w.date !== data.date).concat({ date: data.date, kg: round(kg, 0.01) }).sort((a, b) => (a.date < b.date ? -1 : 1));
        return st;
      });
    },
    delWeight(el, ev, ctx) {
      if (ctx.state.weights.length <= 1) return ctx.toast('Keep at least one weigh-in.');
      ctx.update((st) => {
        st.weights = st.weights.filter((w) => w.date !== el.dataset.date);
        return st;
      });
    },
    addWaist(form, ev, ctx, data) {
      const u = ctx.state.profile.units === 'imperial' ? 'imperial' : 'metric';
      const v = Number(data.v);
      if (!(v > 20)) return;
      const cm = u === 'imperial' ? round(inToCm(v), 0.5) : v;
      const date = store.today();
      ctx.update((st) => {
        st.waist = (st.waist || []).filter((w) => w.date !== date).concat({ date, cm });
        return st;
      });
    },
  },
};

function describe(applied = [], hide) {
  if (!applied.length) return 'No changes';
  return applied
    .map((a) => {
      if (a.type === 'kcal') return hide ? 'Plan adjusted' : `${a.delta > 0 ? '+' : ''}${a.delta} kcal/day`;
      if (a.type === 'tdee') return 'Energy estimate learned';
      if (a.type === 'steps') return 'Step goal +500';
      if (a.type === 'cardio') return `+${a.delta} activity min/week`;
      if (a.type === 'phase') return 'Switched to maintenance';
      if (a.type === 'break') return `${a.weeks}-week maintenance phase`;
      if (a.type === 'prefs') return 'Meal plan settings';
      if (a.type === 'flag') return 'Extra support';
      if (a.type === 'safety') return 'Habits-only mode';
      if (a.type === 'habit-suggest') return 'Habit suggested';
      return a.type;
    })
    .join(', ');
}
