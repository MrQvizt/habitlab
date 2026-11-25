// Small shared helpers. Pure functions only, so they run in the browser and in Node tests.

export const DAY_MS = 86400000;

export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export function round(x, step = 1) {
  return Number((Math.round(x / step) * step).toFixed(6));
}

/** ISO date string (YYYY-MM-DD) in local time. */
export function isoDate(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local-midnight Date. */
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
}

/** Monday of the week containing iso date. */
// ---------- The user's week ----------
// Weekdays are identified Monday = 0 … Sunday = 6 everywhere (plans, workouts, alarms). Where the
// week *starts* is the user's choice (prefs.weekStart): rings, Body Wraps, weekly targets, the meal
// plan and the shopping list all reset on that day.
let WEEK_START = 0;
export function setWeekStart(n) {
  WEEK_START = Number.isInteger(Number(n)) && n >= 0 && n <= 6 ? Number(n) : 0;
}
export function getWeekStart() {
  return WEEK_START;
}
/** Weekday of a date, Monday = 0. */
export function weekdayOf(iso) {
  return (parseDate(iso).getDay() + 6) % 7;
}
/** The first day of the week containing `iso`. */
export function weekStart(iso, start = WEEK_START) {
  const d = parseDate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6 - start + 7) % 7));
  return isoDate(d);
}
/** Weekday indices in the order the user's week runs, e.g. [6,0,1,2,3,4,5] for a Sunday start. */
export function weekOrder(start = WEEK_START) {
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
}
/** The date of weekday `wd` (Monday = 0) in the week starting `ws`. */
export function dateInWeek(ws, wd) {
  return addDays(ws, (wd - weekdayOf(ws) + 7) % 7);
}
/** The meal-plan day for a date: from the week that contains it (survives a change of week start). */
export function planDayFor(state, date) {
  const plans = state.plans || {};
  let plan = plans[weekStart(date)];
  if (!plan?.days) {
    const key = Object.keys(plans).filter((k) => k <= date && daysBetween(k, date) < 7).sort().pop();
    plan = key ? plans[key] : null;
  }
  return plan?.days?.[weekdayOf(date)] || [];
}

/** Deterministic PRNG (mulberry32) so a week's plan is stable until the user changes something. */
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed));
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

/** Least-squares slope of y against x. */
export function slope(points) {
  const n = points.length;
  if (n < 2) return NaN;
  const mx = mean(points.map((p) => p[0]));
  const my = mean(points.map((p) => p[1]));
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  return den === 0 ? NaN : num / den;
}

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const kgToLb = (kg) => kg / KG_PER_LB;
export const lbToKg = (lb) => lb * KG_PER_LB;
export const cmToIn = (cm) => cm / CM_PER_IN;
export const inToCm = (inch) => inch * CM_PER_IN;
