// Weight trend: exponentially smoothed daily series, so day-to-day water swings don't drive decisions.
import { addDays, daysBetween, slope } from './util.js';

export const ALPHA = 0.1; // smoothing per day (classic "Hacker's Diet" style 10% moving average)

/**
 * @param entries [{date: 'YYYY-MM-DD', kg}] (any order, may have gaps or duplicates)
 * @returns [{date, kg|null, trend}] one point per calendar day from first to last entry
 */
// Cached per weigh-in array (the app replaces arrays rather than editing them).
const seriesCache = new WeakMap();
export function trendSeries(entries) {
  if (Array.isArray(entries)) {
    // Also keyed on length and the last entry, so an in-place push or edit of the latest weigh-in
    // can never return a stale trend.
    const last = entries[entries.length - 1];
    const key = `${entries.length}|${last?.date}|${last?.kg}`;
    const hit = seriesCache.get(entries);
    if (hit && hit.key === key) return hit.out;
    const out = computeSeries(entries);
    seriesCache.set(entries, { key, out });
    return out;
  }
  return computeSeries(entries || []);
}

function computeSeries(entries) {
  const byDate = new Map();
  for (const e of entries) {
    if (e && Number.isFinite(e.kg) && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) byDate.set(e.date, e.kg); // last entry of the day wins
  }
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return [];
  const out = [];
  let trend = byDate.get(dates[0]);
  const total = daysBetween(dates[0], dates[dates.length - 1]);
  for (let i = 0; i <= total; i++) {
    const date = addDays(dates[0], i);
    const kg = byDate.has(date) ? byDate.get(date) : null;
    if (kg != null) trend = trend + ALPHA * (kg - trend);
    out.push({ date, kg, trend });
  }
  return out;
}

export function latestTrend(entries) {
  const s = trendSeries(entries);
  return s.length ? s[s.length - 1].trend : null;
}

/**
 * Rate of change in kg/week using a least-squares fit on the raw weigh-ins in the window.
 * Raw-weight regression avoids the lag of the smoothed series. Returns null if data is too thin.
 */
export function weeklyRate(entries, endDate, windowDays = 21, minPoints = 4, minSpanDays = 10) {
  const start = addDays(endDate, -windowDays);
  const pts = entries
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date > start && e.date <= endDate && Number.isFinite(e.kg))
    .map((e) => [daysBetween(start, e.date), e.kg]);
  if (pts.length < minPoints) return null;
  const span = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
  if (span < minSpanDays) return null;
  const s = slope(pts);
  return Number.isFinite(s) ? s * 7 : null;
}

/**
 * Observed TDEE (rule 6): TDEE_obs = mean logged intake − (Δtrend kg × 7700) / days,
 * computed only with ≥14 days in the window and ≥80% of those days logged.
 */
export function observedTdee(intakeByDate, weights, endDate, windowDays = 21, kcalPerKg = 7700) {
  const series = trendSeries(weights);
  if (!series.length) return null;
  const startDate = addDays(endDate, -windowDays + 1);
  const inWin = series.filter((p) => p.date >= startDate && p.date <= endDate);
  if (inWin.length < 14) return null;
  const days = inWin.length;
  const logged = inWin.filter((p) => intakeByDate[p.date] > 0);
  if (logged.length / days < 0.8) return null;
  const weighed = inWin.filter((p) => p.kg != null).length;
  if (weighed < 6) return null;
  const meanIntake = logged.reduce((a, p) => a + intakeByDate[p.date], 0) / logged.length;
  const dTrend = inWin[inWin.length - 1].trend - inWin[0].trend;
  const value = meanIntake - (dTrend * kcalPerKg) / days;
  return { value: Math.round(value), meanIntake: Math.round(meanIntake), days, loggedDays: logged.length, dTrend };
}

/** Rule 6 blend: new = 0.7·old + 0.3·observed, change capped at ±150 kcal per update. */
export function blendTdee(currentTdee, observed) {
  const target = 0.7 * currentTdee + 0.3 * observed;
  const delta = Math.max(-150, Math.min(150, target - currentTdee));
  return Math.round(currentTdee + delta);
}
