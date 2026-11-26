// Movement: the week's schedule, strength session player with feedback, cardio logging.
import { html, esc, icon, progressBar, fmtNum } from '../ui/dom.js';
import * as store from '../store.js';
import { logDate, validLogDate } from '../viewdate.js';
import { progressChain, stepOf, stepGoal, REP_RANGE, INTENSITY, creditedMinutes } from '../engine/workouts.js';
import { chips } from '../ui/dom.js';
import { HOBBIES, HOBBY_CATEGORIES, intensityFromMet, hobbyByName } from '../data/hobbies.js';
import { CARDIO, WARMUP, COOLDOWN, CHAINS } from '../data/exercises.js';
import { STOP_SIGNS } from '../engine/safety.js';
import { addDays, weekStart, weekOrder, dateInWeek } from '../engine/util.js';
import { dayIndex } from './shared.js';
import { askActivity, itemName } from './planmove.js';
import { itemKey } from '../engine/workouts.js';

let ratings = {}; // chainKey -> rating, for the session in progress
let showAddActivity = false;
let pickCat = 'pop';
let picked = null; // hobby name, or '' for a custom activity
let logOther = false;
const DAY_CHIPS = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' };
const ACTIVITY_IDEAS = ['Walking with friends', 'Dog walk', 'Football', 'Dancing', 'Swimming', 'Cycling to work', 'Gardening', 'Yoga class', 'Climbing', 'Tennis / padel', 'Gym class', 'Hiking'];

/** First word, at most 7 characters, so it fits a narrow week-grid cell. */
function shortName(name) {
  const w = String(name).split(/\s+/)[0];
  return w.length > 7 ? w.slice(0, 6) + '…' : w;
}

/** Was this planned item logged on that day? */
export function itemDone(logged, it) {
  if (it.kind === 'activity') return logged.some((x) => x.kind === 'activity' && x.actId === it.id);
  return logged.some((x) => x.kind === it.kind);
}

function activitiesCard(state) {
  const acts = state.profile.activities || [];
  const list = acts.length
    ? `<ul class="list">${acts.map((a) => `<li class="row between nowrap"><div class="grow"><strong>${esc(a.name)}</strong><div class="muted" style="font-size:.86rem">${a.days.map((d) => DAY_CHIPS[d]).join(', ')} · ${a.minutes} min · ${esc(INTENSITY[a.intensity].label.toLowerCase())}${a.strength ? ' · builds strength' : ''}</div></div><button class="btn small ghost danger" data-action="removeActivity" data-id="${esc(a.id)}" aria-label="Remove ${esc(a.name)}">${icon('trash')}</button></li>`).join('')}</ul>`
    : '<p class="muted" style="font-size:.9rem">Already walk with friends, play a sport, dance or garden? Add it and your plan counts it — you’ll get less extra cardio, and strength-type activities replace a strength session.</p>';
  let form = `<button class="btn" data-action="toggleAddActivity" style="margin-top:8px">${icon('plus')}Add an activity you already do</button>`;
  if (showAddActivity && picked == null) {
    const inCat = (h) => pickCat === 'all' || (pickCat === 'pop' ? h.pop : h.cat === pickCat);
    const tabs = [['pop', 'Popular', HOBBIES.filter((h) => h.pop).length], ['all', 'All', HOBBIES.length], ...Object.entries(HOBBY_CATEGORIES).map(([k, l]) => [k, l, HOBBIES.filter((h) => h.cat === k).length])];
    form = `<div class="card flat" style="margin-top:10px">
      <div class="row between" style="margin-bottom:8px"><strong>What do you do?</strong><button class="btn ghost small" data-action="toggleAddActivity">Cancel</button></div>
      <input type="search" autocomplete="off" placeholder="Search all ${HOBBIES.length} — e.g. squash, gardening, scuba" data-filter="hobby" aria-label="Search activities" style="margin-bottom:10px">
      <div class="scroll-x" style="margin-bottom:10px">${tabs.map(([k, l, n]) => `<button type="button" class="qchip ${pickCat === k ? 'done' : ''}" style="padding-left:12px" data-action="hobbyCat" data-value="${k}" aria-pressed="${pickCat === k}">${esc(l)} <span class="muted">${n}</span></button>`).join('')}</div>
      <div class="hobby-grid" data-filter-target="hobby">${HOBBIES.map((h) => `<button type="button" class="hobby-btn" data-action="pickHobby" data-name="${esc(h.name)}" data-filter-text="${esc(h.name.toLowerCase())} ${esc(HOBBY_CATEGORIES[h.cat].toLowerCase())}"${inCat(h) ? '' : ' data-out="1" hidden'}><span>${esc(h.name)}</span><small class="int-${intensityFromMet(h.met)}">${INTENSITY[intensityFromMet(h.met)].label}${h.strength ? ' · strength' : ''}</small></button>`).join('')}
        <button type="button" class="hobby-btn custom" data-action="pickHobby" data-name="" data-filter-text="something else other custom"><span>${icon('plus')} Something else</span><small>Type your own</small></button></div>
    </div>`;
  } else if (showAddActivity) {
    const h = picked ? hobbyByName(picked) : null;
    const intensity = h ? intensityFromMet(h.met) : 'moderate';
    form = `<form data-form="addActivity" class="card flat" style="margin-top:10px">
        <button type="button" class="btn ghost small" data-action="repickHobby" style="margin:-4px 0 6px -8px">${icon('back')}All activities</button>
        <label class="field"><span>Activity</span><input type="text" name="name" maxlength="80" required value="${esc(h?.name || '')}" placeholder="e.g. Walking with friends" ${h ? '' : 'autofocus'}></label>
        ${h ? `<p class="muted" style="font-size:var(--text-xs);margin:-8px 0 12px">${h.est ? esc(h.note) : `≈ ${h.met} METs — 2024 Compendium of Physical Activities (${esc(h.code)})`}. Change anything that doesn’t match how you do it.</p>` : ''}
        <fieldset><legend>Which days?</legend>${chips('days', DAY_CHIPS, [])}</fieldset>
        <div class="grid two" style="margin-bottom:0">
          <label class="field"><span>How long?</span><div class="inline-inputs"><input type="number" name="minutes" min="5" max="600" step="5" value="${h?.minutes || 45}" required inputmode="numeric"><span class="unit">min</span></div></label>
          <label class="field"><span>How hard?</span><select name="intensity">${Object.entries(INTENSITY).map(([k, v]) => `<option value="${k}" ${k === intensity ? 'selected' : ''}>${v.label} — ${esc(v.hint)}</option>`).join('')}</select></label>
        </div>
        <label class="option" style="margin-bottom:12px"><input type="checkbox" name="strength" value="1" ${h?.strength ? 'checked' : ''}><div><strong>It builds strength</strong><small class="muted">Counts as one of your strength sessions.</small></div></label>
        <div class="row"><button class="btn primary">Add activity</button><button type="button" class="btn ghost" data-action="toggleAddActivity">Cancel</button></div>
      </form>`;
  }
  return `<div class="card" id="activities"><h2>Your regular activities</h2>${list}${form}</div>`;
}


function weekMinutes(state, wk) {
  let cardio = 0;
  let strength = 0;
  for (let i = 0; i < 7; i++) {
    for (const x of state.workouts.log[addDays(wk, i)] || []) {
      cardio += creditedMinutes(x);
      if (x.kind === 'strength') strength++;
    }
  }
  return { cardio: Math.round(cardio), strength };
}

function dose(ex) {
  const per = ex.perSide ? ' each side' : '';
  return ex.type === 'time' ? `${ex.sets} × ${ex.reps} sec${per}` : `${ex.sets} × ${ex.reps}${per}`;
}

function overview(state) {
  const date = store.today();
  const wk = weekStart(date);
  const { schedule, cardioMin, activityMin, strengthFromActivities } = store.schedule(state, date);
  const done = weekMinutes(state, wk);
  const strengthPlanned = schedule.reduce((a, d) => a + d.items.filter((i) => i.kind === 'strength').length, 0);
  const ti = dayIndex(date);
  const grid = weekOrder().map((i) => {
    const d = schedule[i];
    const dd = dateInWeek(wk, i);
    const logged = state.workouts.log[dd] || [];
    const pills = d.items.map((it) => {
      const isDone = itemDone(logged, it);
      if (it.kind === 'rest') return '<span class="pill rest">rest</span>';
      const text = it.kind === 'activity' ? esc(shortName(it.name)) : it.kind === 'strength' ? `Str ${it.variant}` : `${it.minutes}′ ${esc(it.mode)}`;
      // Tap to move it to another day this week.
      return `<button type="button" class="pill ${it.kind} ${isDone ? 'done' : ''} ${it.from != null ? 'moved' : ''}" data-action="openMoveItem" data-key="${esc(itemKey(it))}" data-from="${i}" data-date="${dd}" aria-label="Move ${esc(itemName(it))} (${d.name})">${text}</button>`;
    });
    return `<div class="d ${i === ti ? 'today' : ''}"><b>${d.name}</b>${pills.join('')}</div>`;
  });
  const today = schedule[ti];
  const prog = state.workouts.progress;
  return html`<header class="page-head"><div><div class="eyebrow">Week ${store.weeksSinceStart(state, date) + 1}</div><h1>Move</h1></div></header>
    <p class="muted" style="margin:-8px 0 14px">For health, mood and keeping weight off — not to earn food. Start low, go slow; the plan builds with you.</p>
    <a class="card cal-link" href="#/calendar"><span class="cal-emoji big" aria-hidden="true">📅</span><span class="grow"><strong>Calendar</strong><small>Set when and where, add walks and batch cooking, invite friends</small></span>${icon('chevron')}</a>
    <div class="grid two">
      <div class="card"><h2>Today</h2>${today.items.map((it) => {
        if (it.kind === 'rest') return '<p class="muted">Rest day — gentle walking is still great.</p>';
        if (it.kind === 'strength') return `<p><strong>Strength session ${it.variant}</strong> · ${it.exercises.length} exercises</p><a class="btn primary" href="#/move/session/${it.variant}">Start session</a>`;
        if (it.kind === 'activity') {
          const done = itemDone(state.workouts.log[date] || [], it);
          return `<div class="row between"><div><strong>${esc(it.name)}</strong><div class="muted" style="font-size:.88rem">${it.minutes} min · your regular activity</div></div>${done ? '<span class="tag green">done ✓</span>' : `<button class="btn small primary" data-action="activityDone" data-id="${esc(it.id)}">Done</button>`}</div>`;
        }
        return `<p><strong>${esc(CARDIO[it.mode].label)}</strong> · ${it.minutes} min</p><p class="muted" style="font-size:.88rem">${esc(CARDIO[it.mode].how)}</p>`;
      }).join('')}</div>
      <div class="card"><h2>This week</h2>
        <div class="macro"><span>Cardio</span>${progressBar(done.cardio, cardioMin, { label: 'Cardio minutes' })}<span>${done.cardio}/${cardioMin} min</span></div>
        <div class="macro"><span>Strength</span>${progressBar(done.strength, strengthPlanned, { label: 'Strength sessions' })}<span>${done.strength}/${strengthPlanned}</span></div>
        <p class="muted" style="font-size:.86rem;margin-top:8px">Target grows ~10% a week toward 150+ min.${activityMin ? ` Your regular activities cover about ${activityMin} min of it${strengthFromActivities ? ` and ${strengthFromActivities} strength session${strengthFromActivities > 1 ? 's' : ''}` : ''}.` : ''}</p>
      </div>
    </div>
    <div class="card"><h2>Week plan</h2><div class="week">${grid.join('')}</div>
      <p class="muted" style="font-size:.84rem;margin:8px 0 0">One main thing per day: your own activities, a strength session or a cardio session. <strong>Tap one to move it to another day.</strong></p></div>
    ${activitiesCard(state)}
    <div class="card"><div class="card-head"><h2>Log activity</h2></div>
      <form data-form="logCardio" class="row">
        <select name="mode" aria-label="Activity" style="flex:1;min-width:150px" data-change="logMode">${Object.entries(CARDIO).map(([k, c]) => `<option value="${k}">${esc(c.label)}</option>`).join('')}${(state.profile.activities || []).map((a) => `<option value="act:${esc(a.id)}" ${logOther === 'act:' + a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}<option value="other" ${logOther === 'other' ? 'selected' : ''}>Something else…</option></select>
        ${logOther === 'other' ? `<span class="suggest-wrap" style="flex:1;min-width:150px"><input type="text" name="name" aria-label="What was it?" maxlength="80" required placeholder="What was it?" autocomplete="off" data-hobby-suggest><span class="hobby-suggest" role="listbox" aria-label="Suggestions"></span></span><select name="intensity" style="width:130px">${Object.entries(INTENSITY).map(([k, v]) => `<option value="${k}" ${k === 'moderate' ? 'selected' : ''}>${v.label}</option>`).join('')}</select>` : ''}
        <input type="number" name="minutes" aria-label="Minutes" min="1" max="300" placeholder="minutes" required style="width:110px" inputmode="numeric">
        <input type="date" name="date" aria-label="Date" value="${date}" max="${date}" style="width:160px">
        <button class="btn primary">Log</button>
      </form></div>
    <details class="card"><summary class="row nowrap" style="cursor:pointer;list-style:none"><span class="slot-ico" style="background:var(--accent-soft);color:var(--accent)">${icon('progress')}</span><span class="grow"><strong>Your strength levels</strong><span style="display:block;font-size:var(--text-sm);color:var(--ink-3)">Each exercise levels up when it feels easy</span></span>${icon('chevron')}</summary><p class="muted" style="font-size:.88rem;margin-top:12px">Each movement moves up a level when it feels easy, and back down if it’s too hard or hurts.</p><div style="overflow-x:auto">
      <table class="simple"><tr><th>Movement</th><th>Current exercise</th><th class="right">Dose</th></tr>
      ${Object.entries(prog).map(([k, st]) => {
        const s = stepOf(k, st.stepId);
        return s ? `<tr><td>${esc(CHAINS[k].label)}</td><td>${esc(s.name)}${st.painFlag ? ' <span class="tag warm">eased back</span>' : ''}</td><td class="right">${dose({ ...s, sets: st.sets, reps: st.reps })}</td></tr>` : '';
      }).join('')}</table></div>
      <p class="muted" style="font-size:.85rem;margin-top:8px">Equipment, joints and days are in <a href="#/settings">Settings</a>.</p></details>
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
      const date = validLogDate(data.date) ? data.date : logDate();
      let entry = { kind: 'cardio', mode: data.mode, minutes };
      if (data.mode === 'other') {
        const h = hobbyByName(data.name);
        // A catalogue match brings its Compendium intensity unless the person picked something else.
        const intensity = h && (data.intensity || 'moderate') === 'moderate' ? intensityFromMet(h.met) : data.intensity || 'moderate';
        entry = { kind: 'activity', name: (data.name || 'Activity').trim().slice(0, 40), intensity, minutes };
      }
      else if (data.mode?.startsWith('act:')) {
        const a = (ctx.state.profile.activities || []).find((x) => 'act:' + x.id === data.mode);
        if (a) entry = { kind: 'activity', actId: a.id, name: a.name, intensity: a.intensity, minutes };
      }
      logOther = false;
      ctx.update((st) => {
        st.workouts.log[date] = [...(st.workouts.log[date] || []), entry];
        return st;
      });
      ctx.toast(`${minutes} minutes logged.`);
    },
    pickSuggest(el) {
      const input = el.closest('.suggest-wrap').querySelector('input');
      input.value = el.dataset.v;
      el.parentElement.innerHTML = '';
      input.focus();
    },
    logMode(el, ev, ctx) {
      const v = el.value;
      const next = v === 'other' ? 'other' : v.startsWith('act:') ? v : false;
      if (next !== logOther) {
        logOther = next;
        ctx.rerender();
      }
    },
    toggleAddActivity(el, ev, ctx) {
      showAddActivity = !showAddActivity;
      picked = null;
      ctx.rerender();
      if (showAddActivity) document.querySelector('[data-filter=hobby]')?.focus({ preventScroll: true });
    },
    hobbyCat(el, ev, ctx) {
      pickCat = el.dataset.value;
      ctx.rerender();
    },
    pickHobby(el, ev, ctx) {
      picked = el.dataset.name;
      ctx.rerender();
      document.getElementById('activities')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    repickHobby(el, ev, ctx) {
      picked = null;
      ctx.rerender();
    },
    addActivity(form, ev, ctx, data) {
      const days = (data.days || []).map(Number);
      if (!days.length) return ctx.toast('Pick at least one day.');
      const name = (data.name || '').trim();
      if (!name) return;
      showAddActivity = false;
      picked = null;
      ctx.update((st) => {
        const list = st.profile.activities || [];
        const id = 'a' + Date.now().toString(36);
        st.profile.activities = [...list, { id, name: name.slice(0, 40), days, minutes: Math.max(5, Math.min(600, Number(data.minutes) || 30)), intensity: data.intensity || 'moderate', strength: !!data.strength }].slice(0, 12);
        return st;
      });
      ctx.toast('Added — your week plan now counts it.');
    },
    async removeActivity(el, ev, ctx) {
      const a = (ctx.state.profile.activities || []).find((x) => x.id === el.dataset.id);
      if (!a || !(await ctx.confirm(`Remove “${a.name}” from your regular activities? Past logs are kept.`, { ok: 'Remove' }))) return;
      ctx.update((st) => {
        st.profile.activities = (st.profile.activities || []).filter((x) => x.id !== a.id);
        return st;
      });
    },
    activityDone(el, ev, ctx) {
      logPlannedActivity(ctx, el.dataset.id);
    },
  },
};
void REP_RANGE;

// Suggestions for "Something else…" — our own list instead of the phone's autocomplete pop-up,
// which Android's in-app browser draws see-through.
document.addEventListener('input', (ev) => {
  if (!ev.target.matches?.('[data-hobby-suggest]')) return;
  const box = ev.target.parentElement.querySelector('.hobby-suggest');
  const q = ev.target.value.trim().toLowerCase();
  const hits = q.length < 2 ? [] : HOBBIES.filter((h) => h.name.toLowerCase().includes(q)).sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q))).slice(0, 6);
  box.innerHTML = hits.map((h) => `<button type="button" role="option" data-action="pickSuggest" data-v="${esc(h.name)}">${esc(h.name)}</button>`).join('');
});

/** A planned regular activity is done: ask how long and how hard (shared with the Today screen). */
export function logPlannedActivity(ctx, id) {
  askActivity(ctx, id);
}
