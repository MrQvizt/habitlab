// App state: one JSON object in localStorage. Everything stays on this device.
import { isoDate, weekStart, addDays, hashString } from './engine/util.js';
import { dailyTargets, estimateTdee } from './engine/calc.js';
import { latestTrend } from './engine/trend.js';
import { planWeek } from './engine/meals.js';
import { initialProgress, weekSchedule } from './engine/workouts.js';
import { screen } from './engine/safety.js';

const KEY = 'habitlab.v1';
export const VERSION = 1;

export function emptyState() {
  return {
    version: VERSION,
    profile: null,
    prefs: { diet: 'omnivore', allergies: [], dislikes: [], variety: 'medium', budget: 'normal', maxMinutesWeekday: 30, maxMinutesWeekend: 45, favorites: [], blockedRecipes: [], seed: 0, leftovers: true },
    weights: [],
    waist: [],
    intake: {},
    mealLog: {},
    extras: {},
    steps: {},
    daily: {},
    plans: {},
    workouts: { progress: {}, log: {} },
    habits: { active: [], log: {}, retired: [] },
    checkins: [],
    kcalAdjust: 0,
    tdeeOffset: 0,
    flags: {},
  };
}

let memory = null; // fallback when storage is unavailable
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    /* storage blocked or corrupt */
  }
  return memory ? structuredClone(memory) : emptyState();
}

export function save(state) {
  memory = structuredClone(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearAll() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* ignore */
  }
}

export function migrate(s) {
  const base = emptyState();
  const out = { ...base, ...s, prefs: { ...base.prefs, ...(s.prefs || {}) } };
  out.workouts = { ...base.workouts, ...(s.workouts || {}) };
  out.habits = { ...base.habits, ...(s.habits || {}) };
  return out;
}

// ---------- Derived values ----------

export function today() {
  return isoDate();
}

export function trendWeight(state) {
  return latestTrend(state.weights) ?? state.profile?.weightKg;
}

export function safety(state) {
  if (!state.profile) return { flags: [], blocked: false };
  return screen({ ...state.profile, weightKg: trendWeight(state) });
}

/** Habits-only mode hides calorie numbers and uses maintenance-level portions (rule 25). */
export function habitsOnly(state) {
  return !!state.profile?.habitsOnly || safety(state).blocked;
}

/**
 * Weight used for the calorie formula. Rule 7: recompute for every 2 kg change in trend,
 * so targets don't jitter with daily noise.
 */
export function calcWeight(state) {
  const t = trendWeight(state);
  const c = state.calcWeightKg ?? state.profile.weightKg;
  return Math.abs(t - c) >= 2 ? t : c;
}

export function targets(state, date = today()) {
  const p = state.profile;
  const dietBreak = (state.dietBreakUntil && date <= state.dietBreakUntil) || habitsOnly(state);
  return dailyTargets(p, { weightKg: calcWeight(state), kcalAdjust: state.kcalAdjust || 0, tdeeOffset: state.tdeeOffset || 0, dietBreak });
}

export function weekKey(date = today()) {
  return weekStart(date);
}

export function weeksSinceStart(state, date = today()) {
  const start = state.profile?.startDate || date;
  return Math.max(0, Math.floor((new Date(date) - new Date(start)) / (7 * 86400000)));
}

function planSignature(state, t) {
  const pr = state.prefs;
  return hashString(JSON.stringify([Math.round(t.kcal / 50), t.proteinG, pr.diet, pr.allergies, pr.dislikes, pr.variety, pr.budget, pr.maxMinutesWeekday, pr.maxMinutesWeekend, pr.mealsPerDay, pr.seed, pr.favorites, pr.blockedRecipes, pr.noCookLunch, pr.leftovers]));
}

/** Get (or build) this week's meal plan. Rebuilds when targets or preferences change. */
export function ensurePlan(state, date = today()) {
  const wk = weekKey(date);
  const t = targets(state, date);
  const sig = planSignature(state, t);
  const existing = state.plans[wk];
  if (existing && existing.sig === sig) return { state, plan: existing };
  const days = planWeek(t, state.prefs, wk);
  // Keep days that are already in the past (and any swaps) so history isn't rewritten.
  if (existing) {
    for (let d = 0; d < 7; d++) if (addDays(wk, d) < date && existing.days[d]) days[d] = existing.days[d];
  }
  const plan = { sig, kcal: t.kcal, days, created: date };
  const plans = { ...state.plans, [wk]: plan };
  // Keep only the last 8 weeks of plans.
  const keys = Object.keys(plans).sort();
  while (keys.length > 8) delete plans[keys.shift()];
  return { state: { ...state, plans }, plan };
}

export function ensureProgress(state) {
  if (state.workouts.progress && Object.keys(state.workouts.progress).length) return state;
  return { ...state, workouts: { ...state.workouts, progress: initialProgress(state.profile) } };
}

export function schedule(state, date = today()) {
  return weekSchedule(state.profile, state.workouts.progress, weeksSinceStart(state, date));
}

export function exportJson(state) {
  return JSON.stringify({ app: 'habit-lab', exported: new Date().toISOString(), state }, null, 2);
}

export function importJson(text) {
  const obj = JSON.parse(text);
  const s = obj.state || obj;
  if (!s || typeof s !== 'object' || !('profile' in s)) throw new Error('This file doesn’t look like a Habit Lab export.');
  return migrate(s);
}

export { estimateTdee };
