// Habit tracking: completion, forgiving streaks ("never miss twice"), and readiness to add a new habit.
import { addDays, isoDate } from './util.js';
import { HABITS, HABIT_STEPS } from '../data/habits.js';

export const MAX_ACTIVE = 3;

/**
 * Levels a habit can be logged at, smallest first; the last one is the full habit.
 * XP: two levels → 7 / 15; three levels → 6 / 10 / 15.
 */
export function habitLevels(id) {
  const h = habitById(id);
  if (!h) return [{ label: 'Done', xp: 15, full: true }];
  const labels = HABIT_STEPS[id] || [h.tiny, h.title];
  const xp = labels.length === 3 ? [6, 10, 15] : labels.length === 2 ? [7, 15] : [15];
  return labels.map((label, i) => ({ label, xp: xp[i], full: i === labels.length - 1, small: i < labels.length - 1 }));
}

/** Stored log value → level index. `true` (older data) means the full habit; numbers are 1-based. */
export function levelIndex(id, value) {
  const n = habitLevels(id).length;
  if (value === true) return n - 1;
  const k = Number(value);
  return Number.isInteger(k) && k >= 1 ? Math.min(n, k) - 1 : -1;
}

/** Value to store for a level index (1-based so every logged value is truthy). */
export function levelValue(id, index) {
  return index >= habitLevels(id).length - 1 ? true : index + 1;
}

// Habits you made yourself (state.habits.own), registered whenever state is loaded or changed.
let OWN = [];
export const OWN_WHY = 'Your own habit. Tie it to something you already do every day, keep it small, and repeat it in the same moment — that’s what makes it automatic.';
/** Your own habits as full habit objects (same shape as the library). */
export function setOwnHabits(list) {
  OWN = (Array.isArray(list) ? list : []).map((h) => ({ ...h, why: OWN_WHY, ev: 'habits', own: true }));
  return OWN;
}
export const ownHabits = () => OWN;
export const newOwnId = () => `own_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function habitById(id) {
  return HABITS.find((h) => h.id === id) || OWN.find((h) => h.id === id);
}

/**
 * Forgiving streak: count back from today; a single missed day doesn't break it, two in a row does.
 * log: {date: {habitId: true}}
 */
export function streak(log, habitId, today = isoDate()) {
  let count = 0;
  let misses = 0;
  let d = today;
  // Today not done yet doesn't count against the streak.
  if (!log[d]?.[habitId]) d = addDays(d, -1);
  for (let i = 0; i < 400; i++) {
    if (log[d]?.[habitId]) {
      count++;
      misses = 0;
    } else {
      misses++;
      if (misses >= 2) break;
    }
    d = addDays(d, -1);
  }
  return count;
}

export function completionRate(log, habitId, endDate, days = 7, since = null) {
  let done = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(endDate, -i);
    if (since && d < since) break;
    total++;
    if (log[d]?.[habitId]) done++;
  }
  return total ? done / total : 0;
}

/**
 * Is this habit "sticking"? Either a high automaticity rating (≥ 4/5 average) or ≥ 80% completion
 * for 3 consecutive weeks. Used to suggest adding the next habit — one at a time.
 */
export function isEstablished(active, log, today) {
  if (active.automaticity != null && active.automaticity >= 4) return true;
  for (let w = 0; w < 3; w++) {
    if (completionRate(log, active.id, addDays(today, -7 * w), 7, active.started) < 0.8) return false;
  }
  return addDays(active.started, 20) <= today;
}

export function suggestNext(activeIds, profile) {
  const has = new Set(activeIds);
  const order = [
    'weigh_daily', 'log_meals', 'water_meals', 'veg_half', 'walk_after_meal', 'sleep_window', 'protein_first',
    'strength_sessions', 'kitchen_closed', 'shopping_list', 'planned_treat', 'self_compassion', 'step_goal',
  ];
  // Personalise: emphasise the person's own stated struggles first.
  const priority = [];
  const s = new Set(profile.struggles || []);
  if (s.has('evening')) priority.push('kitchen_closed', 'plate_not_package');
  if (s.has('emotional')) priority.push('stress_reset', 'hunger_check', 'self_compassion');
  if (s.has('drinks')) priority.push('water_meals', 'alcohol_limit');
  if (s.has('portions')) priority.push('veg_half', 'plate_not_package', 'slow_down');
  if (s.has('time')) priority.push('batch_cook', 'shopping_list');
  if (s.has('sleep')) priority.push('sleep_window', 'screens_off');
  if (s.has('motivation')) priority.push('clothes_ready', 'weekly_review');
  return [...priority, ...order, ...HABITS.map((h) => h.id)].filter((id, i, arr) => arr.indexOf(id) === i && !has.has(id)).slice(0, 5);
}
