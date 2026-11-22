// Weekly check-in: turns recent data into a few specific, optional adjustments.
// Rules implemented (see RESEARCH.md "Design rules"): 6 adaptive TDEE, 7 recalc by weight,
// 8 rate guardrails, 15 steps, 20 plateau flow, 21 early slow-responder support,
// 22 maintenance band, 23 sleep/alcohol, 24 tone, 25 safety re-screen, 26 medication-neutral.
// Principles: change one or two things at a time; when the plan isn't being followed,
// make it easier rather than stricter; never go below the floor.
import { weeklyRate, latestTrend, observedTdee, blendTdee } from './trend.js';
import { dailyTargets, estimateTdee } from './calc.js';
import { addDays, daysBetween, clamp } from './util.js';
import { stepGoal } from './workouts.js';

export const BARRIER_OPTIONS = {
  time: { label: 'Not enough time', fix: 'Pick two batch-cook recipes; use no-cook lunches; split workouts into 10-minute blocks.' },
  social: { label: 'Social events / eating out', fix: 'Check the menu in advance, choose a protein-and-veg dish, and decide on drinks before you arrive.' },
  cravings: { label: 'Cravings', fix: 'Put a planned treat into the plan, keep trigger foods out of the house, and wait 10 minutes with a glass of water before deciding.' },
  tired: { label: 'Too tired', fix: 'Move activity earlier in the day and protect sleep. On low days do the “tiny” version of each habit.' },
  mood: { label: 'Low mood / stress', fix: 'Pick one stress-reset habit. If low mood lasts more than two weeks, please talk to your doctor.' },
  pain: { label: 'Pain or injury', fix: 'Switch to very-low-impact cardio (bike, water, seated) and mark the painful joint in Settings so exercises adapt.' },
  family: { label: 'Household food', fix: 'Choose recipes everyone eats and adjust your portion; ask for treats to be kept out of sight.' },
  boredom: { label: 'Bored of the food', fix: 'Turn variety up, star favourites, and try one new recipe this week.' },
  hunger: { label: 'Hungry a lot', fix: 'Protein at every meal, soup or salad before dinner, more vegetables and fruit, and 5 smaller meals.' },
};

function fmt(kg) {
  return (Math.round(kg * 100) / 100).toFixed(2);
}

/**
 * Rule 8 tests "for 3 weeks" with one least-squares fit over the last 21 days of raw weigh-ins
 * (needs ≥8 weigh-ins). Shorter sub-windows are too noisy: daily water swings of ±0.7 kg make
 * 14-day slopes jump by ±0.4 kg/week, whereas a 21-day fit has a standard error of ~0.13 kg/week.
 */
function sustained(weights, today, trendKg, test) {
  const r = weeklyRate(weights, today, 21, 8, 14);
  return r != null && test((-r / trendKg) * 100);
}

/**
 * @param state app state (profile, weights, intake, checkins, prefs, kcalAdjust, tdeeOffset, …)
 * @param answers {adherence 1–5, hunger 1–5, energy 1–5, sleepHours, stress 1–5, drinksPerDay, barriers[], edFlags[]}
 */
export function weeklyReview(state, answers, today, opts = {}) {
  const p = state.profile;
  const recs = [];
  const weights = state.weights || [];
  const trendKg = latestTrend(weights) ?? p.weightKg;
  const rate = weeklyRate(weights, today, 21); // kg/week, negative = losing
  const loss = rate == null ? null : -rate;
  const pctWeek = loss == null ? null : (loss / trendKg) * 100;
  const adherence = answers.adherence ?? 3;
  const hunger = answers.hunger ?? 3;
  const goodAdherence = adherence >= 4;
  const onMeds = p.medical?.includes('glp1');
  const maintaining = p.phase === 'maintain';
  const breakActive = state.dietBreakUntil && today <= state.dietBreakUntil;
  // Habits-only mode (pregnancy, eating-disorder flags…): no calorie, weight-rate or TDEE items at all.
  const habitsOnly = !!opts.habitsOnly;
  // Rule 6 "every 7 days": numeric adjustments are offered at most once a week, so repeating
  // the check-in can't stack cuts.
  const lastApplied = (state.checkins || []).map((c) => c.date).filter((d) => d <= today).sort().pop();
  const tooSoon = lastApplied && daysBetween(lastApplied, today) < 7;

  // ----- Rule 25: safety re-screen (eating-disorder warning signs)
  if ((answers.edFlags || []).length) {
    recs.push({
      id: 'ed', type: 'safety', priority: -1, preselect: true,
      title: 'Let’s look after you first',
      body: 'You mentioned some experiences (like losing control while eating, making up for eating, or feeling your worth depends on your weight) that are worth talking through with a professional. Calorie targets will be hidden and the app will focus on regular meals and wellbeing habits. In the UK you can contact Beat (beateatingdisorders.org.uk); in the US, the ANAD helpline (anad.org). Your doctor can help too.',
    });
  }

  // ----- Rule 6: learned TDEE from intake logs and trend
  const formula = estimateTdee(p, trendKg).tdee;
  const currentTdee = formula + (state.tdeeOffset || 0);
  const obs = observedTdee(state.intake || {}, weights, today);
  if (obs && adherence >= 3) {
    const next = blendTdee(currentTdee, obs.value);
    if (Math.abs(next - currentTdee) >= 25) {
      recs.push({
        id: 'tdee', type: 'tdee', offset: Math.round(next - formula), priority: 2, preselect: true,
        title: `Your energy estimate updated: ${Math.round(currentTdee)} → ${next} kcal/day`,
        body: `From ${obs.loggedDays} logged days (average ${obs.meanIntake} kcal) and your weight trend, your body seems to use about ${obs.value} kcal/day. The app moves 30% of the way toward that each week (max 150 kcal), so one odd week can’t swing your plan.`,
      });
    }
  }

  // ----- Rule 22: goal reached → maintenance; maintenance band
  if (!maintaining && p.goalWeightKg && trendKg <= p.goalWeightKg) {
    recs.push({
      id: 'maintain', type: 'phase', phase: 'maintain', priority: 0, preselect: true,
      title: 'You reached your goal — switch to maintenance',
      body: 'Your trend weight is at your goal. Calories rise to your estimated needs, activity aims for 200–300 minutes a week, and you keep weighing in — the habits shared by people who keep weight off long-term.',
    });
  }
  if (maintaining && state.maintainKg && trendKg > state.maintainKg + 2) {
    recs.push({
      id: 'reset', type: 'reset', priority: 0, preselect: true,
      title: `Trend is ${fmt(trendKg - state.maintainKg)} kg above your maintenance weight`,
      body: 'This is the early-warning band. Time for a short reset: restart meal logging for two weeks, check activity minutes, and pick one barrier to problem-solve below. A small calorie trim (−200) is applied for two weeks if you accept.',
      delta: -200,
    });
  }

  if (loss == null && !maintaining) {
    recs.push({ id: 'data', type: 'info', priority: 5, title: 'Keep weighing in', body: 'There aren’t enough weigh-ins in the last 3 weeks to judge your rate yet (need 4+ across 10+ days). No calorie changes this week.' });
  }

  // ----- Low adherence → simplify, never cut
  if (adherence <= 2) {
    recs.push({
      id: 'simplify', type: 'prefs', priority: 1, preselect: true,
      title: 'Make the plan easier, not stricter',
      body: 'Following the plan was hard this week — that’s useful information, not failure. Cutting calories now would make it harder. Instead the plan will repeat favourite meals (cook once, eat twice) and you can focus on just one habit.',
      apply: { variety: 'low' },
    });
  }
  if ((answers.barriers || []).length) {
    recs.push({
      id: 'barriers', type: 'info', priority: 2,
      title: 'Your plan for this week’s barriers',
      body: answers.barriers.filter((b) => BARRIER_OPTIONS[b]).map((b) => `• ${BARRIER_OPTIONS[b].label}: ${BARRIER_OPTIONS[b].fix}`).join('\n'),
    });
  }

  if (!maintaining && !breakActive && loss != null) {
    // ----- Rule 8a: too fast for 3 weeks
    const tooFast = sustained(weights, today, trendKg, (pct) => pct > 1.0);
    // ----- Rule 8b / 20: plateau (<0.25%/week for 3 weeks with good adherence)
    const plateau = sustained(weights, today, trendKg, (pct) => pct < 0.25);
    if (tooFast) {
      recs.push({
        id: 'too_fast', type: 'kcal', delta: +150, priority: 0, preselect: true,
        title: `Losing fast (${fmt(loss)} kg/week) — eat a little more`,
        body: `That’s more than 1% of your body weight a week for three weeks. Faster isn’t better here: it costs more muscle and is harder to keep up${onMeds ? ', and on appetite-lowering medicine it can mean you are eating too little' : ''}. Adding 150 kcal a day — ideally as protein — brings you back into a safe range.`,
      });
    } else if (plateau && goodAdherence) {
      const targets = dailyTargets(p, { weightKg: trendKg, kcalAdjust: state.kcalAdjust || 0, tdeeOffset: state.tdeeOffset || 0 });
      const atFloor = targets.kcal <= targets.floor + 20;
      const intro = 'Plateaus are expected: as you get lighter you need less energy, and appetite pushes back. First, a quick accuracy check — are oils, sauces, drinks and weekend meals being counted? Then pick one option for the next two weeks:';
      recs.push({ id: 'plateau_info', type: 'info', priority: 1, title: `Plateau: ${fmt(Math.max(loss, 0))} kg/week for 3 weeks`, body: onMeds ? `${intro}\n(Because you take a weight-loss medicine, a calorie cut isn’t offered — talk to your prescriber about the plateau, and keep protein and strength sessions high.)` : intro });
      // Rule 26: on appetite-lowering medicine, intake is often already low, so don't offer a further cut.
      if (!atFloor && !onMeds) recs.push({ id: 'plateau_kcal', group: 'plateau', type: 'kcal', delta: -150, priority: 1, title: 'Option A: trim 150 kcal a day', body: 'A small reduction, still above your safe minimum.' });
      recs.push({ id: 'plateau_move', group: 'plateau', type: 'cardio', delta: +30, priority: 1, title: 'Option B: add 30 minutes of activity a week', body: 'About 5 extra minutes a day of walking or cycling.' });
      recs.push({ id: 'plateau_structure', group: 'plateau', type: 'prefs', apply: { variety: 'low', structure: true }, priority: 1, title: 'Option C: more structure', body: 'Repeat the same breakfasts and lunches (or use a protein shake as one meal). Fewer decisions makes intake more predictable.' });
      recs.push({ id: 'plateau_none', group: 'plateau', type: 'info', priority: 1, title: 'Decide later', body: 'Keep everything as it is for now. The plateau check will come up again next week.' });
      recs.push({ id: 'plateau_maintain', group: 'plateau', type: 'break', weeks: 4, priority: 1, title: 'Option D: a planned 4-week maintenance phase', body: 'Eat at maintenance on purpose, keep every habit. It practises the skill you’ll need long-term and is a real rest from dieting.' });
    } else if (plateau && !goodAdherence) {
      recs.push({ id: 'plateau_adherence', type: 'info', priority: 2, title: 'Weight is steady — focus on consistency first', body: 'Before changing numbers, aim for a week where most meals follow the plan. The barrier planner below can help.' });
    } else {
      const expected = dailyTargets(p, { weightKg: trendKg, kcalAdjust: state.kcalAdjust || 0, tdeeOffset: state.tdeeOffset || 0 }).expectedWeeklyLossKg;
      recs.push({
        id: 'on_track', type: 'info', priority: 4,
        title: loss > 0 ? `Trend: ${fmt(loss)} kg/week (${pctWeek.toFixed(2)}%)` : 'Trend is steady',
        body: loss >= expected * 0.6 ? 'That’s right where the plan expects. Keep everything the same — consistency is what works.' : 'A bit slower than the estimate, but within normal variation. Keep going; the plateau check kicks in only after three slow weeks.',
      });
    }
  }

  // ----- Rule 21: early slow responder at week 8
  const startKg = p.startWeightKg || p.weightKg;
  const weeksIn = daysBetween(p.startDate || today, today) / 7;
  const lostPct = ((startKg - trendKg) / startKg) * 100;
  if (!maintaining && weeksIn >= 8 && weeksIn < 12 && lostPct < 2 && !(state.flags || {}).slowSupport) {
    recs.push({
      id: 'slow_support', type: 'flag', flag: 'slowSupport', priority: 1, preselect: true,
      title: 'Week 8 check: let’s add more support',
      body: `You’ve lost ${lostPct.toFixed(1)}% so far. Early results predict later ones, so this is the moment to add support — not to give up. Options: check in twice a week, use more meal structure, and consider asking your doctor about further help (programmes, medicines). Many people need more than an app, and that’s normal.`,
    });
  }

  // ----- Rule 15: step goal progression (hit ≥5/7 days)
  const steps = state.steps || {};
  const goal = stepGoal(p.baselineSteps, (p.stepLevel || 0), p.age);
  let hitDays = 0;
  for (let i = 0; i < 7; i++) if ((steps[addDays(today, -i)] || 0) >= goal) hitDays++;
  if (hitDays >= 5 && goal < (p.age >= 60 ? 8000 : 10000)) {
    recs.push({ id: 'steps_up', type: 'steps', priority: 3, preselect: true, title: `Steps goal met ${hitDays}/7 days — raise it by 500`, body: `New daily goal: ${goal + 500}. (Steps are for health and maintenance; they don’t earn extra food.)` });
  }

  // ----- Hunger / sleep / stress / alcohol / energy (rule 23)
  if (hunger >= 4 && !recs.some((r) => r.id === 'too_fast')) {
    recs.push({ id: 'hunger', type: 'prefs', priority: 3, apply: { mealsPerDay: 5 }, title: 'Hunger is high — more volume and protein', body: 'The plan will switch to 5 smaller meals and lean on soups, vegetables, fruit and protein. If hunger stays high for two weeks, the Gentle pace may be easier to keep.' });
  }
  if ((answers.sleepHours ?? 7) < 7) {
    recs.push({ id: 'sleep', type: 'habit', habit: 'sleep_window', priority: 3, title: 'Sleep is under 7 hours', body: 'In a trial, adults who extended sleep by about an hour ate ~270 kcal a day less without trying. A bedtime cue is one of the highest-value habits you can add.' });
  }
  if ((answers.stress ?? 3) >= 4) {
    recs.push({ id: 'stress', type: 'habit', habit: 'stress_reset', priority: 3, title: 'Stress is high', body: 'Have a planned response ready for stress-eating moments — a short walk, three slow breaths, calling someone.' });
  }
  if ((answers.drinksPerDay ?? 0) > 2) {
    recs.push({ id: 'alcohol', type: 'habit', habit: 'alcohol_limit', priority: 3, title: 'Alcohol is above 2 drinks a day', body: 'Alcohol adds calories and tends to increase food intake too. Try alcohol-free days and alternating drinks with water.' });
  }
  if ((answers.energy ?? 3) <= 2) {
    recs.push({ id: 'energy', type: 'info', priority: 3, title: 'Energy is low', body: 'Make sure you are eating your full target (not less), sleeping enough and drinking water. If tiredness persists, see your doctor — anaemia, thyroid and medication effects are worth ruling out.' });
  }

  let out = recs;
  const NUMERIC = new Set(['kcal', 'tdee', 'reset', 'break', 'cardio', 'steps']);
  if (habitsOnly) {
    out = out.filter((r) => !NUMERIC.has(r.type) && !r.group && !['plateau_info', 'plateau_adherence', 'on_track', 'data', 'slow_support', 'maintain'].includes(r.id));
  }
  if (tooSoon) {
    out = out.filter((r) => !NUMERIC.has(r.type) && !r.group && r.id !== 'plateau_info' && r.type !== 'phase' && r.type !== 'flag');
    out.unshift({ id: 'too_soon', type: 'info', priority: -0.5, title: `Your last check-in was ${daysBetween(lastApplied, today)} day(s) ago`, body: 'Plan changes are made once a week so each one has time to show its effect. Your answers are still saved, and the tips below still apply.' });
  }
  if (!out.length) out.push({ id: 'steady', type: 'info', priority: 5, title: 'Steady week', body: 'Keep going with the current plan.' });
  out.sort((a, b) => a.priority - b.priority);
  const recsOut = out;
  return { recs: recsOut, rate, loss, pctWeek, trendKg, lostPct, observed: obs, weeksIn, tooSoon };
}

/** Apply accepted recommendations (pure: returns a new state and a list of what changed). */
export function applyRecs(state, recs, today) {
  const s = structuredClone(state);
  s.flags ||= {};
  const applied = [];
  for (const r of recs) {
    switch (r.type) {
      case 'kcal':
        s.kcalAdjust = clamp((s.kcalAdjust || 0) + r.delta, -500, 500);
        applied.push({ type: 'kcal', delta: r.delta });
        break;
      case 'reset':
        // Temporary trim for two weeks (read by store.targets), then it lapses on its own.
        s.resetAdjust = r.delta;
        s.resetUntil = addDays(today, 14);
        applied.push({ type: 'kcal', delta: r.delta });
        break;
      case 'tdee':
        s.tdeeOffset = r.offset;
        applied.push({ type: 'tdee', offset: r.offset });
        break;
      case 'steps':
        s.profile.stepLevel = (s.profile.stepLevel || 0) + 1;
        applied.push({ type: 'steps' });
        break;
      case 'cardio':
        s.profile.cardioBonus = (s.profile.cardioBonus || 0) + r.delta;
        applied.push({ type: 'cardio', delta: r.delta });
        break;
      case 'phase':
        s.profile.phase = r.phase;
        s.maintainKg = latestTrend(s.weights || []) ?? s.profile.weightKg;
        s.kcalAdjust = 0;
        applied.push({ type: 'phase', phase: r.phase });
        break;
      case 'break':
        s.lastDietBreak = today;
        s.dietBreakUntil = addDays(today, 7 * (r.weeks || 1));
        applied.push({ type: 'break', weeks: r.weeks || 1 });
        break;
      case 'prefs':
        s.prefs = { ...s.prefs, ...r.apply };
        applied.push({ type: 'prefs', ...r.apply });
        break;
      case 'flag':
        s.flags[r.flag] = today;
        applied.push({ type: 'flag', flag: r.flag });
        break;
      case 'safety':
        s.profile.habitsOnly = true;
        applied.push({ type: 'safety' });
        break;
      case 'habit':
        applied.push({ type: 'habit-suggest', habit: r.habit });
        break;
      default:
        break;
    }
  }
  return { state: s, applied };
}
