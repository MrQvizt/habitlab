// Today: progress hero, one "next up" action, then food, habits and movement as tappable rows.
// Details and logging choices live in bottom sheets (js/views/sheets.js); quick ticks offer Undo.
import { esc, icon, fmtKg, fmtWeight, fmtDelta, fmtNum, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { mealsFor, eatenSoFar, proteinEaten, dayComplete, setMealStatus, safetyNotices, checkinDue, slotLabel, computeIntake } from './shared.js';
import { byId, scaledNutrition } from '../engine/meals.js';
import { habitById, streak, habitLevels, levelIndex } from '../engine/habits.js';
import { stepGoal } from '../engine/workouts.js';
import { CARDIO } from '../data/exercises.js';
import { daysBetween } from '../engine/util.js';
import { toHHMM, daySchedule } from '../engine/schedule.js';
import { itemDone, logPlannedActivity } from './move.js';
import { slotIcon, toggleHabit, mealRows } from './sheets.js';
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

// ---------- Hero: quests ring + XP + streak ----------
function hero(state) {
  const g = store.game(state);
  const done = g.quests.filter((q) => q.done).length;
  const total = g.quests.length;
  const r = 40;
  const c = 2 * Math.PI * r;
  const off = c * (1 - done / Math.max(1, total));
  const title = done === total ? 'Perfect day!' : done === 0 ? 'Let’s get going' : `${total - done} quest${total - done > 1 ? 's' : ''} to a perfect day`;
  return `<section class="hero-today" aria-label="Today's progress">
    <div class="hero-top">
      <div class="hero-ring"><svg viewBox="0 0 92 92" aria-hidden="true"><circle class="bg" cx="46" cy="46" r="${r}"/><circle class="fg" cx="46" cy="46" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>
        <div class="center"><div><b>${done}/${total}</b><span>quests</span></div></div></div>
      <div class="hero-meta"><h2>${title}</h2>
        <div class="hero-pills">
          <a class="pill-stat xp" href="#/rewards">${icon('star')}${g.todayXp} XP today</a>
          <a class="pill-stat streak" href="#/rewards">${icon('flame')}${g.streak}-day streak</a>
          <a class="pill-stat" href="#/rewards">Level ${g.level}</a>
        </div></div>
    </div>
    <div class="quest-grid">${g.quests.map((q) => `<a class="qchip ${q.done ? 'done' : ''}" href="${q.href}"><span class="dot">${q.done ? icon('check') : ''}</span>${esc(q.label)}${q.total > 1 && !q.done ? ` <span class="num">${q.progress}/${q.total}</span>` : ''}</a>`).join('')}</div>
  </section>`;
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

// ---------- Food ----------
function food(state, date) {
  const t = store.targets(state, date);
  const meals = mealsFor(state, date);
  const log = state.mealLog[date] || {};
  const show = !store.habitsOnly(state);
  const eaten = eatenSoFar(state, date);
  const p = proteinEaten(state, date);
  const extras = state.extras[date] || [];
  const rows = mealRows(state, date);
  const extraRows = extras.map((x, i) => `<li><div class="lrow"><span class="slot-ico">${icon('plus')}</span><div class="body"><div class="title"><span>${esc(x.label || 'Extra')}</span></div>${show ? `<div class="sub">${fmtNum(x.kcal)} kcal</div>` : ''}</div><button class="icon-btn" data-action="rmExtra" data-i="${i}" aria-label="Remove ${esc(x.label || 'extra')}">${icon('x')}</button></div></li>`).join('');
  const summary = show
    ? `<div class="kcal-sum"><div class="row between nowrap"><div><span class="big">${fmtNum(eaten)}</span> <span class="of">/ ${fmtNum(t.kcal)} kcal</span></div><span class="of">${Math.max(0, t.kcal - eaten).toLocaleString()} left</span></div>
        <div class="meter" role="progressbar" aria-label="Calories eaten" aria-valuenow="${eaten}" aria-valuemax="${t.kcal}"><span style="width:${Math.min(100, (eaten / t.kcal) * 100).toFixed(1)}%"></span></div>
        <div class="meter-legend"><span>Protein ${Math.round(p)} / ${t.proteinG} g</span><span>${dayComplete(state, date) ? '✓ Whole day logged' : 'Tick meals as you go'}</span></div></div>`
    : '';
  return `<div class="section-head"><h2>Food</h2><a href="#/meals">Week plan</a></div>
    <div class="card tight">${summary}<ul class="rows">${rows}${extraRows}
      <li><button class="lrow" data-action="openExtra" style="min-height:54px"><span class="slot-ico" style="background:var(--accent-tint);color:var(--accent)">${icon('plus')}</span><span class="body"><span class="title" style="color:var(--accent)">Add something else you ate</span></span></button></li></ul></div>`;
}

// ---------- Habits ----------
/** Habit row: check = full habit (or upgrade a small win); "Small win" logs a smaller level. */
export function habitRow(state, a, date, checkAction, openAction) {
  const h = habitById(a.id);
  const val = state.habits.log[date]?.[a.id];
  const levels = habitLevels(a.id);
  const idx = levelIndex(a.id, val);
  const full = idx === levels.length - 1;
  const partial = idx >= 0 && !full;
  const st = streak(state.habits.log, a.id, date);
  const sub = partial ? `<span style="color:var(--accent);font-weight:650">Small win · ${esc(levels[idx].label)}</span>` : esc(a.cue);
  return `<li><div class="lrow ${full ? 'done' : ''}">
      <button class="check ${full ? 'on' : partial ? 'partial' : ''}" data-action="${checkAction}" data-id="${a.id}" aria-pressed="${full}" aria-label="${partial ? 'Upgrade to full: ' : ''}${esc(h.title)}">${icon('check')}</button>
      <button class="body row-btn" data-action="${openAction}" data-id="${a.id}"><div class="title"><span>${esc(h.title)}</span></div><div class="sub">${sub}</div></button>
      <span class="trail" style="flex-direction:column;align-items:flex-end;gap:4px">${!full && levels.length > 1 ? `<button class="win-chip" data-action="openSmallWin" data-id="${a.id}">${partial ? 'Change' : 'Small win'}</button>` : ''}${st ? `<span class="tag warm">${icon('flame', 'tiny')}${st}</span>` : ''}</span></div></li>`;
}

function habits(state, date) {
  const active = store.visibleHabits(state);
  if (!active.length) return `<div class="section-head"><h2>Habits</h2><a href="#/habits">Choose one</a></div><div class="card empty-state">${icon('habits')}<strong>No habit yet</strong>Pick one small habit to start with.</div>`;
  const log = state.habits.log[date] || {};
  return `<div class="section-head"><h2>Habits</h2><a href="#/habits">Manage</a></div><div class="card tight"><ul class="rows">${active.map((a) => {
    return habitRow(state, a, date, 'habitCheck', 'openHabit');
  }).join('')}</ul></div>`;
}

// ---------- Movement + weigh-in ----------
function movement(state, date) {
  const { schedule } = store.schedule(state, date);
  const items = schedule[(new Date().getDay() + 6) % 7].items;
  const logged = state.workouts.log[date] || [];
  const goal = stepGoal(state.profile.baselineSteps, state.profile.stepLevel || 0, state.profile.age);
  const steps = state.steps[date] || 0;
  const hide = store.habitsOnly(state);
  const todays = state.weights.find((w) => w.date === date);
  const u = state.profile.units === 'imperial' ? 'imperial' : 'metric';
  const trend = store.trendWeight(state);
  const rows = items.map((it) => {
    const done = itemDone(logged, it);
    if (it.kind === 'rest') return `<li><div class="lrow"><span class="slot-ico">${icon('move')}</span><div class="body"><div class="title">Rest day</div><div class="sub">A relaxed walk still counts</div></div></div></li>`;
    const doneTag = `<span class="check on" style="width:30px;height:30px;animation:none" aria-label="Done">${icon('check')}</span>`;
    if (it.kind === 'strength') return `<li><a class="lrow" href="#/move/session/${it.variant}" style="text-decoration:none"><span class="slot-ico" style="background:var(--accent-soft);color:var(--accent)">${icon('move')}</span><div class="body"><div class="title">Strength session ${it.variant}</div><div class="sub">${it.exercises.length} exercises · ~${it.minutes} min</div></div><span class="trail">${done ? doneTag : `<span class="btn small primary">Start</span>`}</span></a></li>`;
    if (it.kind === 'activity') return `<li><div class="lrow"><span class="slot-ico" style="background:var(--warm-soft);color:color-mix(in srgb,var(--warm) 80%,var(--ink))">${icon('flame')}</span><div class="body"><div class="title">${esc(it.name)}</div><div class="sub">${it.minutes} min · your activity</div></div><span class="trail">${done ? doneTag : `<button class="btn small primary" data-action="activityDone" data-id="${esc(it.id)}">Done</button>`}</span></div></li>`;
    return `<li><div class="lrow"><span class="slot-ico" style="background:var(--info-soft);color:var(--info)">${icon('move')}</span><div class="body"><div class="title">${esc(CARDIO[it.mode].label)}</div><div class="sub">${it.minutes} min · chatty pace</div></div><span class="trail">${done ? doneTag : `<button class="btn small primary" data-action="cardioDone" data-mode="${it.mode}" data-min="${it.minutes}">Done</button>`}</span></div></li>`;
  }).join('');
  const pct = Math.min(100, (steps / goal) * 100);
  const stepsRow = `<li><button class="lrow" data-action="openSteps"><span class="slot-ico">${icon('progress')}</span><span class="body"><span class="title">${steps ? `${fmtNum(steps)} steps` : 'Add today’s steps'}</span><span class="meter" style="display:block;height:6px;margin:6px 0 0"><span style="width:${pct.toFixed(1)}%"></span></span><span class="sub" style="display:block">Goal ${fmtNum(goal)}</span></span><span class="trail">${icon('chevron')}</span></button></li>`;
  const weighRow = hide ? '' : `<li><button class="lrow" data-action="openWeigh"><span class="slot-ico">${icon('scale')}</span><span class="body"><span class="title">${todays ? `Weighed in · ${fmtWeight(todays.kg, u)}` : 'Weigh in'}</span><span class="sub" style="display:block">Trend ${fmtWeight(trend, u)}${Math.abs(state.profile.startWeightKg - trend) >= 0.1 ? ` · ${fmtDelta(trend - state.profile.startWeightKg, u)} since start` : ''}</span></span><span class="trail">${todays ? `<span class="check on" style="width:30px;height:30px;animation:none" aria-label="Done">${icon('check')}</span>` : icon('chevron')}</span></button></li>`;
  return `<div class="section-head"><h2>Movement & body</h2><a href="#/move">This week</a></div><div class="card tight"><ul class="rows">${rows}${stepsRow}${weighRow}</ul></div>`;
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
        <div class="tg-hero">${wrapReadyCard(state, date)}${nextUp(state, date)}${hero(state)}</div>
        <div class="tg-food">${food(state, date)}</div>
        <div class="tg-rest">${habits(state, date)}${movement(state, date)}${bodyRingsCard(state, date)}${journeyCard(state, date)}${firstWeek(state, date)}</div>
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
