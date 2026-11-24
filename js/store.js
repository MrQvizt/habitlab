// App state: one JSON object in localStorage. Everything stays on this device.
import { isoDate, weekStart, addDays, hashString } from './engine/util.js';
import { dailyTargets, estimateTdee } from './engine/calc.js';
import { latestTrend } from './engine/trend.js';
import { planWeek } from './engine/meals.js';
import { initialProgress, weekSchedule } from './engine/workouts.js';
import { screen } from './engine/safety.js';
import { summary as gameSummaryRaw } from './engine/game.js';
import { DEFAULT_REMINDERS } from './engine/reminders.js';
import { HABITS } from './data/habits.js';
import { RECIPES } from './data/recipes.js';
import { FOODS, DIETS, ALLERGENS } from './data/foods.js';
import { CARDIO, CHAINS } from './data/exercises.js';
import { ACTIVITY_LEVELS, PACES } from './engine/calc.js';

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
    game: { badges: {}, sound: true, haptics: true, lastLevel: 1 },
    reminders: { ...DEFAULT_REMINDERS },
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
  state.savedAt = Date.now();
  memory = structuredClone(state);
  mirrorToNative(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- Native mirror (Android app) ----------
// In the Android app, every save is also copied to the app's native preferences. WebView storage
// survives app updates, but this second copy protects against it ever being cleared, and native
// preferences are included in Android's automatic backup (so data can follow you to a new phone).
const NATIVE_KEY = 'habitlab.state';
function nativePrefs() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  return cap?.isNativePlatform?.() ? cap.Plugins?.Preferences || null : null;
}
let mirrorTimer = null;
function mirrorToNative(state) {
  const prefs = nativePrefs();
  if (!prefs) return;
  clearTimeout(mirrorTimer);
  const json = JSON.stringify(state);
  mirrorTimer = setTimeout(() => prefs.set({ key: NATIVE_KEY, value: json }).catch(() => {}), 400);
}

/**
 * If the native copy is newer than what the WebView has (or the WebView is empty), return it.
 * Resolves null otherwise, or when not running in the Android app.
 */
export async function nativeRestoreCandidate(current) {
  const prefs = nativePrefs();
  if (!prefs) return null;
  try {
    const { value } = await prefs.get({ key: NATIVE_KEY });
    if (!value) {
      if (current?.profile) mirrorToNative(current); // first run of a version with the mirror: seed it
      return null;
    }
    const stored = migrate(JSON.parse(value));
    if (!stored.profile) return null;
    if (!current?.profile || (stored.savedAt || 0) > (current.savedAt || 0)) return stored;
  } catch (e) {
    /* unreadable copy: ignore */
  }
  return null;
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
  out.game = { ...base.game, ...(s.game || {}) };
  out.reminders = { ...base.reminders, ...(s.reminders || {}) };
  return sanitize(out);
}

// ---------- Validation of stored / imported data ----------
// A backup file is untrusted input: coerce every field to the type and range the app expects,
// and drop anything unknown, so nothing odd can reach the page.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = (v, lo, hi, dflt = null) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.min(hi, Math.max(lo, Number(v))) : dflt);
const oneOf = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);
const subset = (arr, allowed) => (Array.isArray(arr) ? [...new Set(arr.filter((x) => allowed.includes(x)))] : []);
const isoOr = (v, dflt) => (typeof v === 'string' && ISO.test(v) ? v : dflt);
const dateMap = (obj, fn) => Object.fromEntries(Object.entries(obj && typeof obj === 'object' ? obj : {}).filter(([k]) => ISO.test(k)).map(([k, v]) => [k, fn(v)]).filter(([, v]) => v != null));

export function sanitize(s) {
  const p = s.profile;
  if (p && typeof p === 'object') {
    s.profile = {
      ...p,
      units: oneOf(p.units, ['metric', 'imperial'], 'metric'),
      sex: oneOf(p.sex, ['female', 'male'], 'female'),
      age: num(p.age, 12, 110, 40),
      heightCm: num(p.heightCm, 100, 250, 165),
      weightKg: num(p.weightKg, 30, 400, 100),
      startWeightKg: num(p.startWeightKg, 30, 400, num(p.weightKg, 30, 400, 100)),
      goalWeightKg: num(p.goalWeightKg, 30, 400, null),
      activity: oneOf(p.activity, Object.keys(ACTIVITY_LEVELS), 'sedentary'),
      pace: oneOf(p.pace, Object.keys(PACES), 'steady'),
      phase: oneOf(p.phase, ['lose', 'maintain'], 'lose'),
      startDate: isoOr(p.startDate, isoDate()),
      medical: subset(p.medical, ['pregnant', 'eating_disorder', 'diabetes_meds', 'heart', 'kidney', 'glp1']),
      edFlags: subset(p.edFlags, ['binge', 'compensate', 'worth']),
      limitations: subset(p.limitations, ['knee', 'back', 'shoulder', 'wrist']),
      experience: oneOf(p.experience, ['none', 'some', 'regular'], 'none'),
      equipment: subset(p.equipment, ['bands', 'dumbbells', 'gym']),
      daysAvailable: subset((p.daysAvailable || []).map(Number), [0, 1, 2, 3, 4, 5, 6]),
      sessionMinutes: num(p.sessionMinutes, 10, 90, 30),
      baselineCardioMin: num(p.baselineCardioMin, 0, 2000, 0),
      baselineSteps: num(p.baselineSteps, 0, 50000, null),
      cardioPrefs: subset(p.cardioPrefs, Object.keys(CARDIO)).length ? subset(p.cardioPrefs, Object.keys(CARDIO)) : ['walk'],
      struggles: subset(p.struggles, ['evening', 'emotional', 'portions', 'drinks', 'time', 'sleep', 'motivation']),
      stepLevel: num(p.stepLevel, 0, 40, 0),
      cardioBonus: num(p.cardioBonus, 0, 300, 0),
      activities: (Array.isArray(p.activities) ? p.activities : []).filter((a) => a && typeof a.name === 'string' && a.name.trim()).slice(0, 12).map((a, i) => ({
        id: typeof a.id === 'string' && /^[a-z0-9_-]{1,24}$/i.test(a.id) ? a.id : `act${i}`,
        name: a.name.trim().slice(0, 80),
        days: subset((a.days || []).map(Number), [0, 1, 2, 3, 4, 5, 6]),
        minutes: num(a.minutes, 5, 600, 30),
        intensity: oneOf(a.intensity, ['easy', 'moderate', 'vigorous'], 'moderate'),
        strength: !!a.strength,
      })),
      schedule: Object.fromEntries(Object.entries(p.schedule && typeof p.schedule === 'object' ? p.schedule : {}).filter(([k, v]) => ['wake', 'bed', 'firstMeal', 'lastMeal'].includes(k) && typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v))),
      habitsOnly: !!p.habitsOnly,
      demo: !!p.demo,
    };
  }
  const recipeIds = RECIPES.map((r) => r.id);
  const pr = s.prefs;
  s.prefs = {
    ...pr,
    diet: oneOf(pr.diet, Object.keys(DIETS), 'omnivore'),
    allergies: subset(pr.allergies, Object.keys(ALLERGENS)),
    dislikes: subset(pr.dislikes, Object.keys(FOODS)),
    variety: oneOf(pr.variety, ['low', 'medium', 'high'], 'medium'),
    budget: oneOf(pr.budget, ['tight', 'normal', 'flexible'], 'normal'),
    mealsPerDay: num(pr.mealsPerDay, 3, 6, null),
    maxMinutesWeekday: num(pr.maxMinutesWeekday, 10, 120, 30),
    maxMinutesWeekend: num(pr.maxMinutesWeekend, 10, 120, 45),
    favorites: subset(pr.favorites, recipeIds),
    blockedRecipes: subset(pr.blockedRecipes, recipeIds),
    seed: num(pr.seed, 0, 1e6, 0),
  };
  s.weights = (Array.isArray(s.weights) ? s.weights : []).filter((w) => w && ISO.test(w.date) && num(w.kg, 30, 400) != null).map((w) => ({ date: w.date, kg: Number(w.kg) }));
  s.waist = (Array.isArray(s.waist) ? s.waist : []).filter((w) => w && ISO.test(w.date) && num(w.cm, 30, 300) != null).map((w) => ({ date: w.date, cm: Number(w.cm) }));
  s.intake = dateMap(s.intake, (v) => num(v, 0, 20000));
  s.steps = dateMap(s.steps, (v) => num(v, 0, 200000));
  s.extras = dateMap(s.extras, (v) => (Array.isArray(v) ? v.map((x) => ({ label: String(x?.label ?? '').slice(0, 80), kcal: num(x?.kcal, 0, 10000, 0) })) : null));
  s.flags = s.flags && typeof s.flags === 'object' ? Object.fromEntries(Object.entries(s.flags).filter(([, v]) => typeof v === 'boolean' || (typeof v === 'string' && ISO.test(v)))) : {};
  const g = s.game && typeof s.game === 'object' ? s.game : {};
  s.game = {
    badges: Object.fromEntries(Object.entries(g.badges || {}).filter(([k, v]) => /^[a-z0-9_]+$/.test(k) && ISO.test(v))),
    sound: g.sound !== false,
    haptics: g.haptics !== false,
    lastLevel: num(g.lastLevel, 1, 1000, 1),
  };
  const rm = s.reminders && typeof s.reminders === 'object' ? s.reminders : {};
  const hhmm = (v, d) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
  s.reminders = Object.fromEntries(Object.entries(DEFAULT_REMINDERS).map(([k, d]) => [k, typeof d === 'boolean' ? (k in rm ? !!rm[k] : d) : typeof d === 'number' ? num(rm[k], 0, 6, d) : hhmm(rm[k], d)]));
  s.savedAt = num(s.savedAt, 0, 1e13, 0);
  s.kcalAdjust = num(s.kcalAdjust, -500, 500, 0);
  s.tdeeOffset = num(s.tdeeOffset, -1500, 1500, 0);
  s.calcWeightKg = num(s.calcWeightKg, 30, 400, null) ?? undefined;
  s.maintainKg = num(s.maintainKg, 30, 400, null) ?? undefined;
  const habitIds = HABITS.map((h) => h.id);
  s.habits.active = (Array.isArray(s.habits.active) ? s.habits.active : [])
    .filter((a) => a && habitIds.includes(a.id))
    .slice(0, 3)
    .map((a) => ({ id: a.id, cue: String(a.cue ?? '').slice(0, 160), started: isoOr(a.started, isoDate()), automaticity: num(a.automaticity, 1, 5, null) }));
  s.habits.retired = (Array.isArray(s.habits.retired) ? s.habits.retired : []).filter((r) => r && habitIds.includes(r.id)).map((r) => ({ id: r.id, date: isoOr(r.date, isoDate()) }));
  // Habit log values: true (full habit) or a 1-based small-win level.
  s.habits.log = dateMap(s.habits.log, (v) => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k, x]) => habitIds.includes(k) && x).map(([k, x]) => [k, x === true ? true : Number.isInteger(x) && x >= 1 && x <= 3 ? x : true])) : null));
  s.mealLog = dateMap(s.mealLog, (v) => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([slot, e]) => /^(breakfast|lunch|dinner|snack\d?)$/.test(slot) && ['ate', 'skip', 'other'].includes(e?.status)).map(([slot, e]) => [slot, e.status === 'other' ? { status: 'other', kcal: num(e.kcal, 0, 10000, 0) } : { status: e.status }])) : null));
  const wl = s.workouts.log;
  s.workouts.log = dateMap(wl, (v) => (Array.isArray(v) ? v.filter((x) => x && ['strength', 'cardio', 'activity'].includes(x.kind)).map((x) => ({
    kind: x.kind,
    mode: x.kind === 'cardio' ? oneOf(x.mode, Object.keys(CARDIO), 'walk') : undefined,
    variant: x.kind === 'strength' ? oneOf(x.variant, ['A', 'B'], 'A') : undefined,
    name: x.kind === 'activity' ? String(x.name ?? 'Activity').slice(0, 40) : undefined,
    actId: x.kind === 'activity' && typeof x.actId === 'string' ? x.actId.slice(0, 24) : undefined,
    intensity: x.kind === 'activity' ? oneOf(x.intensity, ['easy', 'moderate', 'vigorous'], 'moderate') : undefined,
    minutes: num(x.minutes, 0, 600, 0),
    ratings: x.ratings && typeof x.ratings === 'object' ? x.ratings : undefined,
  })) : null));
  const prog = s.workouts.progress && typeof s.workouts.progress === 'object' ? s.workouts.progress : {};
  s.workouts.progress = Object.fromEntries(Object.entries(prog).filter(([k, v]) => k in CHAINS && CHAINS[k].steps.some((st) => st.id === v?.stepId)).map(([k, v]) => [k, { ...v, sets: num(v.sets, 1, 5, 2), reps: num(v.reps, 1, 120, 10), rightStreak: num(v.rightStreak, 0, 10, 0), history: Array.isArray(v.history) ? v.history.slice(-30) : [] }]));
  // Plans reference recipes by id; drop any plan containing an unknown recipe (it will be rebuilt).
  s.plans = Object.fromEntries(Object.entries(s.plans || {}).filter(([k, v]) => ISO.test(k) && Array.isArray(v?.days) && v.days.every((d) => Array.isArray(d) && d.every((m) => recipeIds.includes(m?.recipeId) && Number.isFinite(m.scale)))));
  return s;
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

const NUMBER_HABITS = new Set(['weigh_daily', 'log_meals']);
/** Active habits to show: in habits-only mode, weighing and calorie-logging habits are paused. */
export function visibleHabits(state) {
  return habitsOnly(state) ? state.habits.active.filter((a) => !NUMBER_HABITS.has(a.id)) : state.habits.active;
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
  const reset = state.resetUntil && date <= state.resetUntil ? state.resetAdjust || 0 : 0;
  return dailyTargets(p, { weightKg: calcWeight(state), kcalAdjust: (state.kcalAdjust || 0) + reset, tdeeOffset: state.tdeeOffset || 0, dietBreak });
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
  // Keep today's meals that were already eaten/logged or chosen by hand, so ticks and swaps survive.
  const overrides = {};
  const ti = (new Date(date + 'T12:00').getDay() + 6) % 7;
  if (existing?.days[ti] && addDays(wk, ti) === date) {
    const log = state.mealLog?.[date] || {};
    const keep = {};
    for (const m of existing.days[ti]) if (log[m.slot] || m.chosen) keep[m.slot] = m.recipeId;
    if (Object.keys(keep).length) overrides[ti] = keep;
  }
  const days = planWeek(t, state.prefs, wk, { overrides });
  for (const m of days[ti] || []) if (overrides[ti]?.[m.slot]) m.chosen = existing.days[ti].find((x) => x.slot === m.slot)?.chosen;
  // Keep days that are already in the past so history isn't rewritten.
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

/** Rewards summary (XP, level, streak, quests, badges) for a date. */
export function game(state, date = today()) {
  if (!state.profile) return null;
  return gameSummaryRaw(state, date, { habitsOnly: habitsOnly(state), trendKg: trendWeight(state) });
}

export { estimateTdee };
