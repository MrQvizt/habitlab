// Rewards: XP, levels, daily quests, a "showing up" streak and badges.
//
// Design rules (see Learn → "Why the app gives you points"):
// - Reward the behaviours that predict success — logging, moving, habits, check-ins — never eating
//   less or a lower number on the scale. Logging a meal earns the same XP whatever you ate,
//   so there's never a reason to log dishonestly.
// - XP is *derived* from what's logged, not stored, so un-ticking and re-ticking can't farm points
//   and nothing is lost if the plan is rebuilt.
// - A small, unpredictable "lucky bonus" (variable reward) makes ticking things off more fun.
//   It is deterministic per item, so it can't be re-rolled.
import { addDays, daysBetween, weekStart, hashString, planDayFor } from './util.js';
import { stepGoal, creditedMinutes } from './workouts.js';
import { habitLevels, levelIndex } from './habits.js';
import { bodyCollection } from './body.js';

export const XP = {
  meal: 10, // per meal you ate and logged — planned or "something else" (honesty pays the same)
  mealSkip: 5, // a skipped meal is worth logging, but never worth more than eating
  fullDay: 20, // every planned meal logged
  weighIn: 5,
  habit: 15,
  strength: 40,
  cardioBase: 10, // + 1 XP per 3 minutes, capped
  cardioMax: 40,
  steps: 15, // daily step goal reached
  checkin: 50,
  perfectDay: 25, // all daily quests done
  lucky: 10,
  badge: 50,
  wrap: 30, // opening last week's Body Wrap to the end
  wake: 10, // morning intention after the wake-up alarm
};

// Level n starts at 50·n·(n−1) XP: 0, 100, 300, 600, 1000, 1500 …  A full, active day is ~150–200 XP.
export function levelStart(n) {
  return 50 * n * (n - 1);
}
export function levelFromXp(xp) {
  let n = 1;
  while (levelStart(n + 1) <= xp) n++;
  return n;
}

export const LEVEL_TITLES = [
  'First Step', 'Starter', 'Mover', 'Planner', 'Builder', 'Steady', 'Committed', 'Momentum', 'Consistent', 'Strong',
  'Resilient', 'Trailblazer', 'Habit Pro', 'Unstoppable', 'Role Model', 'Veteran', 'Master Planner', 'Iron Will', 'Lifer', 'Legend',
];
export function levelTitle(n) {
  return n <= LEVEL_TITLES.length ? LEVEL_TITLES[n - 1] : `Legend ${n - LEVEL_TITLES.length + 1}`;
}

const isLucky = (key) => hashString(key) % 6 === 0; // about 1 in 6 items

function mealsFor(state, date) {
  return planDayFor(state, date);
}

/**
 * Everything that earned XP on one day.
 * @returns [{key, kind, label, xp, lucky?}]
 */
export function dayAwards(state, date, { habitsOnly = false } = {}) {
  const out = [];
  const add = (key, kind, label, xp, luckyOk = false) => {
    out.push({ key, kind, label, xp });
    if (luckyOk && isLucky(key)) out.push({ key: `${key}:lucky`, kind: 'lucky', label: 'Lucky bonus!', xp: XP.lucky, lucky: true });
  };
  const log = state.mealLog?.[date] || {};
  const meals = mealsFor(state, date);
  for (const m of meals) {
    const st = log[m.slot]?.status;
    if (!st) continue;
    const slotName = m.slot.replace(/\d$/, '');
    // Skips are logged honestly but earn less, no lucky bonus and no eating badges: the app never rewards eating less.
    if (st === 'skip') add(`meal:${date}:${m.slot}`, 'mealSkip', `Logged skipped ${slotName}`, XP.mealSkip);
    else add(`meal:${date}:${m.slot}`, 'meal', `Logged ${slotName}`, XP.meal, true);
  }
  if (meals.length && meals.every((m) => log[m.slot])) add(`full:${date}`, 'fullDay', 'Whole day logged', XP.fullDay);
  if (!habitsOnly && state.weights?.some((w) => w.date === date)) add(`weigh:${date}`, 'weigh', 'Weighed in', XP.weighIn);
  const hl = state.habits?.log?.[date] || {};
  for (const [id, value] of Object.entries(hl)) {
    if (habitsOnly && (id === 'weigh_daily' || id === 'log_meals')) continue;
    // Small wins count: any level keeps the streak and the quest; XP scales with the level.
    const levels = habitLevels(id);
    const lvl = levels[levelIndex(id, value)] || levels[levels.length - 1];
    add(`habit:${date}:${id}`, lvl.full ? 'habit' : 'habitSmall', lvl.full ? 'Habit done' : `Small win: ${lvl.label}`, lvl.xp, true);
  }
  (state.workouts?.log?.[date] || []).forEach((w, i) => {
    if (w.kind === 'strength') add(`strength:${date}:${i}`, 'strength', 'Strength session', XP.strength, true);
    else if (w.kind === 'activity') add(`activity:${date}:${i}`, 'cardio', `${w.name || 'Activity'} (${w.minutes} min)`, Math.min(XP.cardioMax, XP.cardioBase + Math.floor((w.minutes || 0) / 3)), true);
    else if (w.kind === 'cardio') add(`cardio:${date}:${i}`, 'cardio', `${w.minutes} min ${w.mode || 'cardio'}`, Math.min(XP.cardioMax, XP.cardioBase + Math.floor((w.minutes || 0) / 3)), true);
  });
  const p = state.profile || {};
  const goal = stepGoal(p.baselineSteps, p.stepLevel || 0, p.age);
  if ((state.steps?.[date] || 0) >= goal) add(`steps:${date}`, 'steps', 'Step goal reached', XP.steps);
  if (state.checkins?.some((c) => c.date === date)) add(`checkin:${date}`, 'checkin', 'Weekly check-in', XP.checkin);
  for (const [ws, seen] of Object.entries(state.wraps || {})) if (seen === date) add(`wrap:${ws}`, 'wrap', 'Body Wrap opened', XP.wrap);
  if (state.wakes?.[date]) add(`wake:${date}`, 'wake', 'Morning intention', XP.wake);
  if (quests(state, date, { habitsOnly }).every((q) => q.done)) add(`perfect:${date}`, 'perfect', 'Perfect day', XP.perfectDay);
  return out;
}

/**
 * Today's quests. Each is a small, achievable target — completing them all is a "perfect day".
 */
export function quests(state, date, { habitsOnly = false } = {}) {
  const out = [];
  const meals = mealsFor(state, date);
  const log = state.mealLog?.[date] || {};
  const logged = meals.filter((m) => log[m.slot]).length;
  out.push({ id: 'meals', label: 'Log every meal', progress: logged, total: meals.length || 1, done: meals.length > 0 && logged === meals.length, href: '#/today' });
  const active = (state.habits?.active || []).filter((a) => !(habitsOnly && (a.id === 'weigh_daily' || a.id === 'log_meals')));
  if (active.length) {
    const doneH = active.filter((a) => state.habits.log?.[date]?.[a.id]).length;
    out.push({ id: 'habits', label: active.length === 1 ? 'Do your habit' : `Do your ${active.length} habits`, progress: doneH, total: active.length, done: doneH === active.length, href: '#/habits' });
  }
  const p = state.profile || {};
  const goal = stepGoal(p.baselineSteps, p.stepLevel || 0, p.age);
  const moved = (state.workouts?.log?.[date] || []).length > 0 || (state.steps?.[date] || 0) >= goal;
  out.push({ id: 'move', label: 'Move today', hint: 'A session, an activity, a walk or your step goal', progress: moved ? 1 : 0, total: 1, done: moved, href: '#/move' });
  if (!habitsOnly) {
    const w = state.weights?.some((x) => x.date === date);
    out.push({ id: 'weigh', label: 'Weigh in', progress: w ? 1 : 0, total: 1, done: !!w, href: '#/today' });
  }
  return out;
}

/** Forgiving "showing up" streak: a day counts if anything was logged; one missed day is forgiven. */
export function showUpStreak(activeDays, today) {
  let count = 0;
  let misses = 0;
  let d = activeDays.has(today) ? today : addDays(today, -1);
  for (let i = 0; i < 1000; i++) {
    if (activeDays.has(d)) {
      count++;
      misses = 0;
    } else if (++misses >= 2) break;
    d = addDays(d, -1);
  }
  return count;
}

function bestStreak(activeDays) {
  const days = [...activeDays].sort();
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const d of days) {
    const gap = prev ? daysBetween(prev, d) : 1;
    cur = gap <= 2 ? cur + 1 : 1; // forgive one missed day
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

// ---------- Badges ----------
// Each badge: id, name, how (shown when locked), check(stats) → boolean. Weight badges are hidden in habits-only mode.
export const BADGES = [
  { id: 'first_log', name: 'First Bite', icon: 'meals', how: 'Log a meal you ate', check: (s) => s.mealsLogged >= 1 },
  { id: 'full_day', name: 'Full Picture', icon: 'check', how: 'Log every meal in a day', check: (s) => s.fullDays >= 1 },
  { id: 'full_days_7', name: 'Food Diarist', icon: 'meals', how: 'Log every meal on 7 days', check: (s) => s.fullDays >= 7 },
  { id: 'full_days_30', name: 'Data Devotee', icon: 'meals', how: 'Log every meal on 30 days', check: (s) => s.fullDays >= 30 },
  { id: 'perfect_day', name: 'Perfect Day', icon: 'star', how: 'Complete all daily quests', check: (s) => s.perfectDays >= 1 },
  { id: 'perfect_10', name: 'Perfectionist (the good kind)', icon: 'star', how: 'Complete all daily quests on 10 days', check: (s) => s.perfectDays >= 10 },
  { id: 'streak_3', name: 'Hat Trick', icon: 'flame', how: 'Show up 3 days running', check: (s) => s.bestStreak >= 3 },
  { id: 'streak_7', name: 'One Week Strong', icon: 'flame', how: 'Show up 7 days running', check: (s) => s.bestStreak >= 7 },
  { id: 'streak_30', name: 'Month of Momentum', icon: 'flame', how: 'Show up 30 days running', check: (s) => s.bestStreak >= 30 },
  { id: 'streak_66', name: 'Habit Formed', icon: 'flame', how: 'Show up 66 days running — the median time for a habit to stick', check: (s) => s.bestStreak >= 66 },
  { id: 'streak_100', name: 'Centurion', icon: 'flame', how: 'Show up 100 days running', check: (s) => s.bestStreak >= 100 },
  { id: 'first_strength', name: 'First Rep', icon: 'move', how: 'Finish a strength session', check: (s) => s.strength >= 1 },
  { id: 'strength_10', name: 'Getting Strong', icon: 'move', how: 'Finish 10 strength sessions', check: (s) => s.strength >= 10 },
  { id: 'strength_30', name: 'Iron Habit', icon: 'move', how: 'Finish 30 strength sessions', check: (s) => s.strength >= 30 },
  { id: 'level_up_move', name: 'Level Up', icon: 'progress', how: 'Move up to a harder exercise', check: (s) => s.exerciseLevelUps >= 1 },
  { id: 'cardio_150', name: 'Guideline Hit', icon: 'move', how: 'Log 150+ active minutes in one week', check: (s) => s.bestWeekMinutes >= 150 },
  { id: 'cardio_250', name: 'Maintainer Pace', icon: 'move', how: 'Log 250+ active minutes in one week', check: (s) => s.bestWeekMinutes >= 250 },
  { id: 'steps_5', name: 'Step Up', icon: 'move', how: 'Reach your step goal on 5 days', check: (s) => s.stepDays >= 5 },
  { id: 'small_wins_5', name: 'Small Steps', icon: 'habits', how: 'Log 5 small wins — every step counts', check: (s) => s.smallWins >= 5 },
  { id: 'habit_7', name: 'Habit Hatchling', icon: 'habits', how: 'Tick a habit 7 times', check: (s) => s.habitTicksMax >= 7 },
  { id: 'habit_graduate', name: 'Graduate', icon: 'habits', how: 'Graduate a habit once it’s automatic', check: (s) => s.graduated >= 1 },
  { id: 'checkin_1', name: 'Reflector', icon: 'calendar', how: 'Complete a weekly check-in', check: (s) => s.checkins >= 1 },
  { id: 'checkin_8', name: 'Two Months In', icon: 'calendar', how: 'Complete 8 weekly check-ins', check: (s) => s.checkins >= 8 },
  { id: 'recipes_10', name: 'Explorer', icon: 'meals', how: 'Eat 10 different recipes', check: (s) => s.distinctRecipes >= 10 },
  { id: 'recipes_25', name: 'Home Chef', icon: 'meals', how: 'Eat 25 different recipes', check: (s) => s.distinctRecipes >= 25 },
  { id: 'wrap_1', name: 'Unwrapped', icon: 'star', how: 'Open your first weekly Body Wrap', check: (s) => s.wraps >= 1 },
  { id: 'wrap_8', name: 'Body Journalist', icon: 'star', how: 'Open 8 Body Wraps', check: (s) => s.wraps >= 8 },
  { id: 'big_heart', name: 'Big Heart', icon: 'move', how: 'Close your heart ring (150 active min) in 4 weeks', check: (s) => s.body.closedCounts.heart >= 4 },
  { id: 'full_body', name: 'Full Body Week', icon: 'star', how: 'Close all body rings in one week', check: (s) => s.body.allClosed >= 1 },
  { id: 'morning_7', name: 'Rise & Shine', icon: 'clock', how: 'Start 7 days with a morning intention', check: (s) => s.wakes >= 7 },
  { id: 'morning_30', name: 'Morning Person', icon: 'clock', how: 'Start 30 days with a morning intention', check: (s) => s.wakes >= 30 },
  { id: 'weigh_7', name: 'Trend Spotter', icon: 'scale', how: 'Log 7 weigh-ins', check: (s) => s.weighIns >= 7, weight: true },
  { id: 'milestone_5', name: '5% Health Win', icon: 'progress', how: 'Reach a 5% loss — real health benefits start here', check: (s) => s.lostPct >= 5, weight: true },
  { id: 'milestone_10', name: '10% Health Win', icon: 'progress', how: 'Reach a 10% loss', check: (s) => s.lostPct >= 10, weight: true },
];

/**
 * Full rewards summary, derived from state.
 */
export function summary(state, today, { habitsOnly = false, trendKg = null } = {}) {
  const p = state.profile || {};
  const start = p.startDate || today;
  const span = Math.min(800, Math.max(0, daysBetween(start, today)));
  const activeDays = new Set();
  const byDay = {};
  let xp = 0;
  const stats = { smallWins: 0, mealsLogged: 0, fullDays: 0, perfectDays: 0, strength: 0, stepDays: 0, weighIns: 0, checkins: (state.checkins || []).length, graduated: (state.habits?.retired || []).length };
  const recipes = new Set();
  const habitTicks = {};
  for (let i = span; i >= 0; i--) {
    const date = addDays(today, -i);
    const awards = dayAwards(state, date, { habitsOnly });
    if (!awards.length) continue;
    activeDays.add(date);
    const dayXp = awards.reduce((a, x) => a + x.xp, 0);
    byDay[date] = { xp: dayXp, awards };
    xp += dayXp;
    for (const a of awards) {
      if (a.kind === 'meal') stats.mealsLogged++;
      else if (a.kind === 'fullDay') stats.fullDays++;
      else if (a.kind === 'perfect') stats.perfectDays++;
      else if (a.kind === 'strength') stats.strength++;
      else if (a.kind === 'steps') stats.stepDays++;
      else if (a.kind === 'weigh') stats.weighIns++;
      else if (a.kind === 'habitSmall') stats.smallWins = (stats.smallWins || 0) + 1;
    }
    const log = state.mealLog?.[date] || {};
    for (const m of mealsFor(state, date)) if (log[m.slot]?.status === 'ate') recipes.add(m.recipeId);
    for (const id of Object.keys(state.habits?.log?.[date] || {})) habitTicks[id] = (habitTicks[id] || 0) + 1;
  }
  stats.distinctRecipes = recipes.size;
  stats.habitTicksMax = Math.max(0, ...Object.values(habitTicks));
  stats.bestStreak = bestStreak(activeDays);
  stats.exerciseLevelUps = Object.values(state.workouts?.progress || {}).filter((c) => (c.history || []).some((h) => h.stepId && h.stepId !== c.stepId)).length;
  let bestWeek = 0;
  for (let w = weekStart(start); w <= today; w = addDays(w, 7)) {
    let m = 0;
    for (let d = 0; d < 7; d++) for (const x of state.workouts?.log?.[addDays(w, d)] || []) m += creditedMinutes(x);
    bestWeek = Math.max(bestWeek, m);
  }
  stats.bestWeekMinutes = bestWeek;
  stats.wraps = Object.keys(state.wraps || {}).length;
  stats.wakes = Object.keys(state.wakes || {}).length;
  stats.body = bodyCollection(state, today, { habitsOnly });
  const trend = trendKg ?? p.weightKg;
  stats.lostPct = p.startWeightKg && trend ? ((p.startWeightKg - trend) / p.startWeightKg) * 100 : 0;

  const earnedNow = BADGES.filter((b) => !(habitsOnly && b.weight) && b.check(stats)).map((b) => b.id);
  // Badges once earned are kept (stored with the date), even if a log is later un-ticked.
  // (Earlier versions could award First Bite for a skipped meal; drop it until a real meal is logged.)
  const kept = Object.keys(state.game?.badges || {}).filter((id) => id !== 'first_log' || stats.mealsLogged >= 1);
  const badges = [...new Set([...kept, ...earnedNow])];
  xp += badges.length * XP.badge;
  const level = levelFromXp(xp);
  return {
    xp,
    level,
    title: levelTitle(level),
    levelStart: levelStart(level),
    nextLevelAt: levelStart(level + 1),
    streak: showUpStreak(activeDays, today),
    bestStreak: stats.bestStreak,
    todayXp: byDay[today]?.xp || 0,
    byDay,
    stats,
    badges,
    newBadges: earnedNow.filter((id) => !kept.includes(id)),
    quests: quests(state, today, { habitsOnly }),
  };
}
