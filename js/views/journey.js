// Journey: the suggested healthy goal, a realistic timeline and the stops along the way.
import { html, esc, icon, fmtKg, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { PACES } from '../engine/calc.js';
import { journey, healthyRange, timeline, fmtDuration } from '../engine/journey.js';
import { daysBetween } from '../engine/util.js';

const monthYear = (iso) => fmtDate(iso, { month: 'short', year: 'numeric' });

/** "≈ Mar 2027 · in 4 months" */
export function whenLabel(stop, today) {
  if (stop.reached) return stop.kind === 'time' ? fmtDate(stop.date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Reached';
  if (!stop.date) return 'Beyond the current plan';
  const weeks = daysBetween(today, stop.date) / 7;
  return `≈ ${monthYear(stop.date)} · in ${fmtDuration(weeks)}`;
}

export function stopRow(s, { u, today, hide }) {
  const mark = s.reached ? `<span class="rm-dot on">${icon('check')}</span>` : s.next ? `<span class="rm-dot next">${icon('flag')}</span>` : '<span class="rm-dot"></span>';
  const kg = hide ? '' : s.kind === 'time' ? (s.lostKg != null && s.lostKg >= 0.5 ? ` · about ${fmtKg(s.lostKg, u)} down by then` : '') : ` · ${fmtKg(s.weightKg, u)} (−${fmtKg(s.lostKg, u)})`;
  return `<li class="rm-stop ${s.reached ? 'done' : ''} ${s.next ? 'next' : ''} ${s.kind}">${mark}<div class="grow">
    <div class="rm-when">${esc(whenLabel(s, today))}${kg}</div>
    <strong>${esc(s.title)}</strong>
    <p>${esc(s.text)}${!hide && s.scale ? ' ' + esc(s.scale) : ''}</p></div></li>`;
}

export default {
  render(state) {
    const today = store.today();
    const p = state.profile;
    const u = p.units === 'imperial' ? 'imperial' : 'metric';
    const hide = store.habitsOnly(state);
    const j = journey(state, { today, trendKg: store.trendWeight(state) });
    const stops = hide ? j.stops.filter((s) => s.kind === 'time') : j.stops;
    if (hide) {
      const n = stops.find((s) => !s.reached);
      stops.forEach((s) => (s.next = s === n));
    }
    const range = healthyRange(p.heightCm);
    const maintain = p.phase === 'maintain';
    const left = Math.max(0, j.now - (j.goalKg || j.now));
    const end = j.timeline.reached && j.timeline.weeks ? j.timeline : null;

    const head = hide
      ? `<div class="card journey-hero"><h2>One step at a time</h2><p class="muted">Your journey is about habits, not numbers. Here’s what people often notice along the way.</p></div>`
      : html`<div class="card journey-hero">
        <div class="row between nowrap" style="align-items:flex-end"><div><div class="big num">${fmtKg(j.lost, u)}</div><div class="muted" style="font-size:var(--text-sm)">down since ${fmtDate(p.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
          ${j.goalKg ? `<div style="text-align:right"><div class="big num">${fmtKg(left, u)}</div><div class="muted" style="font-size:var(--text-sm)">to ${fmtKg(j.goalKg, u)}</div></div>` : ''}</div>
        ${j.goalKg ? `<div class="bar" style="margin:12px 0 6px"><span style="width:${Math.max(1.5, j.pct).toFixed(1)}%"></span></div><div class="muted" style="font-size:var(--text-xs)">${j.pct.toFixed(0)}% of the way from ${fmtKg(j.startKg, u)}</div>` : ''}
        ${maintain ? `<div class="notice ok" style="margin:12px 0 0">${icon('star')}<div><strong>You’re in maintenance.</strong> The journey now is keeping it — same habits, a little more food.</div></div>`
          : end ? `<p style="margin:14px 0 0"><strong>Estimated time to goal: ${esc(end.text)}</strong><br><span class="muted" style="font-size:var(--text-sm)">Around ${esc(monthYear(addWeeks(today, end.weeks)))}–${esc(monthYear(addWeeks(today, end.hiWeeks)))} at your ${esc(PACES[p.pace]?.label.replace(/ \(.*\)/, '').toLowerCase() || 'steady')} pace. Plateaus, holidays and planned breaks are normal — that’s why it’s a range.</span></p>`
          : j.goalKg && !j.timeline.reached ? `<p class="muted" style="margin:14px 0 0">At the current plan the trend would level off before your goal. That’s normal on a long journey — the weekly check-in will adjust, or you can set a nearer goal for now.</p>` : ''}
      </div>
      ${goalCard(state, j, range, u)}
      ${!maintain && end && end.weeks > 26 ? `<div class="notice info">${icon('flag')}<div>${end.weeks > 104 ? `Years can sound like a lot. But nobody walks the whole road at once:` : 'Broken into stops, it’s much easier to picture:'} you only ever need to reach the <strong>next stop</strong>. There are ${stops.filter((s) => !s.reached).length} ahead, the nearest is ${esc(whenLabel(stops.find((s) => !s.reached), today).replace('≈ ', '').split(' · ')[1] || 'close')} away.</div></div>` : ''}
      ${!maintain && j.goalKg && j.now > j.goalKg ? paceCompare(state, j) : ''}`;

    return html`<a class="btn ghost small" href="#/progress">${icon('back')}Progress</a>
      <header class="page-head"><div><div class="eyebrow">Your journey</div><h1>${hide || !j.goalKg ? 'The road ahead' : `${esc(fmtKg(j.startKg, u))} → ${esc(fmtKg(j.goalKg, u))}`}</h1></div></header>
      ${head}
      <div class="card"><h2>Stops along the way</h2>
        <ol class="roadmap">${stops.map((s) => stopRow(s, { u, today, hide })).join('')}</ol>
        <p class="muted" style="font-size:var(--text-xs);margin-top:10px">Dates are estimates from your trend weight and plan, recalculated each time you open this page. Everyone’s body is different — what you notice may come sooner or later.</p>
        <a class="btn small ghost" href="#/learn/journey">${icon('learn')}The evidence behind these stops</a></div>`;
  },
  actions: {
    useGoal(el, ev, ctx) {
      const kg = Number(el.dataset.kg);
      ctx.undoable(`Goal set to ${fmtKg(kg, ctx.state.profile.units === 'imperial' ? 'imperial' : 'metric')}`, (st) => {
        st.profile.goalWeightKg = kg;
        return st;
      });
    },
  },
};

function addWeeks(iso, weeks) {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d.toISOString().slice(0, 10);
}

export function goalCard(state, j, range, u) {
  const p = state.profile;
  const healthy = `Healthy range for your height: <strong>${fmtKg(range.lo, u)}–${fmtKg(range.hi, u)}</strong> (BMI 18.5–24.9).`;
  if (!j.suggested) return `<p class="muted" style="font-size:var(--text-sm)">${healthy}</p>`;
  if (!p.goalWeightKg) return `<div class="notice ok">${icon('flag')}<div class="grow">${healthy} <strong>Suggested goal: ${fmtKg(j.suggested, u)}</strong> — the nearest healthy weight.</div><button class="btn small primary" data-action="useGoal" data-kg="${j.suggested}">Use it</button></div>`;
  if (Math.abs(p.goalWeightKg - j.suggested) >= 0.6) return `<p class="muted" style="font-size:var(--text-sm)">${healthy} Your goal is ${fmtKg(p.goalWeightKg, u)}; the nearest healthy weight is ${fmtKg(j.suggested, u)}. <button class="btn small ghost" data-action="useGoal" data-kg="${j.suggested}">Use ${fmtKg(j.suggested, u)}</button></p>`;
  return `<p class="muted" style="font-size:var(--text-sm)">${healthy} Your goal is the nearest healthy weight.</p>`;
}

function paceCompare(state, j) {
  const p = state.profile;
  const rows = Object.entries(PACES).map(([k, pace]) => {
    const t = timeline({ ...p, weightKg: j.now, pace: k, phase: 'lose' }, j.goalKg);
    return `<div class="stat ${p.pace === k ? 'on' : ''}"><span class="v" style="font-size:var(--text-sm)">${t.reached ? esc(fmtDuration(t.weeks)) : '—'}</span><span class="l">${esc(pace.label.replace(/ \(.*\)/, ''))}${p.pace === k ? ' · yours' : ''}</span></div>`;
  });
  return `<div class="card"><h2>Pace and time</h2><div class="stats" style="grid-template-columns:repeat(3,1fr)">${rows.join('')}</div><p class="muted" style="font-size:var(--text-xs);margin-top:8px">Fastest isn’t best: the pace you can keep for years wins. Change it any time in <a href="#/settings/profile">Settings</a>.</p></div>`;
}
