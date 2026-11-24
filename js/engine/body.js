// Body Wrap: what a week of food, movement and habits did for your body, organ by organ.
// Each "organ" has a ring (like activity rings) filled by logged behaviours, and a one-line research
// fact with its source (keys of the source list in data/learn.js). Claims stay at the level of the
// evidence: "linked to", "lowers risk", never promises about one person.
import { addDays, daysBetween, parseDate, weekStart } from './util.js';
import { creditedMinutes, stepGoal } from './workouts.js';
import { byId, scaledNutrition } from './meals.js';
import { trendSeries } from './trend.js';
import { hobbyByName } from '../data/hobbies.js';

export const KNEE_FACTOR = 4; // each kg lost ≈ 4 kg less load on the knee per step (Messier 2005)
export const FIBRE_TARGET = 25;

const tier = (pct) => (pct >= 1 ? 2 : pct >= 0.5 ? 1 : pct > 0 ? 0 : -1);

export const ORGANS = [
  { id: 'heart', name: 'Heart', emoji: '❤️', color: '#ff375f', color2: '#ff7a59',
    heads: ['Your heart noticed', 'Your heart says thanks', 'Your heart is throwing a party'],
    fact: '150+ active minutes a week is linked to less heart disease, stroke and type 2 diabetes.', src: 'who',
    tip: 'One extra 20-minute brisk walk on three days gets you there.' },
  { id: 'muscle', name: 'Muscles', emoji: '💪', color: '#0a84ff', color2: '#5e5ce6',
    heads: ['Your muscles felt that', 'Your muscles say thanks', 'Your muscles are flexing'],
    fact: 'Strength work while losing weight protects muscle, so more of what you lose is fat.', src: 'lopez',
    tip: 'Two short strength sessions a week is the target. Even one set of each exercise counts.' },
  { id: 'brain', name: 'Brain', emoji: '🧠', color: '#bf5af2', color2: '#5e5ce6',
    heads: ['Your brain noticed', 'Your brain says thanks', 'Your brain is glowing'],
    fact: 'Regular movement lowers symptoms of depression and anxiety and supports thinking and memory.', src: 'who',
    tip: 'Move a little on five days, and try one wind-down habit before bed.' },
  { id: 'knees', name: 'Knees', emoji: '🦵', color: '#ff9f0a', color2: '#ffd60a',
    heads: ['Your knees noticed', 'Your knees say thanks', 'Your knees are dancing'],
    fact: 'Every kilo lost takes about 4 kg of load off your knees with every single step.', src: 'messier2005',
    tip: 'Log your steps each day — your knees love the maths.' },
  { id: 'gut', name: 'Gut', emoji: '🌿', color: '#30d158', color2: '#66d4cf',
    heads: ['Your gut noticed', 'Your gut says thanks', 'Your gut microbes are partying'],
    fact: '25–29 g of fibre a day is linked to 15–30% less heart disease, stroke, type 2 diabetes and bowel cancer.', src: 'reynolds',
    tip: 'Half a plate of veg at dinner, or beans in one meal, adds 5–10 g of fibre.' },
  { id: 'sugar', name: 'Blood sugar', emoji: '🩸', color: '#ff2d55', color2: '#bf5af2',
    heads: ['Your blood sugar noticed', 'Your blood sugar says thanks', 'Your blood sugar is cruising'],
    fact: 'Moving 150 minutes a week and losing 7% cut new type 2 diabetes by 58% in the DPP trial.', src: 'dpp',
    tip: 'A 10-minute walk after your biggest meal, or one sugary drink swapped for water.' },
  { id: 'kidneys', name: 'Kidneys', emoji: '🫘', color: '#64d2ff', color2: '#0a84ff',
    heads: ['Your kidneys noticed', 'Your kidneys say thanks', 'Your kidneys are high-fiving'],
    fact: 'Diabetes and high blood pressure are the top causes of kidney disease. Moving more and a healthier weight help protect them.', src: 'niddk',
    tip: 'Water instead of sugary drinks, and an active day or two more.' },
];
export const organById = (id) => ORGANS.find((o) => o.id === id);

function plannedMeals(state, date) {
  const plan = state.plans?.[weekStart(date)];
  return plan?.days?.[(parseDate(date).getDay() + 6) % 7] || [];
}

function isStrength(state, w) {
  if (w.kind === 'strength') return true;
  if (w.kind !== 'activity') return false;
  const act = (state.profile?.activities || []).find((a) => a.id === w.actId);
  return !!(act?.strength || hobbyByName(w.name)?.strength);
}

/** Trend weight on a date (last smoothed value on or before it). */
function trendOn(series, date) {
  let t = null;
  for (const s of series) {
    if (s.date > date) break;
    t = s.trend;
  }
  return t;
}

/**
 * One week of body stats and organ rings.
 * @param ws Monday of the week; `asOf` limits the days counted (for a week still in progress)
 */
export function weekBody(state, ws, { asOf = addDays(ws, 6), habitsOnly = false, series = null } = {}) {
  const p = state.profile || {};
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    if (d <= asOf && (!p.startDate || d >= p.startDate)) days.push(d);
  }
  const goal = stepGoal(p.baselineSteps, p.stepLevel || 0, p.age);
  const s = { days: days.length, activeMin: 0, strength: 0, activeDays: 0, steps: 0, stepDays: 0, stepLogged: 0, fibre: 0, fibreDays: 0, mealsLogged: 0, fullDays: 0, habit: {}, habitTicks: 0 };
  for (const d of days) {
    const log = state.workouts?.log?.[d] || [];
    const mins = log.reduce((a, w) => a + creditedMinutes(w), 0);
    s.activeMin += mins;
    s.strength += log.filter((w) => isStrength(state, w)).length;
    const st = state.steps?.[d] || 0;
    if (st) s.stepLogged++;
    s.steps += st;
    if (st >= goal) s.stepDays++;
    if (log.length || st >= goal) s.activeDays++;
    const ml = state.mealLog?.[d] || {};
    const meals = plannedMeals(state, d);
    let fib = 0;
    let ate = 0;
    for (const m of meals) {
      if (ml[m.slot]?.status !== 'ate') continue;
      const r = byId(m.recipeId);
      if (r) fib += scaledNutrition(r, m.scale).fib;
      ate++;
    }
    s.mealsLogged += meals.filter((m) => ml[m.slot]).length;
    if (meals.length && meals.every((m) => ml[m.slot])) s.fullDays++;
    if (ate) {
      s.fibre += fib;
      s.fibreDays++;
    }
    for (const id of Object.keys(state.habits?.log?.[d] || {})) {
      s.habit[id] = (s.habit[id] || 0) + 1;
      s.habitTicks++;
    }
  }
  const h = (...ids) => ids.reduce((a, id) => a + (s.habit[id] || 0), 0);
  s.fibreAvg = s.fibreDays ? s.fibre / s.fibreDays : 0;
  s.swaps = h('water_meals');
  s.mealWalks = h('walk_after_meal');
  s.wind = h('sleep_window', 'screens_off', 'stress_reset');
  s.vegDays = h('veg_half', 'protein_first');
  // Weight (hidden in habits-only mode)
  const ser = series || trendSeries(state.weights || []);
  const endTrend = habitsOnly ? null : trendOn(ser, days[days.length - 1] || asOf);
  const startW = p.startWeightKg ?? p.weightKg;
  s.lostKg = endTrend != null && startW ? Math.max(0, startW - endTrend) : 0;
  s.lostPct = startW ? (s.lostKg / startW) * 100 : 0;
  s.kneeKgPerStep = s.lostKg * KNEE_FACTOR;
  s.kneeTonnes = (s.kneeKgPerStep * s.steps) / 1000;

  const stepTarget = goal * Math.max(1, s.days);
  const ring = {
    heart: s.activeMin / 150,
    muscle: s.strength / 2,
    brain: (s.activeDays + s.wind * 0.5) / 5,
    knees: s.stepLogged ? s.steps / stepTarget : s.activeDays / 5,
    gut: (s.fibreAvg / FIBRE_TARGET) * (s.fibreDays ? Math.min(1, s.fibreDays / 4) : 0) + s.vegDays * 0.05,
    sugar: (s.activeDays + s.swaps + s.mealWalks) / 7,
    kidneys: (s.activeDays + s.swaps + h('alcohol_limit')) / 7 + (s.lostPct >= 5 ? 0.25 : 0),
  };
  const fmtN = (n) => Math.round(n).toLocaleString();
  const stat = {
    heart: [`${fmtN(s.activeMin)} min`, `active minutes · ${Math.round(ring.heart * 100)}% of the weekly target`],
    muscle: [`${s.strength}`, `strength session${s.strength === 1 ? '' : 's'} · target 2`],
    brain: [`${s.activeDays} day${s.activeDays === 1 ? '' : 's'}`, `with movement${s.wind ? ` · ${s.wind} wind-down habit${s.wind === 1 ? '' : 's'}` : ''}`],
    knees: s.kneeKgPerStep >= 1 && s.steps
      ? [`${s.kneeTonnes >= 10 ? fmtN(s.kneeTonnes) : s.kneeTonnes.toFixed(1)} t`, `less load on your knees this week: ${fmtN(s.steps)} steps, each ${fmtN(s.kneeKgPerStep)} kg lighter`]
      : s.kneeKgPerStep >= 1
        ? [`−${fmtN(s.kneeKgPerStep)} kg`, 'less load on your knees with every step since you started']
        : s.stepLogged ? [`${fmtN(s.steps)}`, 'steps this week'] : [`${s.activeDays} day${s.activeDays === 1 ? '' : 's'}`, 'of movement for your joints'],
    gut: [`${Math.round(s.fibreAvg)} g`, `fibre a day from logged meals${s.vegDays ? ` · ${s.vegDays} veg-first meal${s.vegDays === 1 ? '' : 's'}` : ''}`],
    sugar: [`${s.activeDays + s.swaps + s.mealWalks}`, [s.activeDays && `${s.activeDays} active day${s.activeDays === 1 ? '' : 's'}`, s.swaps && `${s.swaps} sugary drink swap${s.swaps === 1 ? '' : 's'}`, s.mealWalks && `${s.mealWalks} after-meal walk${s.mealWalks === 1 ? '' : 's'}`].filter(Boolean).join(' · ') || 'sugar-steadying moves'],
    kidneys: [`${s.activeDays + s.swaps + h('alcohol_limit')}`, [s.activeDays && `${s.activeDays} active day${s.activeDays === 1 ? '' : 's'}`, s.swaps && `${s.swaps} water swap${s.swaps === 1 ? '' : 's'}`, h('alcohol_limit') && 'alcohol kept to plan'].filter(Boolean).join(' · ') || 'kidney-friendly moves'],
  };
  const organs = ORGANS.filter((o) => !(habitsOnly && o.id === 'knees' && !s.stepLogged)).map((o) => {
    const pct = Math.max(0, ring[o.id] || 0);
    const t = tier(pct);
    return { ...o, pct, closed: pct >= 1, earned: t >= 1, tier: t, head: t >= 0 ? o.heads[t] : `${o.name}: waiting for you`, big: stat[o.id][0], sub: stat[o.id][1] };
  });
  // Knees always get a thank-you once you've lost weight: the load drop is real every step.
  const knees = organs.find((o) => o.id === 'knees');
  if (knees && s.kneeKgPerStep >= 2 && !knees.earned) Object.assign(knees, { earned: true, tier: 1, head: knees.heads[1] });
  const earned = organs.filter((o) => o.earned).sort((a, b) => b.pct - a.pct);
  const closed = organs.filter((o) => o.closed).length;
  const nudge = organs.filter((o) => !o.closed).sort((a, b) => a.pct - b.pct)[0] || null;
  return { ws, stats: s, organs, earned, closed, nudge, partial: asOf < addDays(ws, 6), score: earned.length };
}

/** Monday of last week, if that week is wrappable (it ended and overlaps the plan). */
export function lastWeekStart(state, today) {
  const ws = addDays(weekStart(today), -7);
  const start = state.profile?.startDate;
  return start && addDays(ws, 6) >= start ? ws : null;
}

/** Organs thanked across all finished weeks: {organId: weeks}, plus full-body weeks. */
export function bodyCollection(state, today, { habitsOnly = false } = {}) {
  const p = state.profile || {};
  const counts = Object.fromEntries(ORGANS.map((o) => [o.id, 0]));
  const closedCounts = Object.fromEntries(ORGANS.map((o) => [o.id, 0]));
  let allClosed = 0;
  let weeks = 0;
  if (!p.startDate) return { counts, closedCounts, allClosed, weeks };
  const series = trendSeries(state.weights || []);
  const last = addDays(weekStart(today), -7);
  for (let ws = weekStart(p.startDate); ws <= last && daysBetween(ws, last) < 7 * 160; ws = addDays(ws, 7)) {
    const w = weekBody(state, ws, { habitsOnly, series });
    weeks++;
    for (const o of w.organs) {
      if (o.earned) counts[o.id]++;
      if (o.closed) closedCounts[o.id]++;
    }
    if (w.organs.every((o) => o.closed)) allClosed++;
  }
  return { counts, closedCounts, allClosed, weeks };
}

export const MEDALS = [
  { n: 1, name: 'Bronze', color: '#c7814b' },
  { n: 4, name: 'Silver', color: '#a9b4bd' },
  { n: 12, name: 'Gold', color: '#f5c242' },
  { n: 26, name: 'Platinum', color: '#9fe3ff' },
];
export function medalFor(n) {
  return [...MEDALS].reverse().find((m) => n >= m.n) || null;
}
export function nextMedal(n) {
  return MEDALS.find((m) => n < m.n) || null;
}
