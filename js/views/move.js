// Movement: the week's schedule, strength session player with feedback, cardio logging.
import { html, esc, icon, progressBar, fmtNum } from '../ui/dom.js';
import * as store from '../store.js';
import { logDate, validLogDate } from '../viewdate.js';
import { progressChain, stepOf, stepGoal, REP_RANGE, INTENSITY, creditedMinutes } from '../engine/workouts.js';
import { chips } from '../ui/dom.js';
import { HOBBIES, HOBBY_CATEGORIES, intensityFromMet, hobbyByName, hobbySearchText, searchHobbies } from '../data/hobbies.js';
import { CARDIO, WARMUP, COOLDOWN, CHAINS } from '../data/exercises.js';
import { STOP_SIGNS } from '../engine/safety.js';
import { addDays, weekStart, weekOrder, dateInWeek, dayChoices, DAY_SHORT } from '../engine/util.js';
import { dayIndex } from './shared.js';
import { askActivity, itemName, planEmoji } from './planmove.js';
import { itemKey } from '../engine/workouts.js';
import { chime, buzz } from '../ui/celebrate.js';

let ratings = {}; // chainKey -> rating, for the session in progress

// ---------- set timer: one timer at a time, in a slim bar at the bottom ----------
// Timed exercises count down their seconds (both sides when per side), then rest; rep exercises
// start the rest when you tap "Set done". Times are end timestamps, so a dimmed screen stays accurate.
const loadRest = () => {
  try {
    return Math.min(180, Math.max(15, Number(localStorage.getItem('habitlab.rest')) || 60));
  } catch (e) {
    return 60;
  }
};
let setsDone = {}; // exercise index -> sets finished, for the session in progress
// Warm-up and cool-down: tick each step, or say you did it all / skipped it — so it isn't silently missed.
let routine = { warm: { done: new Set(), skipped: false }, cool: { done: new Set(), skipped: false } };
const ROUTINE = { warm: () => WARMUP, cool: () => COOLDOWN };
/** 'done' | 'some' | 'skipped' | '' for a part, from what you ticked. */
function routineStatus(part) {
  const r = routine[part];
  const n = ROUTINE[part]().length;
  if (r.skipped) return 'skipped';
  return r.done.size >= n ? 'done' : r.done.size ? 'some' : '';
}
function routineCard(part, title) {
  const r = routine[part];
  const items = ROUTINE[part]();
  const st = routineStatus(part);
  const tag = st === 'done' ? '<span class="tag green">✓ Did it</span>' : st === 'some' ? `<span class="tag">Did some · ${r.done.size}/${items.length}</span>` : st === 'skipped' ? '<span class="tag">Skipped</span>' : '';
  return `<div class="card routine ${st}"><div class="row between nowrap"><h3 style="margin:0">${title}</h3>${tag}</div>
    <ul class="routine-list">${items.map((w, i) => `<li><button type="button" class="routine-item ${r.done.has(i) ? 'on' : ''}" data-action="routineTick" data-part="${part}" data-i="${i}" aria-pressed="${r.done.has(i)}"><span class="routine-check" aria-hidden="true">${r.done.has(i) ? '✓' : ''}</span><span>${esc(w)}</span></button></li>`).join('')}</ul>
    ${st === 'done' ? '' : `<div class="routine-actions"><button type="button" class="btn small" data-action="routineAll" data-part="${part}">✓ Did it all</button><button type="button" class="btn small ghost ${r.skipped ? 'on' : ''}" data-action="routineSkip" data-part="${part}" aria-pressed="${r.skipped}">${r.skipped ? 'Skipped' : 'Skip'}</button></div>`}</div>`;
}
let sessionKey = '';
let timer = null; // { i, phase: 'work' | 'rest' | 'ready', end, total, half? }
let timerTick = null;
let exList = []; // the session's exercises, for labels in the bar
let restSec = null;

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const workSecs = (ex) => Number(ex.reps) * (ex.perSide ? 2 : 1);

function barHtml() {
  if (!timer) return '';
  const ex = exList[timer.i];
  if (!ex) return '';
  const n = (setsDone[timer.i] || 0) + (timer.phase === 'work' ? 1 : 0);
  const left = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
  const label = timer.phase === 'work' ? `${esc(ex.name)} · set ${n} of ${ex.sets}${ex.perSide ? (left > workSecs(ex) / 2 ? ' · first side' : ' · other side') : ''}`
    : timer.phase === 'rest' ? `Rest · next: set ${(setsDone[timer.i] || 0) + 1} of ${esc(ex.name)}` : `Ready · set ${(setsDone[timer.i] || 0) + 1} of ${esc(ex.name)}`;
  const pct = timer.phase === 'ready' ? 100 : Math.min(100, (1 - left / timer.total) * 100);
  return `<div class="set-timer ${timer.phase}" role="timer" aria-label="${timer.phase === 'rest' ? 'Rest timer' : 'Set timer'}">
    <div class="st-top"><span class="st-label">${label}</span><button class="st-x" data-action="timerStop" aria-label="Stop timer">${icon('x')}</button></div>
    <div class="st-main"><b class="st-clock">${timer.phase === 'ready' ? 'Go' : mmss(left)}</b>
      ${timer.phase === 'rest' ? `<button class="btn small ghost" data-action="timerAdd" data-s="-15" aria-label="15 seconds less">−15</button><button class="btn small ghost" data-action="timerAdd" data-s="15" aria-label="15 seconds more">+15</button><button class="btn small" data-action="timerSkip">Skip</button>`
        : timer.phase === 'ready' ? `<button class="btn small primary" data-action="setStart" data-i="${timer.i}">▶ Start ${ex.reps} s</button>` : `<button class="btn small" data-action="timerSkip">Done</button>`}</div>
    <span class="st-bar"><span style="width:${pct.toFixed(1)}%"></span></span></div>`;
}

function paintBar() {
  const slot = document.getElementById('set-timer-slot');
  if (slot) slot.innerHTML = barHtml();
}

function setRow(ex, i) {
  const done = setsDone[i] || 0;
  const dots = Array.from({ length: ex.sets }, (_, k) => `<span class="st-dot ${k < done ? 'on' : ''}"></span>`).join('');
  const running = timer && timer.i === i && timer.phase !== 'ready';
  const btn = done >= ex.sets ? '<span class="tag green">✓ All sets</span>'
    : running ? `<span class="muted st-now">${timer.phase === 'rest' ? 'Resting…' : 'Timing…'}</span>`
    : ex.type === 'time' ? `<button class="btn small primary" data-action="setStart" data-i="${i}">▶ Set ${done + 1} · ${ex.reps} s${ex.perSide ? ' each side' : ''}</button>`
    : `<button class="btn small primary" data-action="setDone" data-i="${i}">✓ Set ${done + 1} done</button>`;
  return `<div class="set-row" aria-label="Sets: ${done} of ${ex.sets} done"><span class="st-dots" aria-hidden="true">${dots}</span>${btn}</div>`;
}

function tick(ctx) {
  if (!timer || timer.phase === 'ready') return;
  if (!location.hash.startsWith('#/move/session')) {
    // Left the session: stop quietly rather than chiming on another screen.
    timer = null;
    clearInterval(timerTick);
    return;
  }
  if (timer.half && Date.now() >= timer.half) {
    timer.half = null; // halfway on a per-side hold: switch sides
    chime('tick');
    buzz(60);
  }
  if (Date.now() < timer.end) return paintBar();
  finishPhase(ctx);
}

function startTimer(ctx, t) {
  timer = t;
  clearInterval(timerTick);
  timerTick = setInterval(() => tick(ctx), 250);
  ctx.rerender();
}

function finishPhase(ctx) {
  const ex = exList[timer.i];
  chime('tick');
  buzz([120, 80, 120]);
  if (timer.phase === 'work') {
    setsDone[timer.i] = (setsDone[timer.i] || 0) + 1;
    return afterSet(ctx, timer.i);
  }
  // Rest over: a timed exercise waits for you to start the next set; reps just carry on.
  clearInterval(timerTick);
  timer = ex.type === 'time' ? { i: timer.i, phase: 'ready', end: Date.now(), total: 1 } : null;
  ctx.rerender();
}

function afterSet(ctx, i) {
  const ex = exList[i];
  if ((setsDone[i] || 0) >= ex.sets) {
    // Last set of this exercise: no rest needed, on to the next one.
    timer = null;
    clearInterval(timerTick);
    ctx.rerender();
    return;
  }
  restSec ??= loadRest();
  startTimer(ctx, { i, phase: 'rest', end: Date.now() + restSec * 1000, total: restSec });
}
let showAddActivity = false;
let pickCat = 'pop';
let picked = null; // hobby name, or '' for a custom activity
let logOther = false;
const ACTIVITY_IDEAS = ['Walking with friends', 'Dog walk', 'Football', 'Dancing', 'Swimming', 'Cycling to work', 'Gardening', 'Yoga class', 'Climbing', 'Tennis / padel', 'Gym class', 'Hiking'];


/** Was this planned item logged on that day? */
export function itemDone(logged, it) {
  if (it.kind === 'activity') return logged.some((x) => x.kind === 'activity' && x.actId === it.id);
  return logged.some((x) => x.kind === it.kind);
}

function activitiesCard(state) {
  const acts = state.profile.activities || [];
  const list = acts.length
    ? `<ul class="list">${acts.map((a) => `<li class="row between nowrap"><div class="grow"><strong>${esc(a.name)}</strong><div class="muted" style="font-size:.86rem">${[...a.days].sort((x, y) => weekOrder().indexOf(x) - weekOrder().indexOf(y)).map((d) => DAY_SHORT[d]).join(', ')} · ${a.minutes} min · ${esc(INTENSITY[a.intensity].label.toLowerCase())}${a.strength ? ' · builds strength' : ''}</div></div><button class="btn small ghost danger" data-action="removeActivity" data-id="${esc(a.id)}" aria-label="Remove ${esc(a.name)}">${icon('trash')}</button></li>`).join('')}</ul>`
    : '<p class="muted" style="font-size:.9rem">Already walk with friends, play a sport, dance or garden? Add it and your plan counts it — you’ll get less extra cardio, and strength-type activities replace a strength session.</p>';
  let form = `<button class="btn" data-action="toggleAddActivity" style="margin-top:8px">${icon('plus')}Add an activity you already do</button>`;
  if (showAddActivity && picked == null) {
    const inCat = (h) => pickCat === 'all' || (pickCat === 'pop' ? h.pop : h.cat === pickCat);
    const tabs = [['pop', 'Popular', HOBBIES.filter((h) => h.pop).length], ['all', 'All', HOBBIES.length], ...Object.entries(HOBBY_CATEGORIES).map(([k, l]) => [k, l, HOBBIES.filter((h) => h.cat === k).length])];
    form = `<div class="card flat" style="margin-top:10px">
      <div class="row between" style="margin-bottom:8px"><strong>What do you do?</strong><button class="btn ghost small" data-action="toggleAddActivity">Cancel</button></div>
      <input type="search" autocomplete="off" placeholder="Search all ${HOBBIES.length} — e.g. cardio, squash, gardening" data-filter="hobby" aria-label="Search activities" style="margin-bottom:10px">
      <div class="scroll-x" style="margin-bottom:10px">${tabs.map(([k, l, n]) => `<button type="button" class="qchip ${pickCat === k ? 'done' : ''}" style="padding-left:12px" data-action="hobbyCat" data-value="${k}" aria-pressed="${pickCat === k}">${esc(l)} <span class="muted">${n}</span></button>`).join('')}</div>
      <div class="hobby-grid" data-filter-target="hobby">${HOBBIES.map((h) => `<button type="button" class="hobby-btn" data-action="pickHobby" data-name="${esc(h.name)}" data-filter-text="${esc(hobbySearchText(h))}"${inCat(h) ? '' : ' data-out="1" hidden'}><span>${esc(h.name)}</span><small class="int-${intensityFromMet(h.met)}">${INTENSITY[intensityFromMet(h.met)].label}${h.strength ? ' · strength' : ''}</small></button>`).join('')}
        <button type="button" class="hobby-btn custom" data-action="pickHobby" data-name="" data-filter-text="something else other custom"><span>${icon('plus')} Something else</span><small>Type your own</small></button></div>
    </div>`;
  } else if (showAddActivity) {
    const h = picked ? hobbyByName(picked) : null;
    const intensity = h ? intensityFromMet(h.met) : 'moderate';
    form = `<form data-form="addActivity" class="card flat" style="margin-top:10px">
        <button type="button" class="btn ghost small" data-action="repickHobby" style="margin:-4px 0 6px -8px">${icon('back')}All activities</button>
        <label class="field"><span>Activity</span><input type="text" name="name" maxlength="80" required value="${esc(h?.name || '')}" placeholder="e.g. Walking with friends" ${h ? '' : 'autofocus'}></label>
        ${h ? `<p class="muted" style="font-size:var(--text-xs);margin:-8px 0 12px">${h.est ? esc(h.note) : `≈ ${h.met} METs — 2024 Compendium of Physical Activities (${esc(h.code)})`}. Change anything that doesn’t match how you do it.</p>` : ''}
        <fieldset><legend>Which days?</legend>${chips('days', dayChoices(), [])}</fieldset>
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

/**
 * This week's planned sessions as one list: each with Start (strength) or Done, and Move.
 * What you logged anywhere this week ticks them off — Saturday's Strength A done on Friday counts.
 */
function weekSessions(state, wk, schedule, ti) {
  const logs = [];
  for (let i = 0; i < 7; i++) for (const x of state.workouts.log[addDays(wk, i)] || []) logs.push(x);
  const used = new Set();
  const take = (match) => {
    const k = logs.findIndex((x, n) => !used.has(n) && match(x));
    if (k < 0) return null;
    used.add(k);
    return logs[k];
  };
  const rows = [];
  for (const i of weekOrder()) {
    for (const it of schedule[i].items) {
      if (it.kind === 'rest') continue;
      const done = take(it.kind === 'strength' ? (x) => x.kind === 'strength' && x.variant === it.variant : it.kind === 'activity' ? (x) => x.kind === 'activity' && x.actId === it.id : (x) => x.kind === 'cardio');
      const day = i === ti ? 'Today' : schedule[i].name;
      const name = it.kind === 'strength' ? `Strength session ${it.variant}` : it.kind === 'activity' ? it.name : `${CARDIO[it.mode]?.label || 'Cardio'}`;
      const sub = it.kind === 'strength' ? `${it.exercises.length} exercises · about ${it.minutes} min` : `${it.minutes} min${it.kind === 'activity' ? ' · your regular activity' : ''}`;
      const go = done ? `<span class="tag green">${icon('check')}Done</span>`
        : it.kind === 'strength' ? `<a class="btn small primary" href="#/move/session/${it.variant}">Start</a>`
        : it.kind === 'activity' ? `<button class="btn small primary" data-action="activityDone" data-id="${esc(it.id)}">Done</button>`
        : `<button class="btn small primary" data-action="cardioDone" data-mode="${esc(it.mode)}" data-min="${it.minutes}">Done</button>`;
      rows.push(`<li class="session-row ${done ? 'is-done' : ''} ${i === ti ? 'today' : ''}"><span class="cal-emoji" aria-hidden="true">${planEmoji(it)}</span>
        <div class="grow"><strong>${esc(name)}</strong><small class="muted">${esc(day)}${it.from != null ? ' · moved' : ''} · ${esc(sub)}</small></div>
        ${go}${`<button class="btn small ghost" data-action="openMoveItem" data-key="${esc(itemKey(it))}" data-from="${i}" data-date="${dateInWeek(wk, i)}" aria-label="Move ${esc(name)} to another day">Move</button>`}</li>`);
    }
  }
  return rows.join('') || '<li class="muted" style="padding:8px 0">Nothing planned this week — add a walk in the calendar.</li>';
}

function overview(state) {
  const date = store.today();
  const wk = weekStart(date);
  const { schedule, cardioMin, activityMin, strengthFromActivities } = store.schedule(state, date);
  const done = weekMinutes(state, wk);
  const strengthPlanned = schedule.reduce((a, d) => a + d.items.filter((i) => i.kind === 'strength').length, 0);
  const ti = dayIndex(date);
  const sessions = weekSessions(state, wk, schedule, ti);
  const prog = state.workouts.progress;
  return html`<header class="page-head"><div><div class="eyebrow">Week ${store.weeksSinceStart(state, date) + 1}</div><h1>Move</h1></div></header>
    <p class="muted" style="margin:-8px 0 14px">For health, mood and keeping weight off — not to earn food. Start low, go slow; the plan builds with you.</p>
    <a class="card cal-link" href="#/calendar"><span class="cal-emoji big" aria-hidden="true">📅</span><span class="grow"><strong>Calendar</strong><small>Set when and where, add walks and batch cooking, invite friends</small></span>${icon('chevron')}</a>
    <div class="card"><h2 style="margin:0">This week’s sessions</h2>
      ${schedule[ti].items.every((it) => it.kind === 'rest') ? '<p class="muted" style="margin:6px 0 0">Today is a rest day — gentle walking is still great. You can still do any session below today.</p>' : ''}
      <ul class="session-list">${sessions}</ul>
      <p class="muted" style="font-size:.84rem;margin:8px 0 0">Do a session on any day — it counts wherever it was planned. Set times and places in the calendar.</p></div>
    <div class="card"><h2>This week</h2>
        <div class="macro"><span>Cardio</span>${progressBar(done.cardio, cardioMin, { label: 'Cardio minutes' })}<span>${done.cardio}/${cardioMin} min</span></div>
        <div class="macro"><span>Strength</span>${progressBar(done.strength, strengthPlanned, { label: 'Strength sessions' })}<span>${done.strength}/${strengthPlanned}</span></div>
        <p class="muted" style="font-size:.86rem;margin-top:8px">Target grows ~10% a week toward 150+ min.${activityMin ? ` Your regular activities cover about ${activityMin} min of it${strengthFromActivities ? ` and ${strengthFromActivities} strength session${strengthFromActivities > 1 ? 's' : ''}` : ''}.` : ''}</p>
    </div>
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
  if (sessionKey !== `${date}|${variant}`) {
    sessionKey = `${date}|${variant}`;
    setsDone = {};
    routine = { warm: { done: new Set(), skipped: false }, cool: { done: new Set(), skipped: false } };
    timer = null;
    clearInterval(timerTick);
  }
  exList = item.exercises;
  const rateBtn = (chain, value, label) => `<button type="button" class="btn small ${ratings[chain] === value ? 'on' : ''}" data-action="rate" data-chain="${chain}" data-value="${value}" aria-pressed="${ratings[chain] === value}">${label}</button>`;
  return html`<a href="#/move" class="btn ghost small">${icon('back')}Move</a>
    <h1>Strength session ${esc(variant)}</h1>
    <p class="muted">Move slowly and with control; breathe out as you push. Stop 2–3 reps before you can’t do any more. Tap each set as you go — a rest timer starts between sets.</p>
    ${routineCard('warm', 'Warm-up (5 min)')}
    ${item.exercises.map((ex, i) => `<div class="exercise"><div class="row between"><h3 style="margin:0">${i + 1}. ${esc(ex.name)}</h3><span class="dose">${dose(ex)}</span></div>
      <p>${esc(ex.how)}</p>
      ${setRow(ex, i)}
      <div class="field-label" style="font-size:.85rem">How did it feel?</div>
      <div class="rate">${rateBtn(ex.chain, 'easy', 'Too easy')}${rateBtn(ex.chain, 'right', 'Just right')}${rateBtn(ex.chain, 'hard', 'Too hard')}${rateBtn(ex.chain, 'pain', 'It hurt')}</div></div>`)}
    ${routineCard('cool', 'Cool-down & stretch')}
    <div class="row" style="margin:14px 0"><button class="btn primary" data-action="finish" data-variant="${esc(variant)}">${icon('check')}Finish session</button><span class="muted" style="font-size:.86rem">Unrated exercises count as “just right”.</span></div>
    ${stopSigns()}
    <div id="set-timer-slot">${barHtml()}</div>`;
}

export default {
  render(state, params) {
    if (params[0] === 'session') return session(state, params[1] || 'A');
    ratings = {};
    return overview(state);
  },
  actions: {
    routineTick(el, ev, ctx) {
      const r = routine[el.dataset.part];
      if (!r) return;
      const i = Number(el.dataset.i);
      if (r.done.has(i)) r.done.delete(i);
      else r.done.add(i);
      r.skipped = false;
      buzz(10);
      ctx.rerender();
    },
    routineAll(el, ev, ctx) {
      const r = routine[el.dataset.part];
      if (!r) return;
      r.done = new Set(ROUTINE[el.dataset.part]().map((_, i) => i));
      r.skipped = false;
      buzz(15);
      ctx.rerender();
    },
    routineSkip(el, ev, ctx) {
      const r = routine[el.dataset.part];
      if (!r) return;
      r.skipped = !r.skipped;
      if (r.skipped) r.done = new Set();
      ctx.rerender();
    },
    setStart(el, ev, ctx) {
      const i = Number(el.dataset.i);
      const ex = exList[i];
      if (!ex) return;
      const secs = workSecs(ex);
      startTimer(ctx, { i, phase: 'work', end: Date.now() + secs * 1000, total: secs, half: ex.perSide ? Date.now() + (secs / 2) * 1000 : null });
    },
    setDone(el, ev, ctx) {
      const i = Number(el.dataset.i);
      if (!exList[i]) return;
      setsDone[i] = Math.min(exList[i].sets, (setsDone[i] || 0) + 1);
      buzz(15);
      afterSet(ctx, i);
    },
    timerSkip(el, ev, ctx) {
      if (!timer) return;
      timer.end = Date.now();
      finishPhase(ctx);
    },
    timerAdd(el, ev, ctx) {
      if (!timer || timer.phase !== 'rest') return;
      const d = Number(el.dataset.s) || 0;
      timer.end = Math.max(Date.now() + 5000, timer.end + d * 1000);
      timer.total = Math.max(15, timer.total + d);
      restSec = Math.min(180, Math.max(15, (restSec ?? loadRest()) + d)); // remembered for next time
      try {
        localStorage.setItem('habitlab.rest', String(restSec));
      } catch (e) {
        /* private mode */
      }
      paintBar();
    },
    timerStop(el, ev, ctx) {
      timer = null;
      clearInterval(timerTick);
      ctx.rerender();
    },
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
        const warmup = routineStatus('warm');
        const cooldown = routineStatus('cool');
        st.workouts.log[date] = [...(st.workouts.log[date] || []), { kind: 'strength', variant, ratings: { ...ratings }, minutes: item.minutes, ...(warmup ? { warmup } : {}), ...(cooldown ? { cooldown } : {}) }];
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

// Searching the activity picker: show the best matches first ("cardio" → Cardio, then the
// cardio levels and machines) instead of catalogue order. Hiding is done by the shared filter.
document.addEventListener('input', (ev) => {
  if (!ev.target.matches?.('input[data-filter=hobby]')) return;
  const rank = new Map(searchHobbies(ev.target.value, HOBBIES.length).map((h, i) => [h.name, i]));
  for (const el of document.querySelectorAll('[data-filter-target=hobby] .hobby-btn[data-name]')) el.style.order = !rank.size ? '' : rank.has(el.dataset.name) ? String(rank.get(el.dataset.name)) : '9999'; // "Something else" stays last
});

// Suggestions for "Something else…" — our own list instead of the phone's autocomplete pop-up,
// which Android's in-app browser draws see-through.
document.addEventListener('input', (ev) => {
  if (!ev.target.matches?.('[data-hobby-suggest]')) return;
  const box = ev.target.parentElement.querySelector('.hobby-suggest');
  const q = ev.target.value.trim().toLowerCase();
  const hits = searchHobbies(q, 6);
  box.innerHTML = hits.map((h) => `<button type="button" role="option" data-action="pickSuggest" data-v="${esc(h.name)}">${esc(h.name)}</button>`).join('');
});

/** A planned regular activity is done: ask how long and how hard (shared with the Today screen). */
export function logPlannedActivity(ctx, id) {
  askActivity(ctx, id);
}
