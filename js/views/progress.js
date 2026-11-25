// Progress: the home for everything long-term. A hub (journey, body levels, rewards, weekly
// check-in), past Body Wraps, then the weight trend, activity, weigh-ins, waist and check-in history.
import { html, esc, icon, fmtWeight, fmtDelta, weightNum, toKg, fmtDate } from '../ui/dom.js';
import { weightChart, barChart } from '../ui/charts.js';
import * as store from '../store.js';
import { trendSeries, weeklyRate } from '../engine/trend.js';
import { milestones, bmi, bmiCategory } from '../engine/calc.js';
import { addDays, weekStart, round, cmToIn, inToCm } from '../engine/util.js';
import { journey, nextStops } from '../engine/journey.js';
import { weekBody } from '../engine/body.js';
import { checkinDue } from './shared.js';
import { ring } from './wrap.js';

/** The long-term hub at the top of Progress. */
function hub(state, date, hide) {
  const p = state.profile;
  const u = p.units === 'imperial' ? 'imperial' : 'metric';
  const g = store.game(state);
  const lv = g.stats.body.levels;
  const w = weekBody(state, weekStart(date), { asOf: date, habitsOnly: hide });
  const bodyLevel = w.organs.reduce((a, o) => a + (lv[o.id]?.level || 1), 0);
  const j = journey(state, { today: date, trendKg: store.trendWeight(state) });
  const n = nextStops(j);
  const next = hide ? n.time : n.weight || n.time;
  const due = checkinDue(state, date);
  const lastCheck = state.checkins.length ? state.checkins[state.checkins.length - 1].date : null;
  const tile = (href, kicker, title, sub, extra = '', cls = '') => `<a class="hub-tile ${cls}" href="${href}"><span class="hub-k">${kicker}</span><strong>${title}</strong><span class="hub-s">${sub}</span>${extra}</a>`;
  return `<div class="hub-grid">
    ${tile('#/journey', `${icon('flag')} Journey`, p.phase === 'maintain' ? 'Keeping it off' : !hide && j.goalKg ? `${j.pct.toFixed(0)}% of the way` : 'The road ahead', next ? `Next: ${esc(next.title)}` : 'All stops reached', !hide && j.goalKg && p.phase !== 'maintain' ? `<span class="bar" style="margin-top:8px"><span style="width:${Math.max(2, j.pct).toFixed(1)}%"></span></span>` : '')}
    ${tile('#/body', '❤️ Your body', `Body level ${bodyLevel}`, `${w.closed}/${w.organs.length} rings closed this week`, `<span class="hub-rings">${w.organs.map((o) => ring(o.pct, o.color, { size: 22, stroke: 3.5 })).join('')}</span>`)}
    ${tile('#/rewards', `${icon('star')} Rewards`, `Level ${g.level} · ${esc(g.title)}`, `${g.streak}-day streak · ${g.badges.length} badges`)}
    ${tile('#/checkin', `${icon('calendar')} Weekly check-in`, due ? 'Ready now' : lastCheck ? 'Done for this week' : 'Your first one is coming', due ? 'Two minutes · +50 XP' : `${lastCheck ? `Last ${fmtDate(lastCheck, { day: 'numeric', month: 'short' })} · next` : 'Opens'} ${fmtDate(addDays(lastCheck || p.startDate, 7), { weekday: 'short', day: 'numeric', month: 'short' })}`, '', due ? 'due' : '')}
  </div>`;
}

/** The last few weeks' Body Wraps, so they can be opened again. */
function wrapsCard(state, date, hide) {
  const start = state.profile.startDate;
  const weeks = [];
  for (let i = 1; i <= 4; i++) {
    const ws = addDays(weekStart(date), -7 * i);
    if (addDays(ws, 6) < start) break;
    weeks.push(ws);
  }
  if (!weeks.length) return '';
  return `<div class="section-head"><h2>Body Wraps</h2><a href="#/wrap/${weekStart(date)}">This week so far</a></div>
    <div class="card tight"><ul class="rows">${weeks.map((ws, i) => {
      const w = weekBody(state, ws, { habitsOnly: hide });
      const opened = state.wraps?.[ws];
      return `<li><a class="row nowrap wrap-row" href="#/wrap/${ws}"><span class="grow"><strong>Week of ${fmtDate(ws, { day: 'numeric', month: 'short' })}</strong><span class="sub">${w.earned.length} thank-you note${w.earned.length === 1 ? '' : 's'} · ${w.closed}/${w.organs.length} rings closed${opened || i > 0 ? '' : ' · <b style="color:var(--accent)">new · +30 XP</b>'}</span></span><span class="hub-rings">${w.organs.map((o) => ring(o.pct, o.color, { size: 20, stroke: 3.5 })).join('')}</span>${icon('chevron')}</a></li>`;
    }).join('')}</ul></div>`;
}

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
    const narrow = typeof window !== 'undefined' && window.innerWidth < 600;

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
        <div class="stat"><span class="v">${rate == null ? '–' : Math.abs(rate) < 0.05 ? 'Steady' : `${rate < 0 ? 'Down' : 'Up'} ${fmtWeight(Math.abs(rate), u, 2)}`}</span><span class="l">${rate == null ? 'need more weigh-ins' : 'a week, last 3 weeks'}</span></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Weight trend</h2><div class="segmented">${[['4w', '4 weeks'], ['12w', '12 weeks'], ['all', 'All']].map(([k, l]) => `<button type="button" class="${range === k ? 'on' : ''}" data-action="range" data-value="${k}">${l}</button>`).join('')}</div></div>
        ${weightChart(shown, { width: narrow ? 360 : 640, height: narrow ? 230 : 240, goal: p.phase === 'maintain' ? null : p.goalWeightKg, band: p.phase === 'maintain' && state.maintainKg ? { lo: state.maintainKg - 2, hi: state.maintainKg + 2 } : null, milestones: p.phase === 'maintain' ? [] : ms, conv, unitLabel: u === 'imperial' ? 'lb' : 'kg' })}
        ${p.phase === 'maintain' && state.maintainKg ? `<p style="font-size:.9rem;margin-top:6px"><strong>Maintenance:</strong> keep your trend between ${fmtWeight(state.maintainKg - 2, u)} and ${fmtWeight(state.maintainKg + 2, u)}. If it drifts above, the check-in starts a short reset plan.</p>` : ''}
        <p class="muted" style="font-size:.85rem;margin-top:6px">Dots are daily weigh-ins; the line is your smoothed trend. Water, salt, hormones and digestion move daily weight by 1–2 kg — the line shows what’s really happening. Dashed lines mark the 5–15% health milestones${p.goalWeightKg ? ` and your goal (${fmtWeight(p.goalWeightKg, u)})` : ''}.</p>
        <p class="muted" style="font-size:.85rem">Current BMI ${bmi(trend, p.heightCm).toFixed(1)} (${bmiCategory(bmi(trend, p.heightCm))}). BMI is a rough screening number — waist size, blood tests and how you feel matter too. <a href="#/journey">See every stop on your journey</a></p>
      </div>
`;

    return html`<header class="page-head"><div><div class="eyebrow">Since ${fmtDate(p.startDate, { day: 'numeric', month: 'short' })}</div><h1>Progress</h1></div></header>
      ${hub(state, date, hide)}
      ${wrapsCard(state, date, hide)}
      ${hide ? '' : '<div class="section-head"><h2>Weight</h2></div>'}
      ${weightSection}
      <div class="grid two">
        <div class="card"><h2>Consistency (last 28 days)</h2>
          <div class="stats" style="grid-template-columns:1fr 1fr">
            ${hide ? '' : `<div class="stat"><span class="v">${weighDays}</span><span class="l">days weighed</span></div>`}
            <div class="stat"><span class="v">${loggedDays}</span><span class="l">days with meals logged</span></div>
          </div>
          <p class="muted" style="font-size:.86rem;margin-top:8px">Logging often — even roughly — is one of the strongest predictors of success. These numbers matter more than the scale.</p></div>
        <div class="card"><h2>Active minutes per week</h2>${barChart(mins, { target: 150, unit: ' min', width: narrow ? 360 : 640, height: narrow ? 190 : 180 })}</div>
      </div>
      ${hide ? '' : `<div class="grid two">
        <div class="card"><div class="card-head"><h2>Weigh-ins</h2><button class="btn small tonal" data-action="openWeigh" data-pick-date="1">${icon('plus')}Add</button></div>
          ${weighTable(series.filter((s) => s.kg != null).reverse(), u)}</div>
        <div class="card"><div class="card-head"><h2>Waist</h2><button class="btn small tonal" data-action="openWaist">${icon('plus')}Add</button></div><p class="muted" style="font-size:var(--text-sm);margin-top:-4px">Often drops even when the scale stalls.</p>
          ${(state.waist || []).length ? `<table class="simple">${(state.waist || []).slice(-5).reverse().map((w) => `<tr><td>${fmtDate(w.date)}</td><td class="right num">${u === 'imperial' ? `${round(cmToIn(w.cm), 0.5)} in` : `${w.cm} cm`}</td></tr>`).join('')}</table>` : '<p class="muted" style="font-size:var(--text-sm)">No measurements yet.</p>'}</div>
      </div>`}
      <div class="card"><div class="card-head"><h2>Check-in history</h2>${checkinDue(state, date) ? `<a class="btn small primary" href="#/checkin">Do this week’s</a>` : ''}</div>${state.checkins.length ? `<table class="simple"><tr><th>Date</th><th>Rate</th><th>Changes</th></tr>${state.checkins.slice().reverse().map((c) => `<tr><td>${fmtDate(c.date)}</td><td>${c.rate == null || hide ? '–' : fmtDelta(c.rate, u, 2) + '/wk'}</td><td style="font-size:.86rem">${esc(describe(c.applied, hide))}</td></tr>`).join('')}</table>` : '<p class="muted">Your weekly check-ins will appear here.</p>'}</div>
      <a class="card learn-link" href="#/learn">${icon('learn')}<span class="grow"><strong>The evidence</strong><span class="sub">The research behind every feature, in plain language</span></span>${icon('chevron')}</a>`;
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
      ctx.undoable('Weigh-in deleted', (st) => {
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

function weighTable(rows, u) {
  const row = (s) => `<tr><td>${fmtDate(s.date)}</td><td class="right num">${fmtWeight(s.kg, u)}</td><td class="right muted num">${fmtWeight(s.trend, u)}</td><td class="right" style="width:44px"><button class="icon-btn" data-action="delWeight" data-date="${s.date}" aria-label="Delete weigh-in on ${fmtDate(s.date)}">${icon('trash')}</button></td></tr>`;
  if (!rows.length) return '<p class="muted">No weigh-ins yet.</p>';
  return `<table class="simple"><tr><th>Date</th><th class="right">Weight</th><th class="right">Trend</th><th><span class="sr-only">Delete</span></th></tr>${rows.slice(0, 5).map(row).join('')}</table>
    ${rows.length > 5 ? `<details><summary class="btn small ghost" style="list-style:none;margin-top:6px">Show all ${rows.length}</summary><table class="simple">${rows.slice(5).map(row).join('')}</table></details>` : ''}`;
}

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
