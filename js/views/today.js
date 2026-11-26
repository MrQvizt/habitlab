// Today: progress hero, one "next up" action, then food, habits and movement as tappable rows.
// Details and logging choices live in bottom sheets (js/views/sheets.js); quick ticks offer Undo.
import { esc, icon, fmtKg, fmtWeight, fmtDelta, fmtNum, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { mealsFor, eatenSoFar, proteinEaten, dayComplete, safetyNotices, checkinDue, slotLabel, computeIntake } from './shared.js';
import { byId } from '../engine/meals.js';
import { habitById, streak, habitLevels, levelIndex } from '../engine/habits.js';
import { stepGoal } from '../engine/workouts.js';
import { CARDIO } from '../data/exercises.js';
import { daysBetween } from '../engine/util.js';
import { toHHMM } from '../engine/schedule.js';
import { itemDone, logPlannedActivity } from './move.js';
import { toggleHabit, mealRowList } from './sheets.js';
import { planDay, partOf, PARTS } from '../engine/dayplan.js';
import { dayRings, ringsSvg, RING_META } from './dayrings.js';
import { journey, nextStops, recentTimeStop } from '../engine/journey.js';
import { whenLabel } from './journey.js';
import { wrapReadyCard, bodyRingsCard } from './wrap.js';

// ---------- Journey: the next stop on the long road (or a time stop just reached) ----------
function journeyCard(state, date) {
  const p = state.profile;
  if (p.phase === 'maintain') return '';
  const u = p.units === 'imperial' ? 'imperial' : 'metric';
  const hide = store.habitsOnly(state);
  const j = journey(state, { today: date, trendKg: store.trendWeight(state) });
  const just = recentTimeStop(j, date);
  const n = nextStops(j);
  const next = hide ? n.time : n.weight || n.time;
  if (!just && !next) return '';
  const body = just
    ? `<span class="eyebrow">${icon('star')} ${esc(just.title)}</span><strong>${esc(just.text)}</strong>${!hide && just.scale ? `<span class="sub">${esc(just.scale)}</span>` : ''}`
    : `<span class="eyebrow">${icon('flag')} Next stop · ${esc(whenLabel(next, date))}</span><strong>${esc(next.title)}${!hide && next.kind !== 'time' ? ` — ${fmtKg(Math.max(0, j.now - next.weightKg), u)} to go` : ''}</strong>${!hide && j.goalKg ? `<span class="bar" style="margin-top:8px"><span style="width:${Math.max(1.5, j.pct).toFixed(1)}%"></span></span><span class="sub">${fmtKg(j.lost, u)} down · ${j.pct.toFixed(0)}% of the way to ${fmtKg(j.goalKg, u)}</span>` : ''}${next !== n.time && n.time && n.time.date < (next.date || '9999') ? `<span class="sub">Before that: <strong style="font-size:inherit;color:var(--ink-2)">${esc(n.time.title)}</strong> · ${esc(whenLabel(n.time, date).split(' · ')[1] || '')}</span>` : ''}`;
  return `<a class="card journey-next" href="#/journey">${body}<span class="more">Your journey ${icon('chevron')}</span></a>`;
}

const SLOT_HOUR = { breakfast: 7, snack: 10, lunch: 12, snack2: 15, dinner: 18, snack3: 20 };

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// ---------- Hero: today's three rings + XP + streak ----------
function hero(state, date) {
  const g = store.game(state);
  const r = dayRings(state, date);
  const closed = Object.values(r).filter((x) => x.closed).length;
  const title = closed === 3 ? 'All rings closed!' : closed === 0 ? 'Close your three rings' : `${3 - closed} ring${3 - closed > 1 ? 's' : ''} to go`;
  const sub = closed === 3 ? 'A perfect day. This is what consistency looks like.' : 'Tick things off as your day happens.';
  const leg = Object.entries(r).map(([k, x]) => `<li class="ring-leg ${x.closed ? 'closed' : ''}"><span class="rdot" style="background:${RING_META[k].color}"></span><span class="rl">${RING_META[k].label}</span><span class="rv">${x.closed ? '✓ ' : ''}${esc(x.text)}</span></li>`).join('');
  return `<section class="hero-today rings-hero ${closed === 3 ? 'perfect' : ''}" aria-label="Today's rings: ${Object.entries(r).map(([k, x]) => `${RING_META[k].label} ${Math.round(x.pct * 100)}%`).join(', ')}">
    <div class="hero-top">
      <a class="rings-wrap" href="#/rewards" aria-label="Rewards and quests">${ringsSvg(r)}<span class="rings-center">${closed}<small>/3</small></span></a>
      <div class="hero-meta"><h2>${title}</h2><p class="hero-sub">${sub}</p><ul class="ring-legend">${leg}</ul></div>
    </div>
    <div class="hero-pills">
      <a class="pill-stat streak" href="#/rewards">${icon('flame')}${g.streak}-day streak</a>
      <a class="pill-stat xp" href="#/rewards">${icon('star')}${g.todayXp} XP today</a>
      <a class="pill-stat" href="#/rewards">Level ${g.level}</a>
    </div>
  </section>`;
}

// ---------- Quick log: the four things people log most, one tap away ----------
function quickLog(state) {
  const hide = store.habitsOnly(state);
  const b = (action, ic, label, extra = '') => `<button class="ql-btn" data-action="${action}" ${extra}><span class="ql-ico">${icon(ic)}</span>${label}</button>`;
  return `<div class="quick-log" role="group" aria-label="Quick log">
    ${b('openExtra', 'plus', 'Food')}
    ${hide ? '' : b('openWeigh', 'scale', 'Weight')}
    ${b('openSteps', 'progress', 'Steps')}
    <a class="ql-btn" href="#/move"><span class="ql-ico">${icon('move')}</span>Workout</a>
  </div>`;
}

// ---------- Next up: the single most useful thing to do now ----------
function nextUp(state, date) {
  const h = new Date().getHours();
  const hide = store.habitsOnly(state);
  const log = state.mealLog[date] || {};
  const meals = mealsFor(state, date);
  const card = (eyebrow, t, s, btn, done = false) => `<section class="next-card ${done ? 'done' : ''}" aria-label="Next up"><div class="body"><div class="eyebrow">${eyebrow}</div><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div>${btn || ''}</section>`;
  const btn = (label, attrs) => `<button class="btn small" ${attrs}>${label}</button>`;
  if (!hide && h < 12 && !state.weights.some((w) => w.date === date)) return card('Next up', 'Weigh in', 'Ten seconds · +5 XP', btn('Log', 'data-action="openWeigh"'));
  const nowMin = h * 60 + new Date().getMinutes();
  const due = meals.find((m) => !log[m.slot] && m.time <= nowMin + 30);
  if (due) return card(`Next up · ${toHHMM(due.time)} ${slotLabel(due.slot)}`, esc(byId(due.recipeId).name), 'Log it, whatever you ate · +10 XP', btn('Log', `data-action="openMeal" data-slot="${due.slot}" data-date="${date}"`));
  const { schedule } = store.schedule(state, date);
  const items = schedule[(new Date().getDay() + 6) % 7].items;
  const move = items.find((it) => it.kind !== 'rest' && !itemDone(state.workouts.log[date] || [], it));
  if (move && h >= 7) {
    if (move.kind === 'strength') return card('Next up · Movement', `Strength session ${move.variant}`, `About ${move.minutes} min · +40 XP`, `<a class="btn small" href="#/move/session/${move.variant}">Start</a>`);
    if (move.kind === 'activity') return card('Next up · Movement', esc(move.name), `${move.minutes} min · tap Done afterwards`, btn('Done', `data-action="activityDone" data-id="${esc(move.id)}"`));
    return card('Next up · Movement', `${move.minutes} min ${esc(CARDIO[move.mode].label.toLowerCase())}`, 'At a pace where you can talk', btn('Done', `data-action="cardioDone" data-mode="${move.mode}" data-min="${move.minutes}"`));
  }
  const habit = store.visibleHabits(state).find((a) => !state.habits.log[date]?.[a.id]);
  if (habit) return card('Next up · Habit', esc(habitById(habit.id).title), esc(habit.cue), btn('Open', `data-action="openHabit" data-id="${habit.id}"`));
  if (checkinDue(state, date)) return card('Next up', 'Weekly check-in', 'Two minutes · +50 XP', `<a class="btn small" href="#/checkin">Start</a>`);
  const later = meals.find((m) => !log[m.slot]);
  if (later) return card(`Later · ${toHHMM(later.time)} ${slotLabel(later.slot)}`, esc(byId(later.recipeId).name), 'Tap to see the recipe', btn('View', `data-action="openMeal" data-slot="${later.slot}" data-date="${date}"`));
  return card('All done', 'Everything’s ticked off for today', 'Rest up — see you tomorrow.', '', true);
}

// ---------- Habits ----------
/** Habit row: check = full habit (or upgrade a small win); "Small win" logs a smaller level. */
export function habitRow(state, a, date, checkAction, openAction, over = '') {
  const h = habitById(a.id);
  const val = state.habits.log[date]?.[a.id];
  const levels = habitLevels(a.id);
  const idx = levelIndex(a.id, val);
  const full = idx === levels.length - 1;
  const partial = idx >= 0 && !full;
  const st = streak(state.habits.log, a.id, date);
  const sub = partial ? `<span style="color:var(--accent);font-weight:650">Small win · ${esc(levels[idx].label)}</span>` : esc(a.cue);
  return `<li class="k-habit ${full ? 'is-done' : ''}"><div class="lrow ${full ? 'done' : ''}">
      <button class="check ${full ? 'on' : partial ? 'partial' : ''}" data-action="${checkAction}" data-id="${a.id}" aria-pressed="${full}" aria-label="${partial ? 'Upgrade to full: ' : ''}${esc(h.title)}">${icon('check')}</button>
      <button class="body row-btn" data-action="${openAction}" data-id="${a.id}">${over ? `<div class="over">${esc(over)} · Habit</div>` : ''}<div class="title"><span>${esc(h.title)}</span></div><div class="sub">${sub}</div></button>
      <span class="trail" style="flex-direction:column;align-items:flex-end;gap:4px">${!full && levels.length > 1 ? `<button class="win-chip" data-action="openSmallWin" data-id="${a.id}">${partial ? 'Change' : 'Small win'}</button>` : ''}${st ? `<span class="tag warm">${icon('flame', 'tiny')}${st}</span>` : ''}</span></div></li>`;
}

// ---------- Your day: one timeline, in the order the day happens ----------
function kcalSummary(state, date) {
  if (store.habitsOnly(state)) return '';
  const t = store.targets(state, date);
  const eaten = eatenSoFar(state, date);
  const p = proteinEaten(state, date);
  return `<div class="kcal-sum"><div class="row between nowrap"><div><span class="big">${fmtNum(eaten)}</span> <span class="of">/ ${fmtNum(t.kcal)} kcal</span></div><span class="of">${Math.max(0, t.kcal - eaten).toLocaleString()} left</span></div>
      <div class="meter" role="progressbar" aria-label="Calories eaten" aria-valuenow="${eaten}" aria-valuemax="${t.kcal}"><span style="width:${Math.min(100, (eaten / t.kcal) * 100).toFixed(1)}%"></span></div>
      <div class="meter-legend"><span>Protein ${Math.round(p)} / ${t.proteinG} g</span><span>${dayComplete(state, date) ? '✓ Whole day logged' : 'Tick meals as you go'}</span></div></div>`;
}

function weighRow(state, date) {
  const todays = state.weights.find((w) => w.date === date);
  const u = state.profile.units === 'imperial' ? 'imperial' : 'metric';
  const trend = store.trendWeight(state);
  return `<li class="k-weigh ${todays ? 'is-done' : ''}"><div class="lrow ${todays ? 'done' : ''}"><button class="check ${todays ? 'on' : ''}" data-action="openWeigh" aria-label="${todays ? 'Weighed in' : 'Weigh in'}">${icon(todays ? 'check' : 'scale')}</button><button class="body row-btn" data-action="openWeigh"><div class="over">Morning · after the bathroom</div><div class="title">${todays ? `Weighed in · ${fmtWeight(todays.kg, u)}` : 'Weigh in'}</div><div class="sub">Trend ${fmtWeight(trend, u)}${Math.abs(state.profile.startWeightKg - trend) >= 0.1 ? ` · ${fmtDelta(trend - state.profile.startWeightKg, u)} since start` : ''}</div></button><span class="trail" aria-hidden="true">${icon('chevron')}</span></div></li>`;
}

function moveRows(state, date) {
  const { schedule } = store.schedule(state, date);
  const items = schedule[(new Date().getDay() + 6) % 7].items;
  const logged = state.workouts.log[date] || [];
  const doneTag = `<span class="check on" style="animation:none" aria-label="Done">${icon('check')}</span>`;
  return items.map((it) => {
    const done = itemDone(logged, it);
    const cls = `k-move ${done ? 'is-done' : ''}`;
    if (it.kind === 'rest') return `<li class="k-move"><div class="lrow"><span class="slot-ico">${icon('move')}</span><div class="body"><div class="title">Rest day</div><div class="sub">A relaxed walk still counts</div></div></div></li>`;
    if (it.kind === 'strength') return `<li class="${cls}"><a class="lrow ${done ? 'done' : ''}" href="#/move/session/${it.variant}" style="text-decoration:none">${done ? doneTag : `<span class="slot-ico" style="background:var(--accent-soft);color:var(--accent)">${icon('move')}</span>`}<div class="body"><div class="over">Movement · +40 XP</div><div class="title">Strength session ${it.variant}</div><div class="sub">${it.exercises.length} exercises · ~${it.minutes} min</div></div><span class="trail">${done ? '' : `<span class="btn small primary">Start</span>`}</span></a></li>`;
    if (it.kind === 'activity') return `<li class="${cls}"><div class="lrow ${done ? 'done' : ''}">${done ? doneTag : `<button class="check" data-action="activityDone" data-id="${esc(it.id)}" aria-label="Done: ${esc(it.name)}">${icon('check')}</button>`}<div class="body"><div class="over">Movement · your activity</div><div class="title">${esc(it.name)}</div><div class="sub">${it.minutes} min</div></div></div></li>`;
    return `<li class="${cls}"><div class="lrow ${done ? 'done' : ''}">${done ? doneTag : `<button class="check" data-action="cardioDone" data-mode="${it.mode}" data-min="${it.minutes}" aria-label="Done: ${esc(CARDIO[it.mode].label)}">${icon('check')}</button>`}<div class="body"><div class="over">Movement</div><div class="title">${esc(CARDIO[it.mode].label)}</div><div class="sub">${it.minutes} min · chatty pace</div></div></div></li>`;
  }).join('');
}

function stepsRow(state, date) {
  const goal = stepGoal(state.profile.baselineSteps, state.profile.stepLevel || 0, state.profile.age);
  const steps = state.steps[date] || 0;
  const pct = Math.min(100, (steps / goal) * 100);
  return `<li class="k-steps ${steps >= goal ? 'is-done' : ''}"><button class="lrow" data-action="openSteps"><span class="slot-ico">${icon('progress')}</span><span class="body"><span class="title">${steps ? `${fmtNum(steps)} steps` : 'Add today’s steps'}</span><span class="meter" style="display:block;height:6px;margin:6px 0 0"><span style="width:${pct.toFixed(1)}%"></span></span><span class="sub" style="display:block">Goal ${fmtNum(goal)}</span></span><span class="trail">${icon('chevron')}</span></button></li>`;
}

function yourDay(state, date) {
  const hide = store.habitsOnly(state);
  const show = !hide;
  const meals = mealRowList(state, date);
  const active = store.visibleHabits(state);
  // The weigh-daily habit already sits in the morning; don't show the weigh-in twice.
  const plan = planDay(state.profile, { meals, habits: active, weigh: !hide && !active.some((a) => a.id === 'weigh_daily') });
  const byId = Object.fromEntries(active.map((a) => [a.id, a]));
  const mealHtml = Object.fromEntries(meals.map((m) => [m.slot, m.html]));
  const habitHtml = (id, label) => habitRow(state, byId[id], date, 'habitCheck', 'openHabit', label);
  const itemHtml = (it) => (it.kind === 'meal' ? mealHtml[it.slot] : it.kind === 'habit' ? habitHtml(it.id, it.label) : weighRow(state, date));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const parts = [];
  let part = null;
  let nowShown = false;
  const nowLine = `<li class="tl-now" aria-label="Now"><span>Now · ${toHHMM(nowMin)}</span></li>`;
  for (const it of plan.timed) {
    if (!nowShown && it.time > nowMin) {
      parts.push(nowLine);
      nowShown = true;
    }
    const p = partOf(it.time);
    if (p !== part) {
      part = p;
      parts.push(`<li class="tl-part" aria-hidden="true">${PARTS.find((x) => x.id === p).label}</li>`);
    }
    parts.push(itemHtml(it));
  }
  if (!nowShown) parts.push(nowLine);
  const extras = state.extras[date] || [];
  const extraRows = extras.map((x, i) => `<li class="k-extra is-done"><div class="lrow"><span class="slot-ico">${icon('plus')}</span><div class="body"><div class="title"><span>${esc(x.label || 'Extra')}</span></div>${show ? `<div class="sub">${fmtNum(x.kcal)} kcal</div>` : ''}</div><button class="icon-btn" data-action="rmExtra" data-i="${i}" aria-label="Remove ${esc(x.label || 'extra')}">${icon('x')}</button></div></li>`).join('');
  const any = [moveRows(state, date), stepsRow(state, date), ...plan.anytime.map((it) => habitHtml(it.id, 'Any time')), extraRows].join('');
  const total = plan.timed.length + plan.anytime.length;
  const doneCount = meals.filter((m) => m.done).length + active.filter((a) => state.habits.log[date]?.[a.id]).length + (!hide && state.weights.some((w) => w.date === date) ? 1 : 0);
  const noHabit = active.length ? '' : `<li class="tl-empty"><a class="lrow" href="#/habits" style="text-decoration:none"><span class="slot-ico" style="background:var(--accent-soft);color:var(--accent)">${icon('habits')}</span><span class="body"><span class="title">Pick one small habit</span><span class="sub">It slots into your day at the moment you choose</span></span><span class="trail">${icon('chevron')}</span></a></li>`;
  return `<div class="section-head"><h2>Your day</h2><span class="day-count">${doneCount} of ${total} done</span></div>
    <div class="card tight day-card">${kcalSummary(state, date)}
      <ul class="rows timeline-list">${parts.join('')}${noHabit}
        <li class="tl-part" aria-hidden="true">Any time today</li>${any}
        <li><button class="lrow" data-action="openExtra" style="min-height:54px"><span class="slot-ico" style="background:var(--accent-tint);color:var(--accent)">${icon('plus')}</span><span class="body"><span class="title" style="color:var(--accent)">Add something else you ate</span></span></button></li>
      </ul>
      <div class="day-links"><a href="#/meals">Week meal plan</a><a href="#/habits">Manage habits</a><a href="#/move">This week’s movement</a></div>
    </div>`;
}

function firstWeek(state, date) {
  if (state.flags?.firstWeekDone || store.weeksSinceStart(state, date) > 0 || state.profile.demo) return '';
  const hide = store.habitsOnly(state);
  const steps = [
    hide ? null : ['Weigh in each morning', state.weights.length >= 4],
    ['Tick off what you eat', Object.values(state.mealLog || {}).some((d) => Object.keys(d).length)],
    ['Do one easy strength session', Object.values(state.workouts.log || {}).some((l) => l.some((x) => x.kind === 'strength'))],
    ['Make one habit’s cue specific', state.habits.active.some((a) => a.cue !== habitById(a.id)?.cue)],
    ['Do your first check-in in 7 days', false],
  ].filter(Boolean);
  const done = steps.filter((s) => s[1]).length;
  return `<details class="card" style="padding:14px 16px"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px"><span class="slot-ico" style="background:var(--accent-soft);color:var(--accent)">${icon('star')}</span><span class="grow"><strong>Your first week</strong><span class="sub" style="display:block;font-size:var(--text-sm);color:var(--ink-3)">${done} of ${steps.length} done · small and consistent beats perfect</span></span>${icon('chevron')}</summary>
    <ul class="rows" style="margin-top:8px">${steps.map(([t, ok]) => `<li class="row nowrap" style="padding:8px 0;gap:10px"><span class="check ${ok ? 'on' : ''}" style="width:26px;height:26px" aria-hidden="true">${icon('check')}</span><span>${t}</span></li>`).join('')}</ul>
    <button class="btn small ghost" data-action="dismissFirstWeek" style="margin-top:6px">Hide this</button></details>`;
}

// ---------- Welcome back: the moment people usually quit, met with kindness ----------
export function lastActive(state) {
  let last = '';
  const keys = (o) => Object.keys(o || {}).filter((d) => Object.keys(o[d] || {}).length || (Array.isArray(o[d]) && o[d].length));
  for (const d of [...keys(state.mealLog), ...keys(state.habits?.log), ...keys(state.workouts?.log), ...(state.weights || []).map((w) => w.date)]) if (d > last) last = d;
  return last || null;
}

function welcomeBack(state, date) {
  const last = lastActive(state);
  if (!last || last >= date || state.flags?.welcomeBack === date) return '';
  const gap = daysBetween(last, date);
  if (gap < 3) return '';
  return `<section class="welcome-back" aria-label="Welcome back">
    <div class="wb-emoji" aria-hidden="true">🌱</div>
    <h2>Welcome back</h2>
    <p>${gap} days away doesn’t undo anything. In habit research, missing the odd day didn’t stop habits forming — what matters is picking it up again. Today is a fresh start.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" data-action="freshStart">Start fresh today</button><a class="btn ghost" href="#/learn/self_compassion">Why slips don’t count</a></div>
  </section>`;
}

function banners(state, date) {
  const out = [safetyNotices(state)];
  if (state.profile.demo) out.push(`<div class="notice info" style="align-items:center;padding:8px 8px 8px 14px">${icon('info')}<div class="grow">Exploring demo data</div><button class="btn small" data-action="endDemo">Start my own</button></div>`);
  const last = state.checkins.length ? state.checkins[state.checkins.length - 1].date : state.profile.startDate;
  const overdue = daysBetween(last, date) >= 9;
  const checkinDay = (new Date(date + 'T12:00').getDay() + 6) % 7 === Number(state.reminders?.checkinDay ?? 6);
  if (checkinDue(state, date) && (overdue || checkinDay) && !nextUp(state, date).includes('Weekly check-in')) out.push(`<a class="notice ok" href="#/checkin" style="text-decoration:none;align-items:center">${icon('calendar')}<div class="grow"><strong>Weekly check-in</strong> · two minutes, +50 XP</div>${icon('chevron')}</a>`);
  if (!state.alarms?.wake?.on && !state.flags?.alarmTip && !state.profile.demo && state.profile.schedule?.wake) out.push(`<div class="notice ok" style="align-items:center"><span style="font-size:1.3rem">⏰</span><a class="grow" href="#/settings/alarms" style="text-decoration:none;color:inherit"><strong>Wake up to something kind</strong> · a gentle alarm with a message just for you</a><button class="btn small ghost" data-action="dismissAlarmTip" aria-label="Dismiss">${icon('x')}</button></div>`);
  if (!state.profile.schedule?.wake && !state.flags?.dayAsked && !state.profile.demo) out.push(`<a class="notice info" href="#/settings/day" style="text-decoration:none;align-items:center">${icon('clock')}<div class="grow"><strong>Set your day</strong> · wake, bed and meal times so snacks and reminders fit you</div>${icon('chevron')}</a>`);
  if (state.dietBreakUntil && date <= state.dietBreakUntil) out.push(`<div class="notice info">${icon('info')}<div>Planned maintenance phase until ${fmtDate(state.dietBreakUntil)}: calories are at your estimated needs.</div></div>`);
  const calc = state.calcWeightKg ?? state.profile.weightKg;
  const trend = store.trendWeight(state);
  if (Math.abs(trend - calc) >= 2) out.push(`<div class="notice info">${icon('info')}<div class="grow">Targets refreshed for your new weight.</div><button class="btn small" data-action="ackRecalc">OK</button></div>`);
  return out.join('');
}

export default {
  render(state) {
    const date = store.today();
    return `<header class="page-head"><div><div class="eyebrow">${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · Week ${store.weeksSinceStart(state, date) + 1}</div><h1>${greeting()}</h1></div></header>
      ${banners(state, date)}
      <div class="today-grid">
        <div class="tg-hero">${welcomeBack(state, date)}${wrapReadyCard(state, date)}${hero(state, date)}${nextUp(state, date)}${quickLog(state)}</div>
        <div class="tg-day">${yourDay(state, date)}</div>
        <div class="tg-rest">${bodyRingsCard(state, date)}${journeyCard(state, date)}${firstWeek(state, date)}</div>
      </div>`;
  },
  actions: {
    habitCheck(el, ev, ctx) {
      toggleHabit(ctx, el.dataset.id);
    },
    rmExtra(el, ev, ctx) {
      const date = store.today();
      ctx.undoable('Removed', (st) => {
        st.extras[date] = (st.extras[date] || []).filter((_, i) => i !== Number(el.dataset.i));
        st.intake[date] = computeIntake(st, date);
        return st;
      });
    },
    activityDone(el, ev, ctx) {
      logPlannedActivity(ctx, el.dataset.id);
    },
    cardioDone(el, ev, ctx) {
      const date = store.today();
      ctx.undoable('Nice work — logged', (st) => {
        st.workouts.log[date] = [...(st.workouts.log[date] || []), { kind: 'cardio', mode: el.dataset.mode, minutes: Number(el.dataset.min) }];
        return st;
      });
    },
    dismissAlarmTip(el, ev, ctx) {
      ctx.update((st) => {
        st.flags = { ...(st.flags || {}), alarmTip: true };
        return st;
      }, { quiet: true });
    },
    freshStart(el, ev, ctx) {
      ctx.update((st) => {
        st.flags = { ...(st.flags || {}), welcomeBack: store.today() };
        return st;
      }, { quiet: true });
      ctx.toast('Fresh start. One small thing today is enough 🌱');
    },
    dismissFirstWeek(el, ev, ctx) {
      ctx.undoable('Hidden', (st) => {
        st.flags = { ...(st.flags || {}), firstWeekDone: true };
        return st;
      });
    },
    async endDemo(el, ev, ctx) {
      if (!(await ctx.confirm('Clear the demo data and set up your own plan?', { ok: 'Start my own plan' }))) return;
      ctx.set(store.emptyState(), { render: false, quiet: true });
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
