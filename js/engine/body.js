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
  s.alcohol = h('alcohol_limit');
  s.stepGoal = goal;
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

// ---------- What each body part needs, and how to help it ----------
// rows(stats) → what fills the ring this week: [label, value, target, unit]
export const ORGAN_GUIDE = {
  heart: {
    needs: '150 active minutes a week. Brisk walks, cycling, swimming, dancing and hobbies all count, and vigorous minutes count double.',
    rows: (s) => [['Active minutes', Math.round(s.activeMin), 150, 'min']],
    tips: ['A 20-minute brisk walk on most days covers it.', 'Hobbies count: add the ones you already do in Move.', 'Breathing harder but still able to talk = moderate.'],
    actions: [['Plan this week’s movement', '#/move'], ['Add an activity you already do', '#/move']],
  },
  muscle: {
    needs: 'Two strength sessions a week, plus protein at each meal so muscle is kept while you lose fat.',
    rows: (s) => [['Strength sessions', s.strength, 2, '']],
    tips: ['Even one set of each exercise counts as a session.', 'Climbing, heavy gardening and yoga can count too.', 'A palm of protein at every meal helps.'],
    actions: [['Start a strength session', '#/move']],
  },
  brain: {
    needs: 'Movement on most days and a calm wind-down before bed. Both lift mood and support memory and focus.',
    rows: (s) => [['Days with movement', s.activeDays, 5, 'days'], ['Wind-down habits', s.wind, 3, '']],
    tips: ['Any movement counts: a walk, your step goal or a session.', 'Screens off 30 minutes before bed helps sleep.', 'Two minutes of slow breathing when stressed.'],
    actions: [['Set a wind-down reminder', '#/settings/alarms'], ['Add a sleep or stress habit', '#/habits']],
  },
  knees: {
    needs: 'Regular steps and, over time, a lighter load: every kilo lost takes about 4 kg off your knees with each step.',
    rows: (s) => (s.stepLogged ? [['Steps', s.steps, s.stepGoal * Math.max(1, s.days), '']] : [['Days with movement', s.activeDays, 5, 'days']]),
    tips: ['Log your steps each day to fill this ring.', 'Walking is kind to knees; build up gradually.', 'Strong thigh muscles protect the knee joint.'],
    actions: [['Log today’s steps', '#/today']],
  },
  gut: {
    needs: '25 g of fibre a day from vegetables, fruit, beans, lentils and whole grains. Your gut microbes feed on it.',
    rows: (s) => [['Fibre per day', Math.round(s.fibreAvg), 25, 'g'], ['Days with meals logged', s.fibreDays, 4, 'days'], ['Veg-first meals', s.vegDays, 7, '']],
    tips: ['Tick off the meals you eat so their fibre counts.', 'Half a plate of veg adds 5–10 g.', 'Beans or lentils in one meal is a big boost.'],
    actions: [['See this week’s meals', '#/meals'], ['Add a veg habit', '#/habits']],
  },
  sugar: {
    needs: 'Movement, steady meals and fewer sugary drinks keep blood sugar on an even keel and cut diabetes risk.',
    rows: (s) => [['Active days', s.activeDays, 5, 'days'], ['Sugary drinks swapped', s.swaps, 7, ''], ['Walks after meals', s.mealWalks, 7, '']],
    tips: ['A 10-minute walk after your biggest meal helps.', 'Swap one sugary drink for water.', 'Regular meal times avoid big swings.'],
    actions: [['Add “water instead of sugary drinks”', '#/habits'], ['Add “walk after a meal”', '#/habits']],
  },
  kidneys: {
    needs: 'Kidneys are protected by keeping blood pressure and blood sugar healthy: moving more, water instead of sugary drinks and a healthier weight.',
    rows: (s) => [['Active days', s.activeDays, 5, 'days'], ['Water swaps', s.swaps, 7, ''], ['Alcohol kept to plan', s.alcohol, 7, '']],
    tips: ['Choose water first.', 'Keep alcohol to planned days.', 'Every active day helps your blood pressure.'],
    actions: [['Add “water instead of sugary drinks”', '#/habits'], ['Add “keep alcohol to planned days”', '#/habits']],
  },
};

// ---------- Long-term body levels ----------
// Each week a body part earns points for how full its ring got (capped at 100, so overdoing one
// week doesn't beat showing up every week) plus a consistency bonus for back-to-back weeks at
// half-full or more: +10 per week in the run, up to +50. Habits form through repetition, so the
// steady weeks are what level a body part up.
export const LEVEL_TITLES = ['Waking up', 'Warming up', 'Getting going', 'Steady', 'Strong', 'Thriving', 'Resilient', 'Powerhouse', 'Elite', 'Legendary'];
export const bodyLevelStart = (n) => 50 * n * (n - 1); // 0, 100, 300, 600, 1000, 1500 …
export function bodyLevelOf(points) {
  let n = 1;
  while (bodyLevelStart(n + 1) <= points) n++;
  return n;
}
export const bodyLevelTitle = (n) => (n <= LEVEL_TITLES.length ? LEVEL_TITLES[n - 1] : `Legendary ${n - LEVEL_TITLES.length + 1}`);
export function weekPoints(pct, streakBefore) {
  const base = Math.round(Math.min(1, Math.max(0, pct)) * 100);
  const bonus = pct >= 0.5 ? Math.min(50, 10 * streakBefore) : 0;
  return { base, bonus, total: base + bonus };
}

/**
 * Everything long-term about the body: thank-you counts per finished week (for medals and badges)
 * and levels from every week so far, this week included (so the meter moves as you go).
 */
export function bodyCollection(state, today, { habitsOnly = false } = {}) {
  const p = state.profile || {};
  const counts = Object.fromEntries(ORGANS.map((o) => [o.id, 0]));
  const closedCounts = Object.fromEntries(ORGANS.map((o) => [o.id, 0]));
  const prog = Object.fromEntries(ORGANS.map((o) => [o.id, { points: 0, streak: 0, best: 0, history: [], thisWeek: 0, thisWeekPts: 0 }]));
  let allClosed = 0;
  let weeks = 0;
  const finish = () => {
    const levels = {};
    for (const o of ORGANS) {
      const g = prog[o.id];
      const level = bodyLevelOf(g.points);
      levels[o.id] = { ...g, level, title: bodyLevelTitle(level), into: g.points - bodyLevelStart(level), need: bodyLevelStart(level + 1) - bodyLevelStart(level), history: g.history.slice(-12) };
    }
    return { counts, closedCounts, allClosed, weeks, levels };
  };
  if (!p.startDate) return finish();
  const series = trendSeries(state.weights || []);
  const cur = weekStart(today);
  const last = addDays(cur, -7);
  let first = weekStart(p.startDate);
  if (daysBetween(first, cur) > 7 * 160) first = addDays(cur, -7 * 160);
  for (let ws = first; ws <= cur; ws = addDays(ws, 7)) {
    const current = ws === cur;
    const w = weekBody(state, ws, { habitsOnly, series, ...(current ? { asOf: today } : {}) });
    if (!current) weeks++;
    for (const o of w.organs) {
      const g = prog[o.id];
      const pts = weekPoints(o.pct, g.streak);
      g.points += pts.total;
      g.history.push({ ws, pct: o.pct });
      if (current) {
        g.thisWeek = o.pct;
        g.thisWeekPts = pts.total;
      } else {
        g.streak = o.pct >= 0.5 ? g.streak + 1 : 0;
        g.best = Math.max(g.best, g.streak);
        if (o.earned) counts[o.id]++;
        if (o.closed) closedCounts[o.id]++;
      }
    }
    if (!current && w.organs.every((o) => o.closed)) allClosed++;
    if (ws > last && !current) break;
  }
  return finish();
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
