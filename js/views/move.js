// Movement: the week's schedule, strength session player with feedback, cardio logging.
import { html, esc, icon, progressBar, fmtNum } from '../ui/dom.js';
import * as store from '../store.js';
import { progressChain, stepOf, stepGoal, REP_RANGE } from '../engine/workouts.js';
import { CARDIO, WARMUP, COOLDOWN, CHAINS } from '../data/exercises.js';
import { STOP_SIGNS } from '../engine/safety.js';
import { addDays, weekStart } from '../engine/util.js';
import { dayIndex } from './shared.js';

let ratings = {}; // chainKey -> rating, for the session in progress

function weekMinutes(state, wk) {
  let cardio = 0;
  let strength = 0;
  for (let i = 0; i < 7; i++) {
    for (const x of state.workouts.log[addDays(wk, i)] || []) {
      if (x.kind === 'cardio') cardio += x.minutes || 0;
      if (x.kind === 'strength') strength++;
    }
  }
  return { cardio, strength };
}

function dose(ex) {
  const per = ex.perSide ? ' each side' : '';
  return ex.type === 'time' ? `${ex.sets} × ${ex.reps} sec${per}` : `${ex.sets} × ${ex.reps}${per}`;
}

function overview(state) {
  const date = store.today();
  const wk = weekStart(date);
  const { schedule, cardioMin } = store.schedule(state, date);
  const done = weekMinutes(state, wk);
  const strengthPlanned = schedule.reduce((a, d) => a + d.items.filter((i) => i.kind === 'strength').length, 0);
  const goal = stepGoal(state.profile.baselineSteps, state.profile.stepLevel || 0, state.profile.age);
  const ti = dayIndex(date);
  const grid = schedule.map((d, i) => {
    const dd = addDays(wk, i);
    const logged = state.workouts.log[dd] || [];
    const pills = d.items.map((it) => {
      const isDone = logged.some((x) => x.kind === it.kind);
      if (it.kind === 'rest') return '<span class="pill rest">rest</span>';
      if (it.kind === 'strength') return `<span class="pill strength ${isDone ? 'done' : ''}" title="Strength session ${it.variant}">Str ${it.variant}</span>`;
      return `<span class="pill cardio ${isDone ? 'done' : ''}" title="${esc(CARDIO[it.mode].label)}">${it.minutes}′ ${esc(it.mode)}</span>`;
    });
    return `<div class="d ${i === ti ? 'today' : ''}"><b>${d.name}</b>${pills.join('')}</div>`;
  });
  const today = schedule[ti];
  const prog = state.workouts.progress;
  return html`<h1>Move</h1>
    <p class="muted">Activity is for health, mood and keeping weight off — it doesn’t need to be earned or burned off with food. Start low, go slow, and let the plan build.</p>
    <div class="grid two">
      <div class="card"><h2>This week</h2>
        <div class="macro"><span>Cardio</span>${progressBar(done.cardio, cardioMin, { label: 'Cardio minutes' })}<span>${done.cardio}/${cardioMin} min</span></div>
        <div class="macro"><span>Strength</span>${progressBar(done.strength, strengthPlanned, { label: 'Strength sessions' })}<span>${done.strength}/${strengthPlanned}</span></div>
        <p class="muted" style="font-size:.86rem;margin-top:8px">Weekly cardio target grows by about 10% a week toward 150, then 200+ minutes. Daily steps goal: ${fmtNum(goal)}.</p>
      </div>
      <div class="card"><h2>Today</h2>${today.items.map((it) => {
        if (it.kind === 'rest') return '<p class="muted">Rest day — gentle walking is still great.</p>';
        if (it.kind === 'strength') return `<p><strong>Strength session ${it.variant}</strong> · ${it.exercises.length} exercises</p><a class="btn primary" href="#/move/session/${it.variant}">Start session</a>`;
        return `<p><strong>${esc(CARDIO[it.mode].label)}</strong> · ${it.minutes} min</p><p class="muted" style="font-size:.88rem">${esc(CARDIO[it.mode].how)}</p>`;
      }).join('')}</div>
    </div>
    <div class="card"><h2>Week plan</h2><div class="week">${grid.join('')}</div></div>
    <div class="card"><div class="card-head"><h2>Log activity</h2></div>
      <form data-form="logCardio" class="row">
        <select name="mode" style="flex:1;min-width:150px">${Object.entries(CARDIO).map(([k, c]) => `<option value="${k}">${esc(c.label)}</option>`).join('')}</select>
        <input type="number" name="minutes" min="1" max="300" placeholder="minutes" required style="width:110px" inputmode="numeric">
        <input type="date" name="date" value="${date}" max="${date}" style="width:160px">
        <button class="btn primary">Log</button>
      </form></div>
    <div class="card"><h2>Your strength levels</h2><p class="muted" style="font-size:.88rem">Each movement moves up a level when it feels easy, and back down if it’s too hard or hurts.</p>
      <table class="simple"><tr><th>Movement</th><th>Current exercise</th><th class="right">Dose</th></tr>
      ${Object.entries(prog).map(([k, st]) => {
        const s = stepOf(k, st.stepId);
        return s ? `<tr><td>${esc(CHAINS[k].label)}</td><td>${esc(s.name)}${st.painFlag ? ' <span class="tag warm">eased back</span>' : ''}</td><td class="right">${dose({ ...s, sets: st.sets, reps: st.reps })}</td></tr>` : '';
      }).join('')}</table>
      <p class="muted" style="font-size:.85rem;margin-top:8px">Equipment, joints and days are in <a href="#/settings">Settings</a>.</p></div>
    ${stopSigns()}`;
}

function stopSigns() {
  return `<div class="notice warn">${icon('alert')}<div><strong>Stop and seek help if you get:</strong> ${STOP_SIGNS.map(esc).join('; ')}. Muscle effort and being out of breath are normal; pain is not.</div></div>`;
}

function session(state, variant) {
  const date = store.today();
  const { schedule } = store.schedule(state, date);
  const item = schedule.flatMap((d) => d.items).find((i) => i.kind === 'strength' && i.variant === variant);
  if (!item) return '<div class="empty">No session found. <a href="#/move">Back</a></div>';
  const rateBtn = (chain, value, label) => `<button type="button" class="btn small ${ratings[chain] === value ? 'on' : ''}" data-action="rate" data-chain="${chain}" data-value="${value}" aria-pressed="${ratings[chain] === value}">${label}</button>`;
  return html`<a href="#/move" class="btn ghost small">${icon('back')}Move</a>
    <h1>Strength session ${esc(variant)}</h1>
    <p class="muted">Rest 60–90 seconds between sets. Move slowly and with control; breathe out as you push. Stop 2–3 reps before you can’t do any more.</p>
    <div class="card"><h3>Warm-up (5 min)</h3><ul style="padding-left:20px;margin:0">${WARMUP.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>
    ${item.exercises.map((ex, i) => `<div class="exercise"><div class="row between"><h3 style="margin:0">${i + 1}. ${esc(ex.name)}</h3><span class="dose">${dose(ex)}</span></div>
      <p>${esc(ex.how)}</p>
      <div class="field-label" style="font-size:.85rem">How did it feel?</div>
      <div class="rate">${rateBtn(ex.chain, 'easy', 'Too easy')}${rateBtn(ex.chain, 'right', 'Just right')}${rateBtn(ex.chain, 'hard', 'Too hard')}${rateBtn(ex.chain, 'pain', 'It hurt')}</div></div>`)}
    <div class="card"><h3>Cool-down</h3><ul style="padding-left:20px;margin:0">${COOLDOWN.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>
    <div class="row" style="margin:14px 0"><button class="btn primary" data-action="finish" data-variant="${esc(variant)}">${icon('check')}Finish session</button><span class="muted" style="font-size:.86rem">Unrated exercises count as “just right”.</span></div>
    ${stopSigns()}`;
}

export default {
  render(state, params) {
    if (params[0] === 'session') return session(state, params[1] || 'A');
    ratings = {};
    return overview(state);
  },
  actions: {
    rate(el, ev, ctx) {
      ratings[el.dataset.chain] = el.dataset.value;
      el.parentElement.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('on', b === el);
        b.setAttribute('aria-pressed', String(b === el));
      });
    },
    finish(el, ev, ctx) {
      const date = store.today();
      const variant = el.dataset.variant;
      const s = ctx.state;
      const { schedule } = store.schedule(s, date);
      const item = schedule.flatMap((d) => d.items).find((i) => i.kind === 'strength' && i.variant === variant);
      const changes = [];
      let pain = false;
      ctx.update((st) => {
        for (const ex of item.exercises) {
          const rating = ratings[ex.chain] || 'right';
          if (rating === 'pain') pain = true;
          const before = st.workouts.progress[ex.chain];
          const after = progressChain(before, ex.chain, rating, st.profile, date);
          if (after.stepId !== before.stepId) changes.push(`${stepOf(ex.chain, before.stepId).name} → ${stepOf(ex.chain, after.stepId).name}`);
          st.workouts.progress[ex.chain] = after;
        }
        st.workouts.log[date] = [...(st.workouts.log[date] || []), { kind: 'strength', variant, ratings: { ...ratings }, minutes: item.minutes }];
        if (st.habits.active.some((a) => a.id === 'strength_sessions')) st.habits.log[date] = { ...(st.habits.log[date] || {}), strength_sessions: true };
        return st;
      }, { render: false });
      ratings = {};
      ctx.toast(pain ? 'Logged. The painful exercise has been eased back — if pain persists, check with a physio or doctor.' : changes.length ? `Level up! ${changes[0]}` : 'Session logged. Great work.');
      ctx.go('#/move');
    },
    logCardio(form, ev, ctx, data) {
      const minutes = Number(data.minutes);
      if (!(minutes > 0)) return;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') && data.date <= store.today() ? data.date : store.today();
      ctx.update((st) => {
        st.workouts.log[date] = [...(st.workouts.log[date] || []), { kind: 'cardio', mode: data.mode, minutes }];
        return st;
      });
      ctx.toast(`${minutes} minutes logged.`);
    },
  },
};
void REP_RANGE;
