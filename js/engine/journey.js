// The long journey: a suggested healthy goal, a realistic timeline (even when it's years), and
// stops along the way, so the whole thing breaks into steps you can see yourself reaching.
//   - Goal: the top of the healthy BMI range (WHO: 18.5–24.9), the nearest healthy weight.
//   - Timeline: projectCurve (calc.js), which slows down as energy needs fall (Hall 2011). Real life
//     adds plateaus, holidays and planned maintenance breaks, so we show a range: model … model × 1.3.
//   - Stops: time-based ("after a week you might notice…") and weight-based (5%, 10%, BMI classes),
//     each with an estimated date and what the research says you may notice or gain there.
import { bmi, weightAtBmi, projectCurve, MILESTONE_INFO } from './calc.js';
import { addDays, daysBetween } from './util.js';

export const HEALTHY_BMI = [18.5, 24.9];
export const SLACK = 1.3; // the upper end of the timeline range

export function healthyRange(heightCm) {
  return { lo: Math.ceil(weightAtBmi(HEALTHY_BMI[0], heightCm) * 2) / 2, hi: Math.floor(weightAtBmi(HEALTHY_BMI[1], heightCm) * 2) / 2 };
}

/** The suggested goal: the nearest healthy weight (top of the healthy BMI range), or null if already there. */
export function suggestedGoalKg(heightCm, weightKg) {
  if (!(heightCm > 100 && weightKg > 30)) return null;
  const { hi } = healthyRange(heightCm);
  return weightKg > hi + 0.5 ? hi : null;
}

/** "3 weeks", "5 months", "2 years", "4 years 5 months". */
export function fmtDuration(weeks) {
  if (weeks < 9) return `${Math.max(1, Math.round(weeks))} week${Math.round(weeks) === 1 ? '' : 's'}`;
  const months = Math.round(weeks / 4.345);
  if (months < 24) return `${months} months`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} year${y === 1 ? '' : 's'}${m ? ` ${m} month${m === 1 ? '' : 's'}` : ''}`;
}

/** Estimated time to goal as a range, e.g. "4 years 6 months – 5 years 10 months". */
export function timeline(profile, goalKg) {
  const c = projectCurve(profile, goalKg);
  const weeks = c.weights.length - 1;
  if (!c.reached) return { reached: false, weeks: null };
  return { reached: true, weeks, hiWeeks: Math.round(weeks * SLACK), text: weeks < 9 ? fmtDuration(weeks) : `${fmtDuration(weeks)} – ${fmtDuration(weeks * SLACK)}` };
}

// ---------- What you may notice along the way ----------
// Time stops are counted from the start date. `scale` is only shown when weight numbers are shown.
const TIME_STOPS = [
  { days: 7, title: 'One week in', learn: 'journey',
    text: 'Seven days of showing up. Regular meals often mean steadier energy and fewer late-afternoon cravings, and each tick makes the next one easier.',
    scale: 'The scale may already be down 1–2 kg. Part of that is water and stored carbohydrate — normal, and still a sign the plan is working.' },
  { days: 30, title: 'One month', learn: 'journey',
    text: 'Clothes may feel a little looser and the same walk a little easier: regular activity measurably improves fitness within a few weeks. The routine needs less thinking now.' },
  { days: 66, title: 'Habits on autopilot', learn: 'habits',
    text: 'On average a new daily habit becomes automatic after about 66 days. Around now, many of your routines start to run without willpower.' },
  { days: 91, title: 'Three months', learn: 'journey',
    text: 'A clear change in fitness: stairs and walks that were hard are easier, and blood pressure and blood sugar often start to improve. Others may begin to notice.' },
  { days: 182, title: 'Six months', learn: 'journey',
    text: 'This is the classic guideline checkpoint: a 5–10% loss in six months is a big success. Loss naturally slows around now as your body needs less energy — the weekly check-in adjusts, and a planned maintenance month is a smart option.' },
  { days: 365, title: 'One year', learn: 'maintenance',
    text: 'A full year of new habits. They are simply how you live now. People who keep weight off for two years greatly improve their odds of keeping it off for good.' },
];
const YEAR_TEXT = [
  'Another year of the same small habits. Every year at a lower weight means less strain on your heart, joints and blood sugar.',
  'You have practised these habits for years now — they are part of who you are. Keep the checkpoints coming.',
];

// Weight stops beyond the classic 5/7/10/15%.
const PCT_INFO = {
  ...MILESTONE_INFO,
  10: 'At 10%, the benefits grow: blood sugar, blood pressure and sleep apnoea improve further, and each kilo lost takes about 4 kg of load off your knees with every step.',
  20: 'A fifth of your starting weight. At this level, trials see big gains in everyday physical function and quality of life.',
  30: 'A loss this large is usually only seen after weight-loss surgery, where it is linked to remission of many conditions and longer life. You did it with habits.',
  40: 'Forty percent. Moving, sleeping, travelling and playing all feel different now.',
  50: 'Half of the weight you started with. An extraordinary, years-long achievement.',
};
const BMI_STOPS = [
  { bmi: 40, title: 'BMI under 40', text: 'Out of the highest obesity class. Health risks drop with every class you move through.' },
  { bmi: 35, title: 'BMI under 35', text: 'Another obesity class behind you, with lower risk for blood pressure, diabetes and joint problems.' },
  { bmi: 30, title: 'BMI under 30', text: 'Out of the obesity range altogether. A huge milestone, whatever happens next.' },
];

/**
 * The whole roadmap.
 * @param state app state (profile, weights)
 * @param opts {today, trendKg}
 * @returns {goalKg, suggested, total, lost, pct, timeline, stops:[{kind, title, text, scale?, date, weightKg?, reached, next, lostKg?}]}
 */
export function journey(state, { today, trendKg }) {
  const p = state.profile;
  const startKg = p.startWeightKg ?? p.weightKg;
  const suggested = suggestedGoalKg(p.heightCm, startKg);
  const goalKg = p.goalWeightKg || suggested;
  const now = trendKg ?? p.weightKg;
  const lost = Math.max(0, startKg - now);
  const daysIn = Math.max(0, daysBetween(p.startDate, today));
  // Re-project from where you are now, so dates stay honest if you're ahead or behind.
  const curve = goalKg && now > goalKg ? projectCurve({ ...p, weightKg: now, phase: 'lose' }, goalKg) : { weights: [now], reached: true };
  const tl = goalKg && now > goalKg ? timeline({ ...p, weightKg: now, phase: 'lose' }, goalKg) : { reached: true, weeks: 0, hiWeeks: 0, text: '' };
  const weekOf = (kg) => {
    const i = curve.weights.findIndex((w) => w <= kg + 1e-6);
    return i < 0 ? null : i;
  };
  const weightAt = (week) => curve.weights[Math.min(Math.max(0, week), curve.weights.length - 1)];

  const stops = [];
  // Time stops (only those within the journey, plus a yearly one until the goal).
  const endDay = daysIn + Math.round((curve.reached ? curve.weights.length - 1 : 156) * 7);
  const time = TIME_STOPS.filter((t) => t.days <= Math.max(endDay, 30));
  for (let y = 2; y * 365 < endDay; y++) time.push({ days: y * 365, title: `Year ${y}`, text: YEAR_TEXT[Math.min(y - 2, YEAR_TEXT.length - 1)], learn: 'maintenance' });
  for (const t of time) {
    const reached = daysIn >= t.days;
    const ahead = Math.round((t.days - daysIn) / 7);
    stops.push({ kind: 'time', title: t.title, text: t.text, scale: t.scale, learn: t.learn, date: addDays(p.startDate, t.days), reached,
      lostKg: reached ? null : Math.max(0, startKg - weightAt(ahead)) });
  }
  // Weight stops: % of starting weight, BMI classes, then the goal.
  const floor = goalKg || startKg * 0.85;
  const pcts = [5, 7, 10, 15, 20, 30, 40, 50].filter((x) => startKg * (1 - x / 100) > floor + 1);
  const weightStops = pcts.map((x) => ({ kind: 'weight', pct: x, title: `${x}% lighter`, text: PCT_INFO[x], weightKg: startKg * (1 - x / 100) }));
  for (const b of BMI_STOPS) {
    const kg = weightAtBmi(b.bmi, p.heightCm) - 0.1;
    if (bmi(startKg, p.heightCm) >= b.bmi && kg > floor + 1 && !weightStops.some((s) => Math.abs(s.weightKg - kg) < 1.5)) weightStops.push({ kind: 'weight', title: b.title, text: b.text, weightKg: kg });
  }
  if (goalKg) weightStops.push({ kind: 'goal', title: suggested && Math.abs(goalKg - suggested) < 0.6 ? 'Healthy weight — your goal' : 'Your goal', text: bmi(goalKg, p.heightCm) < 25 ? 'A healthy BMI for your height. From here the plan switches to keeping it: same habits, a little more food.' : 'The goal you set. From here the plan switches to keeping it — or set the next one.', weightKg: goalKg });
  for (const s of weightStops) {
    const reached = now <= s.weightKg + 0.05;
    const wk = reached ? 0 : weekOf(s.weightKg);
    stops.push({ ...s, reached, lostKg: startKg - s.weightKg, date: reached ? null : wk == null ? null : addDays(today, wk * 7) });
  }
  // Order: reached first (by when), then upcoming by date.
  const key = (s) => (s.date ? s.date : '9999') + (s.kind === 'time' ? '0' : '1');
  stops.sort((a, b) => (a.reached !== b.reached ? (a.reached ? -1 : 1) : key(a).localeCompare(key(b))));
  const next = stops.find((s) => !s.reached);
  if (next) next.next = true;
  return { goalKg, suggested, startKg, now, total: goalKg ? Math.max(0, startKg - goalKg) : 0, lost, pct: goalKg && startKg > goalKg ? Math.min(100, (lost / (startKg - goalKg)) * 100) : 0, timeline: tl, stops, daysIn };
}

/** The next weight stop and the next time stop (for the Today card). */
export function nextStops(j) {
  return { weight: j.stops.find((s) => !s.reached && s.kind !== 'time'), time: j.stops.find((s) => !s.reached && s.kind === 'time') };
}

/** A time stop reached in the last `days` days (to celebrate on Today). */
export function recentTimeStop(j, today, days = 6) {
  return j.stops.filter((s) => s.kind === 'time' && s.reached && daysBetween(s.date, today) <= days).pop() || null;
}
