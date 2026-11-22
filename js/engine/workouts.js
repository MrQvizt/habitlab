// Workout programming: chooses the right rung of each progression chain for the person's
// equipment and joints, builds a weekly schedule, and progresses or regresses from feedback.
import { CHAINS, CARDIO } from '../data/exercises.js';
import { clamp, round } from './util.js';

export const REP_RANGE = { min: 8, max: 15 };
export const TIME_RANGE = { min: 15, max: 60, step: 5 };
const EQUIP_RANK = { none: 0, bands: 1, dumbbells: 2, gym: 3 };

/** Rungs of a chain this person can do, easiest first. */
export function availableSteps(chainKey, profile) {
  const have = new Set(['none', ...(profile.equipment || [])]);
  const limits = new Set(profile.limitations || []);
  return CHAINS[chainKey].steps.filter((s) => have.has(s.equip) && !s.avoid.some((a) => limits.has(a)));
}

/** Starting state per chain. Beginners start at the first rung; people with some training start higher. */
export function initialProgress(profile) {
  const exp = profile.experience || 'none';
  const progress = {};
  for (const key of Object.keys(CHAINS)) {
    const steps = availableSteps(key, profile);
    if (!steps.length) continue;
    let level = exp === 'some' ? 1 : exp === 'regular' ? 2 : 0;
    level = clamp(level, 0, steps.length - 1);
    const step = steps[level];
    progress[key] = {
      stepId: step.id,
      sets: exp === 'regular' ? 3 : 2,
      reps: step.type === 'time' ? 20 : 10,
      rightStreak: 0,
      history: [],
    };
  }
  return progress;
}

export function stepOf(chainKey, stepId) {
  return CHAINS[chainKey].steps.find((s) => s.id === stepId);
}

/**
 * Apply one feedback rating to a chain. Double progression: reps first, then sets, then a harder rung.
 * rating: 'easy' | 'right' | 'hard' | 'pain'
 */
export function progressChain(state, chainKey, rating, profile, date) {
  const steps = availableSteps(chainKey, profile);
  let idx = steps.findIndex((s) => s.id === state.stepId);
  if (idx < 0) idx = 0;
  const step = steps[idx];
  const timed = step.type === 'time';
  const s = { ...state, history: [...(state.history || []), { date, rating, stepId: state.stepId, sets: state.sets, reps: state.reps }].slice(-30) };
  const top = timed ? TIME_RANGE.max : REP_RANGE.max;
  const bottom = timed ? TIME_RANGE.min : REP_RANGE.min;
  const inc = timed ? TIME_RANGE.step : 2;
  const levelUp = () => {
    if (s.sets < 3) {
      s.sets += 1;
      s.reps = timed ? 20 : 10;
    } else if (idx < steps.length - 1) {
      s.stepId = steps[idx + 1].id;
      s.sets = 2;
      s.reps = steps[idx + 1].type === 'time' ? 20 : 8;
      s.leveledUp = true;
    } else {
      s.reps = top; // at the top of the chain: keep it, add load/tempo outside the app
    }
  };
  s.leveledUp = false;
  if (rating === 'easy') {
    s.rightStreak = 0;
    if (s.reps + inc > top) levelUp();
    else s.reps += inc;
  } else if (rating === 'right') {
    s.rightStreak = (s.rightStreak || 0) + 1;
    if (s.rightStreak >= 2) {
      s.rightStreak = 0;
      if (s.reps + (timed ? 5 : 1) > top) levelUp();
      else s.reps += timed ? 5 : 1;
    }
  } else if (rating === 'hard') {
    s.rightStreak = 0;
    if (s.reps - inc < bottom) {
      if (idx > 0) {
        s.stepId = steps[idx - 1].id;
        s.reps = steps[idx - 1].type === 'time' ? 30 : 12;
      } else {
        s.reps = bottom;
        s.sets = Math.max(1, s.sets - 1);
      }
    } else s.reps -= inc;
  } else if (rating === 'pain') {
    // Pain (not effort) → step back a rung and flag for review.
    s.rightStreak = 0;
    s.painFlag = date;
    if (idx > 0) s.stepId = steps[idx - 1].id;
    s.reps = timed ? 20 : 10;
    s.sets = Math.max(1, s.sets - 1);
  }
  return s;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Weekly cardio minutes target. Starts from current activity and grows ~10–15%/week
 * toward 150 min, then toward 250 min (the range linked with better long-term maintenance).
 */
export function cardioTarget(baselineMin, weeksIn, phase) {
  const start = Math.max(30, baselineMin || 0);
  const goal = phase === 'maintain' ? 250 : 200; // rule 13: 150 first, then 200–300 for loss and maintenance
  let m = start;
  // Rule 13: grow by ≤10–20 min/week (here max(10%, 10 min), never more than 20 min).
  for (let w = 0; w < weeksIn && m < goal; w++) m = Math.min(goal, m + clamp(m * 0.1, 10, 20));
  return round(Math.min(goal, m), 5);
}

/**
 * Daily step goal (rule 15): baseline + 500 now, +500 each time it is met on ≥5/7 days.
 * Capped where mortality benefits level off: ~10,000 under 60, ~8,000 at 60+ (Paluch 2022).
 */
export function stepGoal(baseline, level = 0, age = 40) {
  const cap = age >= 60 ? 8000 : 10000;
  return round(clamp((baseline || 4000) + 500 * (1 + (level || 0)), 2500, Math.max(cap, (baseline || 0))), 250);
}

/**
 * Build the week: strength sessions on non-consecutive available days, cardio on the rest.
 * @param profile {daysAvailable:[0..6], sessionMinutes, cardioPrefs:[...], ...}
 */
export function weekSchedule(profile, progress, weeksIn = 0) {
  const avail = (profile.daysAvailable?.length ? profile.daysAvailable : [0, 2, 4]).slice().sort((a, b) => a - b);
  // Rule 14: 2–3 whole-body sessions on non-consecutive days; week 1 is a single easy session.
  let nStrength = weeksIn === 0 ? 1 : avail.length >= 4 ? 3 : 2;
  let strengthDays = pickSpread(avail, Math.min(nStrength, avail.length));
  while (strengthDays.length > 1 && minGap(strengthDays) < 2) strengthDays = pickSpread(avail, strengthDays.length - 1);
  const cardioMin = cardioTarget(profile.baselineCardioMin, weeksIn, profile.phase) + (profile.cardioBonus || 0);
  const cardioDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !strengthDays.includes(d) || avail.length <= 2);
  // Strength sessions also include ~10 minutes of cardio-style warm-up/walk where time allows.
  const perCardioDay = Math.max(10, round(cardioMin / Math.max(1, Math.min(cardioDays.length, 5)), 5));
  const modes = (profile.cardioPrefs?.length ? profile.cardioPrefs : ['walk']).filter((m) => CARDIO[m]);
  const schedule = [];
  let ci = 0;
  let cardioLeft = cardioMin;
  for (let d = 0; d < 7; d++) {
    const day = { day: d, name: DAY_NAMES[d], items: [] };
    if (strengthDays.includes(d)) {
      const variant = strengthDays.indexOf(d) % 2 === 0 ? 'A' : 'B';
      day.items.push({ kind: 'strength', variant, minutes: Math.min(profile.sessionMinutes || 30, 45), exercises: sessionExercises(progress, variant, profile) });
    }
    if (cardioDays.includes(d) && cardioLeft > 0 && (avail.includes(d) || modes.includes('walk'))) {
      const mins = Math.min(perCardioDay, cardioLeft);
      cardioLeft -= mins;
      const mode = modes[ci++ % modes.length];
      day.items.push({ kind: 'cardio', mode, minutes: mins, label: CARDIO[mode].label });
    }
    if (!day.items.length) day.items.push({ kind: 'rest', minutes: 0 });
    schedule.push(day);
  }
  return { schedule, cardioMin, strengthDays };
}

function minGap(days) {
  if (days.length < 2) return 7;
  let g = 7;
  for (let i = 0; i < days.length; i++) g = Math.min(g, (i + 1 < days.length ? days[i + 1] : days[0] + 7) - days[i]);
  return g;
}

function pickSpread(days, n) {
  if (days.length <= n) return days.slice();
  // Choose n days maximising the minimum gap (wrapping around the week).
  let best = null;
  let bestGap = -1;
  const combos = (arr, k, start = 0, acc = []) => {
    if (acc.length === k) {
      const sorted = acc.slice();
      let minGap = 7;
      for (let i = 0; i < sorted.length; i++) {
        const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 7;
        minGap = Math.min(minGap, next - sorted[i]);
      }
      if (minGap > bestGap) {
        bestGap = minGap;
        best = sorted;
      }
      return;
    }
    for (let i = start; i < arr.length; i++) combos(arr, k, i + 1, [...acc, arr[i]]);
  };
  combos(days, n);
  return best;
}

/** Session A: squat, push, hinge, pull, core. Session B: single-leg, push, hinge, pull, carry/core. */
export function sessionExercises(progress, variant, profile) {
  const order = variant === 'A' ? ['squat', 'push', 'hinge', 'pull', 'core'] : ['lunge', 'push', 'hinge', 'pull', 'carry'];
  const out = [];
  for (const key of order) {
    let chainKey = key;
    if (!progress[chainKey]) chainKey = key === 'lunge' ? 'squat' : key === 'carry' ? 'core' : key;
    const st = progress[chainKey];
    if (!st) continue;
    const step = stepOf(chainKey, st.stepId);
    if (!step) continue;
    out.push({ chain: chainKey, stepId: step.id, name: step.name, how: step.how, type: step.type, perSide: step.perSide, sets: st.sets, reps: st.reps });
  }
  return out;
}
