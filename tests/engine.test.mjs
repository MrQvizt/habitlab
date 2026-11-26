// Engine unit tests: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { mifflinStJeor, dailyTargets, proteinReferenceWeight, weightAtBmi, projectWeeks, milestones } from '../js/engine/calc.js';
import { trendSeries, weeklyRate, observedTdee, blendTdee } from '../js/engine/trend.js';
import { planWeek, dayTotals, allowed, recipeNutrition, shoppingList, swapMeal, byId } from '../js/engine/meals.js';
import { RECIPES } from '../js/data/recipes.js';
import { FOODS } from '../js/data/foods.js';
import { initialProgress, progressChain, weekSchedule, cardioTarget, stepGoal, availableSteps } from '../js/engine/workouts.js';
import { streak, isEstablished } from '../js/engine/habits.js';
import { screen } from '../js/engine/safety.js';
import { weeklyReview, applyRecs } from '../js/engine/adjust.js';
import { addDays } from '../js/engine/util.js';

const woman = { sex: 'female', age: 42, heightCm: 165, weightKg: 105, activity: 'sedentary', pace: 'steady', phase: 'lose' };
const man = { sex: 'male', age: 50, heightCm: 180, weightKg: 130, activity: 'light', pace: 'brisk', phase: 'lose' };

test('Mifflin–St Jeor matches the published formula', () => {
  assert.equal(mifflinStJeor({ sex: 'female', weightKg: 105, heightCm: 165, age: 42 }), 1050 + 1031.25 - 210 - 161);
  assert.equal(mifflinStJeor({ sex: 'male', weightKg: 100, heightCm: 180, age: 40 }), 1000 + 1125 - 200 + 5);
});

test('targets: 500 kcal default deficit, floors enforced, protein capped at BMI-30 weight', () => {
  const t = dailyTargets(woman);
  assert.ok(Math.abs(t.tdee - t.kcal - 500) <= 10, `deficit ${t.tdee - t.kcal}`);
  const ref = proteinReferenceWeight(105, 165);
  assert.ok(Math.abs(ref - weightAtBmi(30, 165)) < 0.01);
  assert.ok(t.proteinG >= ref * 1.2 - 5 && t.proteinG <= ref * 1.6 + 5);
  assert.ok(t.fiberG >= 25);
  const tiny = dailyTargets({ ...woman, weightKg: 60, heightCm: 150, age: 70 }, { kcalAdjust: -500 });
  assert.equal(tiny.kcal, 1200);
  assert.ok(tiny.hitFloor);
  assert.ok(dailyTargets({ ...man, weightKg: 70 }, { kcalAdjust: -900 }).kcal >= 1500);
});

test('targets: deficit is capped so planned loss ≤1% body weight and ≤1 kg/week', () => {
  const t = dailyTargets({ ...woman, weightKg: 62, heightCm: 160, pace: 'brisk' });
  assert.ok(t.expectedWeeklyLossKg <= 0.62 + 0.01);
});

test('maintenance and diet breaks remove the deficit', () => {
  const t = dailyTargets({ ...woman, phase: 'maintain' });
  assert.ok(Math.abs(t.kcal - t.tdee) <= 10);
  assert.ok(Math.abs(dailyTargets(woman, { dietBreak: true }).kcal - t.tdee) <= 10);
});

test('projection slows as weight falls and milestones are 5/7/10/15%', () => {
  const w = projectWeeks(woman, 85);
  assert.ok(w > 30 && w < 120, `weeks ${w}`);
  assert.deepEqual(milestones(100).map((m) => Math.round(m.weightKg)), [95, 93, 90, 85]);
});

test('trend smooths noise and weekly rate recovers the true slope', () => {
  const start = '2026-01-01';
  const entries = [];
  for (let i = 0; i < 28; i++) entries.push({ date: addDays(start, i), kg: 100 - (0.5 / 7) * i + (i % 3 === 0 ? 0.8 : i % 3 === 1 ? -0.6 : 0) });
  const s = trendSeries(entries);
  assert.equal(s.length, 28);
  const rate = weeklyRate(entries, addDays(start, 27), 21);
  assert.ok(Math.abs(rate + 0.5) < 0.12, `rate ${rate}`);
  assert.equal(weeklyRate(entries.slice(0, 3), addDays(start, 2)), null);
});

test('observed TDEE needs ≥14 days and ≥80% logged; blend moves 30% capped at ±150', () => {
  const start = '2026-01-01';
  const weights = [];
  const intake = {};
  for (let i = 0; i < 21; i++) {
    weights.push({ date: addDays(start, i), kg: 100 - (0.5 / 7) * i });
    intake[addDays(start, i)] = 1800;
  }
  const obs = observedTdee(intake, weights, addDays(start, 20));
  assert.ok(obs && obs.value > 2100 && obs.value < 2500, JSON.stringify(obs));
  const sparse = Object.fromEntries(Object.entries(intake).filter((_, i) => i % 2));
  assert.equal(observedTdee(sparse, weights, addDays(start, 20)), null);
  assert.equal(blendTdee(2000, 3000), 2150);
  assert.equal(blendTdee(2000, 2100), 2030);
});

test('every recipe uses known foods and has sane nutrition', () => {
  for (const r of RECIPES) {
    for (const [fid] of r.ingredients) assert.ok(FOODS[fid], `${r.id}: ${fid}`);
    const n = recipeNutrition(r);
    assert.ok(n.kcal > 60 && n.kcal < 900, `${r.id} kcal ${n.kcal}`);
    assert.ok(r.steps.length > 0);
  }
  const ids = RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const diet of ['omnivore', 'pescatarian', 'vegetarian', 'vegan']) {
  test(`week plan (${diet}) hits kcal within 5% and respects the diet`, () => {
    for (const p of [woman, man]) {
      const t = dailyTargets(p);
      const prefs = { diet, allergies: diet === 'vegan' ? [] : ['nuts'] };
      const week = planWeek(t, prefs, '2026-11-23');
      assert.equal(week.length, 7);
      for (const day of week) {
        const tot = dayTotals(day);
        assert.ok(Math.abs(tot.kcal - t.kcal) / t.kcal < 0.05, `${diet} ${tot.kcal} vs ${t.kcal}`);
        assert.ok(tot.p >= t.proteinMinG * 0.8, `${diet} protein ${tot.p} vs ${t.proteinMinG}`);
        assert.ok(tot.fib >= 20, `${diet} fibre ${tot.fib}`);
        for (const m of day) assert.ok(allowed(byId(m.recipeId), prefs), `${m.recipeId} not allowed for ${diet}`);
      }
    }
  });
}

test('plans are deterministic per week and swap changes only the slot', () => {
  const t = dailyTargets(woman);
  const a = planWeek(t, { diet: 'omnivore' }, '2026-11-23');
  const b = planWeek(t, { diet: 'omnivore' }, '2026-11-23');
  assert.deepEqual(a, b);
  const swapped = swapMeal(t, { diet: 'omnivore' }, a[0], 'dinner', 'x');
  const before = a[0].find((m) => m.slot === 'dinner').recipeId;
  assert.notEqual(swapped.find((m) => m.slot === 'dinner').recipeId, before);
  assert.equal(swapped.find((m) => m.slot === 'breakfast').recipeId, a[0].find((m) => m.slot === 'breakfast').recipeId);
});

test('allergies and dislikes exclude recipes; shopping list aggregates', () => {
  const prefs = { diet: 'omnivore', allergies: ['gluten', 'dairy', 'egg'], dislikes: ['tofu'] };
  const week = planWeek(dailyTargets(woman), prefs, '2026-11-23');
  for (const day of week) for (const m of day) {
    const r = byId(m.recipeId);
    assert.ok(!r.ingredients.some(([f]) => f === 'tofu'));
    assert.ok(!recipeNutrition(r).tags.some((x) => ['gluten', 'dairy', 'egg'].includes(x)));
  }
  const list = shoppingList(week);
  assert.ok(Object.keys(list).length >= 3);
});

test('exercise chains respect equipment and joints', () => {
  const p = { equipment: [], limitations: ['knee', 'shoulder'] };
  assert.ok(availableSteps('lunge', p).every((s) => !s.avoid.includes('knee') && s.equip === 'none'));
  assert.ok(!availableSteps('push', p).some((s) => s.id === 'pushup'));
  const prog = initialProgress(p);
  assert.equal(prog.squat.stepId, 'sit_to_stand');
});

test('double progression: reps → sets → next rung; hard and pain step back', () => {
  const p = { equipment: ['dumbbells'], limitations: [] };
  let s = initialProgress(p).squat;
  const seen = [];
  for (let i = 0; i < 8; i++) {
    s = progressChain(s, 'squat', 'easy', p, '2026-01-01');
    seen.push(`${s.stepId}:${s.sets}x${s.reps}`);
  }
  assert.ok(seen.some((x) => x.startsWith('box_squat')), seen.join(' '));
  const lvl = s.stepId;
  s = progressChain(s, 'squat', 'pain', p, '2026-01-02');
  assert.notEqual(s.stepId, lvl);
  assert.ok(s.painFlag);
  let r = initialProgress(p).push;
  r = progressChain(r, 'push', 'right', p, 'd');
  assert.equal(r.reps, 10);
  r = progressChain(r, 'push', 'right', p, 'd');
  assert.equal(r.reps, 11);
});

test('weekly schedule: strength on non-consecutive days, cardio ramps ≤20 min/week toward 200', () => {
  const p = { equipment: [], limitations: [], daysAvailable: [0, 1, 2, 3, 4], sessionMinutes: 30, baselineCardioMin: 30, cardioPrefs: ['walk'], phase: 'lose' };
  assert.equal(weekSchedule(p, initialProgress(p), 0).strengthDays.length, 1, 'week 1 eases in');
  const { strengthDays } = weekSchedule(p, initialProgress(p), 2);
  assert.equal(strengthDays.length, 3);
  for (let i = 1; i < strengthDays.length; i++) assert.ok(strengthDays[i] - strengthDays[i - 1] >= 2);
  // Never consecutive, including Sun→Mon wrap-around; fall back to fewer sessions instead.
  for (const days of [[5, 6], [0, 1, 2, 3], [0, 6], [1, 2]]) {
    const sd = weekSchedule({ ...p, daysAvailable: days }, initialProgress(p), 3).strengthDays;
    for (let i = 0; i < sd.length && sd.length > 1; i++) {
      const next = i + 1 < sd.length ? sd[i + 1] : sd[0] + 7;
      assert.ok(next - sd[i] >= 2, `${days} → ${sd}`);
    }
  }
  let prev = cardioTarget(30, 0, 'lose');
  for (let w = 1; w < 30; w++) {
    const c = cardioTarget(30, w, 'lose');
    assert.ok(c - prev <= 20 && c >= prev);
    prev = c;
  }
  assert.equal(prev, 200);
  assert.equal(cardioTarget(30, 60, 'maintain'), 250);
  assert.equal(stepGoal(9500, 5, 65), 9500);
  assert.equal(stepGoal(4000, 0, 40), 4500);
  assert.equal(stepGoal(4000, 50, 40), 10000);
});

test('forgiving streak survives one missed day, not two', () => {
  const log = { '2026-01-10': { h: true }, '2026-01-09': { h: true }, '2026-01-07': { h: true }, '2026-01-06': { h: true }, '2026-01-03': { h: true } };
  assert.equal(streak(log, 'h', '2026-01-10'), 4);
  assert.ok(!isEstablished({ id: 'h', started: '2026-01-01' }, log, '2026-01-10'));
  assert.ok(isEstablished({ id: 'h', started: '2026-01-01', automaticity: 4.5 }, log, '2026-01-10'));
});

test('safety screen blocks pregnancy, under-18 and low BMI; warns on diabetes meds', () => {
  assert.ok(screen({ ...woman, medical: ['pregnant'] }).blocked);
  assert.ok(screen({ ...woman, age: 16 }).blocked);
  assert.ok(screen({ ...woman, weightKg: 48 }).blocked);
  const s = screen({ ...woman, medical: ['diabetes_meds'] });
  assert.ok(!s.blocked && s.flags.some((f) => f.level === 'warn'));
});

// ---------- Simulated user for the weekly review ----------
function simulate({ weeks, ratePerWeek, intake = null, start = '2026-01-05', kg = 105, noise = 0.4 }) {
  const weights = [];
  const intakeLog = {};
  for (let d = 0; d < weeks * 7; d++) {
    const date = addDays(start, d);
    const r = typeof ratePerWeek === 'function' ? ratePerWeek(d) : ratePerWeek;
    kg += r / 7;
    weights.push({ date, kg: kg + Math.sin(d * 1.7) * noise });
    if (intake) intakeLog[date] = intake;
  }
  const today = addDays(start, weeks * 7 - 1);
  const state = { profile: { ...woman, startDate: start, startWeightKg: 105, goalWeightKg: 80 }, weights, intake: intakeLog, checkins: [], kcalAdjust: 0, tdeeOffset: 0, steps: {} };
  return { state, today };
}

test('review: on-track user gets no calorie change', () => {
  const { state, today } = simulate({ weeks: 5, ratePerWeek: -0.5 });
  const { recs } = weeklyReview(state, { adherence: 4 }, today);
  assert.ok(recs.some((r) => r.id === 'on_track'), recs.map((r) => r.id).join());
  assert.ok(!recs.some((r) => r.type === 'kcal'));
});

test('review: >1%/week for 3 weeks → eat more', () => {
  const { state, today } = simulate({ weeks: 5, ratePerWeek: -1.4, noise: 0.2 });
  const { recs } = weeklyReview(state, { adherence: 4 }, today);
  const r = recs.find((x) => x.id === 'too_fast');
  assert.ok(r && r.delta > 0, recs.map((x) => x.id).join());
});

test('review: plateau with good adherence offers a choice; poor adherence never cuts', () => {
  const { state, today } = simulate({ weeks: 10, ratePerWeek: (d) => (d < 42 ? -0.6 : 0) });
  const good = weeklyReview(state, { adherence: 5 }, today).recs;
  assert.ok(good.filter((r) => r.group === 'plateau').length >= 3, good.map((r) => r.id).join());
  const poor = weeklyReview(state, { adherence: 2 }, today).recs;
  assert.ok(!poor.some((r) => r.type === 'kcal' && r.delta < 0));
  assert.ok(poor.some((r) => r.id === 'simplify'));
});

test('review: week-8 slow responder gets extra support', () => {
  const { state, today } = simulate({ weeks: 9, ratePerWeek: -0.15 });
  const { recs } = weeklyReview(state, { adherence: 3 }, today);
  assert.ok(recs.some((r) => r.id === 'slow_support'), recs.map((r) => r.id).join());
});

test('review: learned TDEE from intake logs, applied with cap', () => {
  // Logging 1700 kcal while losing 0.9 kg/week implies TDEE ≈ 2690, above the ≈2390 formula estimate.
  const { state, today } = simulate({ weeks: 4, ratePerWeek: -0.9, intake: 1700, noise: 0.1 });
  const { recs } = weeklyReview(state, { adherence: 4 }, today);
  const r = recs.find((x) => x.type === 'tdee');
  assert.ok(r, recs.map((x) => x.id).join());
  const { state: next } = applyRecs(state, [r], today);
  assert.ok(Math.abs(next.tdeeOffset) <= 150 + 60);
});

test('review: goal reached → maintenance; ED flags → habits-only', () => {
  const { state, today } = simulate({ weeks: 4, ratePerWeek: -0.5 });
  state.profile.goalWeightKg = 110;
  const { recs } = weeklyReview(state, { adherence: 4, edFlags: ['binge'] }, today);
  const m = recs.find((r) => r.id === 'maintain');
  const ed = recs.find((r) => r.id === 'ed');
  assert.ok(m && ed);
  const { state: next } = applyRecs(state, [m, ed], today);
  assert.equal(next.profile.phase, 'maintain');
  assert.ok(next.profile.habitsOnly);
  assert.ok(next.maintainKg > 90);
});

test('planner across body sizes: kcal within 4%, protein ≥ minimum, fibre near the ceiling (non-vegan)', async () => {
  const { fibreCeiling } = await import('../js/engine/meals.js');
  const people = [['female', 155, 80, 68, 'sedentary'], ['female', 170, 130, 55, 'light'], ['male', 175, 110, 40, 'sedentary'], ['male', 185, 150, 30, 'moderate']];
  for (const diet of ['omnivore', 'pescatarian', 'vegetarian', 'vegan']) {
    for (const [sex, heightCm, weightKg, age, activity] of people) {
      const t = dailyTargets({ sex, heightCm, weightKg, age, activity, pace: 'steady', phase: 'lose' });
      for (const wk of ['2026-11-23', '2026-11-30']) {
        for (const day of planWeek(t, { diet }, wk)) {
          const tot = dayTotals(day);
          assert.ok(Math.abs(tot.kcal - t.kcal) / t.kcal < 0.04, `${diet} ${weightKg}kg: ${Math.round(tot.kcal)} vs ${t.kcal}`);
          assert.ok(tot.p >= t.proteinMinG * 0.9, `${diet} ${weightKg}kg protein ${Math.round(tot.p)} < ${t.proteinMinG}`);
          if (diet !== 'vegan') assert.ok(tot.fib <= fibreCeiling(t.kcal) + 30, `${diet} ${weightKg}kg fibre ${Math.round(tot.fib)}`);
        }
      }
    }
  }
});

test('review: GLP-1 users are not offered a calorie cut on a plateau', () => {
  const { state, today } = simulate({ weeks: 10, ratePerWeek: (d) => (d < 42 ? -0.6 : 0) });
  state.profile.medical = ['glp1'];
  const recs = weeklyReview(state, { adherence: 5 }, today).recs;
  assert.ok(recs.some((r) => r.group === 'plateau'));
  assert.ok(!recs.some((r) => r.type === 'kcal' && r.delta < 0));
});

test('review: adjustments only once per 7 days; habits-only never shows calorie items', () => {
  const { state, today } = simulate({ weeks: 10, ratePerWeek: (d) => (d < 42 ? -0.6 : 0) });
  state.checkins = [{ date: addDays(today, -3), applied: [] }];
  const soon = weeklyReview(state, { adherence: 5 }, today).recs;
  assert.ok(soon.some((r) => r.id === 'too_soon'));
  assert.ok(!soon.some((r) => r.type === 'kcal' || r.group));
  state.checkins = [];
  const ho = weeklyReview(state, { adherence: 5 }, today, { habitsOnly: true }).recs;
  assert.ok(!ho.some((r) => ['kcal', 'tdee', 'reset', 'break'].includes(r.type) || r.group || /kcal|kg/.test(r.title)), ho.map((r) => r.id).join());
});

test('meal plan never dips below the calorie floor', () => {
  const t = dailyTargets({ ...woman, weightKg: 62, heightCm: 152, age: 70 });
  assert.equal(t.kcal, 1200);
  for (const diet of ['omnivore', 'vegan']) for (const day of planWeek(t, { diet }, '2026-11-23')) assert.ok(dayTotals(day).kcal >= 1200, `${diet} ${dayTotals(day).kcal}`);
});

test('reminders: specific, future-only, skip what is done, none when disabled', async () => {
  const { buildReminders } = await import('../js/engine/reminders.js');
  const { planWeek: pw } = await import('../js/engine/meals.js');
  const t = dailyTargets(woman);
  const now = new Date('2026-11-23T08:00:00');
  const wk = '2026-11-23';
  const state = { profile: { ...woman, startDate: wk }, plans: { [wk]: { days: pw(t, { diet: 'omnivore' }, wk) } }, mealLog: {}, weights: [], habits: { active: [], log: {} }, workouts: { log: {} }, steps: {}, checkins: [], reminders: { enabled: false } };
  assert.equal(buildReminders(state, now).length, 0);
  state.reminders = { enabled: true };
  const sched = () => [{ kind: 'strength', variant: 'A', minutes: 30 }];
  const list = buildReminders(state, now, { schedule: sched, days: 2 });
  assert.ok(list.every((n) => n.at > now));
  assert.ok(!list.some((n) => n.at.getDate() === 23 && n.at.getHours() === 7), 'morning already past');
  const lunch = list.find((n) => n.title.startsWith('Lunch') && n.at.getDate() === 23);
  assert.ok(lunch && /Planned: /.test(lunch.body));
  state.mealLog = { [wk]: { lunch: { status: 'ate' } } };
  state.workouts.log = { [wk]: [{ kind: 'strength', minutes: 30 }] };
  const after = buildReminders(state, now, { schedule: sched, days: 1 });
  assert.ok(!after.some((n) => n.title.startsWith('Lunch')), 'logged lunch skipped');
  assert.ok(!after.some((n) => n.title === 'Strength time'), 'done session skipped');
  assert.equal(new Set(list.map((n) => n.id)).size, list.length, 'ids unique');
});

test('schedule: never strength and app cardio on the same day; activities reduce planned work', async () => {
  const days = [0, 1, 2, 3, 4, 5, 6];
  const subsets = [];
  for (let mask = 1; mask < 128; mask++) subsets.push(days.filter((d) => mask & (1 << d)));
  for (const avail of subsets) for (const w of [0, 3]) {
    const p = { equipment: [], limitations: [], daysAvailable: avail, sessionMinutes: 30, baselineCardioMin: 90, cardioPrefs: ['walk', 'cycle'], phase: 'lose' };
    const { schedule } = weekSchedule(p, initialProgress(p), w);
    for (const d of schedule) {
      const kinds = d.items.map((i) => i.kind);
      assert.ok(!(kinds.includes('strength') && kinds.includes('cardio')), `${avail} week ${w}: ${d.name} has ${kinds}`);
    }
  }
  const base = { equipment: [], limitations: [], daysAvailable: [0, 2, 4, 5], sessionMinutes: 30, baselineCardioMin: 120, cardioPrefs: ['walk'], phase: 'lose' };
  const without = weekSchedule(base, initialProgress(base), 3);
  const acts = [{ id: 'w', name: 'Walk with friends', days: [5], minutes: 60, intensity: 'moderate' }, { id: 'c', name: 'Climbing', days: [2], minutes: 60, intensity: 'vigorous', strength: true }];
  const withActs = weekSchedule({ ...base, activities: acts }, initialProgress(base), 3);
  const sum = (s, k) => s.schedule.flatMap((d) => d.items).filter((i) => i.kind === k).reduce((a, i) => a + (k === 'strength' ? 1 : i.minutes), 0);
  assert.equal(withActs.activityMin, 180);
  assert.ok(sum(withActs, 'cardio') < sum(without, 'cardio'));
  assert.equal(sum(withActs, 'strength'), sum(without, 'strength') - 1);
  for (const d of withActs.schedule) if (d.items.some((i) => i.kind === 'activity')) assert.ok(!d.items.some((i) => i.kind === 'strength' || i.kind === 'cardio'), `${d.name} doubled up`);
});

test('rewards: a skipped meal earns less than eating and never unlocks First Bite', async () => {
  const { summary, XP } = await import('../js/engine/game.js');
  const { planWeek: pw } = await import('../js/engine/meals.js');
  const wk = '2026-11-23';
  const base = { profile: { ...woman, startDate: wk, startWeightKg: 105 }, plans: { [wk]: { days: pw(dailyTargets(woman), { diet: 'omnivore' }, wk) } }, weights: [], habits: { active: [], log: {}, retired: [] }, workouts: { log: {}, progress: {} }, steps: {}, checkins: [], game: { badges: {} } };
  const skipped = summary({ ...base, mealLog: { [wk]: { breakfast: { status: 'skip' } } }, game: { badges: { first_log: wk } } }, wk);
  assert.ok(!skipped.badges.includes('first_log'), 'skip must not keep First Bite');
  assert.equal(skipped.byDay[wk].awards.find((a) => a.kind === 'mealSkip').xp, XP.mealSkip);
  assert.ok(!skipped.byDay[wk].awards.some((a) => a.lucky));
  const ate = summary({ ...base, mealLog: { [wk]: { breakfast: { status: 'ate' } } } }, wk);
  assert.ok(ate.badges.includes('first_log'));
  assert.ok(XP.mealSkip < XP.meal);
});

test('small wins: every level earns XP and keeps the streak; full earns most', async () => {
  const { summary } = await import('../js/engine/game.js');
  const { habitLevels, levelIndex, levelValue } = await import('../js/engine/habits.js');
  const levels = habitLevels('water_meals');
  assert.equal(levels.length, 3);
  assert.ok(levels[0].xp < levels[1].xp && levels[1].xp < levels[2].xp);
  assert.equal(levelIndex('water_meals', true), 2);
  assert.equal(levelIndex('water_meals', levelValue('water_meals', 0)), 0);
  assert.equal(habitLevels('kitchen_closed').length, 2);
  const wk = '2026-11-23';
  const st = (val) => ({ profile: { ...woman, startDate: '2026-11-16', startWeightKg: 105 }, plans: {}, weights: [], mealLog: {}, workouts: { log: {}, progress: {} }, steps: {}, checkins: [], game: { badges: {} },
    habits: { active: [{ id: 'water_meals', cue: 'x', started: '2026-11-16' }], retired: [], log: Object.fromEntries(['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', wk].map((d) => [d, { water_meals: val }])) } });
  const small = summary(st(1), wk);
  const full = summary(st(true), wk);
  const award = (g) => g.byDay[wk].awards.find((a) => a.kind === 'habitSmall' || a.kind === 'habit');
  assert.equal(award(small).kind, 'habitSmall');
  assert.equal(award(small).xp, 6);
  assert.equal(award(full).xp, 15);
  assert.ok(small.badges.includes('small_wins_5'), 'five small wins → Small Steps badge');
  assert.ok(small.quests.find((q) => q.id === 'habits').done, 'a small win completes the habit quest');
  const { streak } = await import('../js/engine/habits.js');
  assert.equal(streak(st(1).habits.log, 'water_meals', wk), 5);
});

test('day timeline: snacks sit between meals, last meal ≥2 h before bed, late bedtimes work', async () => {
  const { mealTimes, orderMeals, daySchedule, toHHMM } = await import('../js/engine/schedule.js');
  const p = { schedule: { wake: '06:30', bed: '22:30', firstMeal: '07:00', lastMeal: '19:30' } };
  const slots = ['breakfast', 'lunch', 'dinner', 'snack', 'snack2', 'snack3'];
  const order = orderMeals(p, slots.map((slot) => ({ slot }))).map((m) => m.slot);
  assert.deepEqual(order, ['breakfast', 'snack', 'lunch', 'snack2', 'snack3', 'dinner']);
  const four = orderMeals(p, ['breakfast', 'lunch', 'dinner', 'snack'].map((slot) => ({ slot }))).map((m) => m.slot);
  assert.deepEqual(four, ['breakfast', 'lunch', 'snack', 'dinner']);
  const t = mealTimes(p, slots);
  assert.equal(toHHMM(t.breakfast), '07:00');
  assert.equal(toHHMM(t.dinner), '19:30');
  // Asking for a last meal 1 h before bed is pulled back to 2 h.
  const late = daySchedule({ schedule: { wake: '08:00', bed: '23:00', lastMeal: '22:00' } });
  assert.equal(late.bed - late.last, 120);
  // Bedtime after midnight.
  const owl = daySchedule({ schedule: { wake: '09:00', bed: '01:00' } });
  assert.equal(toHHMM(owl.last), '22:00');
  assert.equal(owl.sleepMinutes, 480);
});

test('hobby catalogue: Compendium bands, unique names, estimates labelled, scheduling credit', async () => {
  const { HOBBIES, HOBBY_CATEGORIES, intensityFromMet, hobbyByName } = await import('../js/data/hobbies.js');
  assert.ok(HOBBIES.length >= 800, `only ${HOBBIES.length} activities`);
  const names = HOBBIES.map((h) => h.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
  for (const h of HOBBIES) {
    assert.ok(h.met >= 1.6 && h.met <= 25, h.name);
    assert.ok(h.est ? typeof h.note === 'string' : /^\d{5}$/.test(h.code), `${h.name}: needs a Compendium code or an estimate note`);
    assert.ok(h.minutes >= 10 && h.minutes <= 180, h.name);
    assert.ok(HOBBY_CATEGORIES[h.cat], `${h.name}: unknown category ${h.cat}`);
  }
  for (const cat of Object.keys(HOBBY_CATEGORIES)) assert.ok(HOBBIES.filter((h) => h.cat === cat).length >= 10, cat);
  const pop = HOBBIES.filter((h) => h.pop).length;
  assert.ok(pop >= 12 && pop <= 40, `${pop} popular`);
  assert.ok(HOBBIES.filter((h) => h.est).length <= 6, 'estimates should stay rare');
  assert.equal(intensityFromMet(hobbyByName('Gardening').met), 'moderate');
  assert.equal(intensityFromMet(hobbyByName('Scuba diving').met), 'vigorous');
  assert.equal(intensityFromMet(hobbyByName('Squash').met), 'vigorous');
  assert.equal(intensityFromMet(hobbyByName('Yoga').met), 'easy');
  // A weekly squash game (vigorous, 45 min) counts as 90 cardio minutes.
  const p = { equipment: [], limitations: [], daysAvailable: [0, 2, 4], sessionMinutes: 30, baselineCardioMin: 60, cardioPrefs: ['walk'], phase: 'lose',
    activities: [{ id: 's', name: 'Squash', days: [3], minutes: 45, intensity: intensityFromMet(hobbyByName('Squash').met) }] };
  assert.equal(weekSchedule(p, initialProgress(p), 2).activityMin, 90);
});

test('journey: healthy goal, multi-year timeline and stops along the way (182 cm, 185 kg)', async () => {
  const { suggestedGoalKg, healthyRange, journey, timeline, fmtDuration, nextStops, recentTimeStop } = await import('../js/engine/journey.js');
  assert.equal(suggestedGoalKg(182, 185), 82); // BMI 24.9 at 182 cm = 82.5 → rounded down to 82
  assert.deepEqual(healthyRange(182), { lo: 61.5, hi: 82 });
  assert.equal(suggestedGoalKg(182, 80), null); // already healthy
  const profile = { sex: 'male', age: 35, heightCm: 182, weightKg: 185, activity: 'sedentary', pace: 'steady', phase: 'lose', startWeightKg: 185, startDate: '2026-01-05', goalWeightKg: null };
  const tl = timeline(profile, 82);
  assert.ok(tl.reached && tl.weeks > 150 && tl.weeks < 300, `steady: ${tl.weeks} weeks`);
  assert.match(tl.text, /years/);
  const brisk = timeline({ ...profile, pace: 'brisk' }, 82);
  assert.ok(brisk.weeks < tl.weeks);
  assert.equal(fmtDuration(1), '1 week');
  assert.equal(fmtDuration(26), '6 months');
  assert.equal(fmtDuration(233), '4 years 6 months');

  const j = journey({ profile }, { today: '2026-01-05', trendKg: 185 });
  assert.equal(j.goalKg, 82); // falls back to the suggested goal
  const titles = j.stops.map((s) => s.title);
  for (const t of ['One week in', 'One month', 'Six months', 'One year', '5% lighter', '10% lighter', 'BMI under 40', 'BMI under 35', 'BMI under 30', 'Healthy weight — your goal']) assert.ok(titles.includes(t), t);
  assert.ok(titles.some((t) => /^Year \d/.test(t)), 'yearly stops on a multi-year road');
  const dates = j.stops.map((s) => s.date);
  assert.deepEqual(dates, [...dates].sort(), 'stops in date order');
  assert.equal(j.stops.filter((s) => s.next).length, 1);
  assert.equal(j.stops[0].title, 'One week in');
  assert.equal(j.stops.at(-1).kind, 'goal');
  assert.ok(j.stops.every((s) => s.text && s.text.length > 20));

  // Five months later, 15 kg down: early stops reached, dates re-projected from today.
  const later = journey({ profile }, { today: '2026-06-05', trendKg: 170 });
  assert.ok(later.stops.find((s) => s.title === '5% lighter').reached);
  assert.ok(later.stops.find((s) => s.title === 'One month').reached);
  assert.ok(!later.stops.find((s) => s.title === '10% lighter').reached);
  assert.equal(nextStops(later).weight.title, '10% lighter');
  assert.equal(nextStops(later).time.title, 'Six months');
  assert.equal(recentTimeStop(journey({ profile }, { today: '2026-01-13', trendKg: 183 }), '2026-01-13').title, 'One week in');
  assert.equal(recentTimeStop(later, '2026-06-05'), null);
});

test('body wrap: organ rings from logged behaviour, knee maths, XP and medals', async () => {
  const { weekBody, ORGANS, KNEE_FACTOR, bodyCollection, lastWeekStart } = await import('../js/engine/body.js');
  const { addDays, weekStart, isoDate } = await import('../js/engine/util.js');
  const { demoState } = await import('../js/demo.js');
  const { summary, dayAwards, XP } = await import('../js/engine/game.js');
  const { buildReminders } = await import('../js/engine/reminders.js');
  const s = demoState();
  const today = isoDate();
  const ws = lastWeekStart(s, today);
  assert.ok(ws);
  const w = weekBody(s, ws);
  assert.equal(w.organs.length, ORGANS.length);
  for (const o of w.organs) {
    assert.ok(o.pct >= 0 && Number.isFinite(o.pct), o.id);
    assert.ok(o.head && o.big && o.sub && o.fact && o.src, o.id);
  }
  assert.ok(w.earned.length >= 3, `demo week earns thanks: ${w.earned.map((o) => o.id)}`);
  // Knee maths: kg lost × 4 × steps
  const st = w.stats;
  if (st.lostKg > 0 && st.steps) assert.ok(Math.abs(st.kneeTonnes - (st.lostKg * KNEE_FACTOR * st.steps) / 1000) < 1e-9);

  // A blank week: no thanks, nudge present, nothing NaN.
  const blank = { ...s, workouts: { ...s.workouts, log: {} }, steps: {}, mealLog: {}, habits: { ...s.habits, log: {} }, weights: [] };
  const b = weekBody(blank, ws);
  assert.equal(b.earned.length, 0);
  assert.ok(b.nudge);
  // Heart ring is exactly active minutes / 150
  const one = structuredClone(blank);
  one.workouts.log[ws] = [{ kind: 'cardio', minutes: 75 }];
  one.workouts.log[addDays(ws, 2)] = [{ kind: 'activity', name: 'Squash', intensity: 'vigorous', minutes: 45 }];
  const h = weekBody(one, ws).organs.find((o) => o.id === 'heart');
  assert.equal(h.pct, (75 + 90) / 150);
  assert.ok(h.closed && h.earned);
  assert.equal(weekBody(one, ws).stats.strength, 0); // squash is cardio, not strength
  one.workouts.log[addDays(ws, 4)] = [{ kind: 'activity', name: 'Climbing / bouldering', intensity: 'vigorous', minutes: 60 }];
  assert.equal(weekBody(one, ws).stats.strength, 1); // bouldering counts as strength-type from the catalogue

  // Habits-only: no weight numbers in the knees card
  const ho = weekBody(s, ws, { habitsOnly: true });
  assert.equal(ho.stats.lostKg, 0);

  // XP and badges: opening the wrap is worth XP once, on the day it was opened
  const opened = { ...s, wraps: { [ws]: today } };
  assert.ok(dayAwards(opened, today).some((a) => a.kind === 'wrap' && a.xp === XP.wrap));
  const g = summary(opened, today);
  assert.ok(g.badges.includes('wrap_1'));
  assert.ok(g.stats.body.weeks >= 9);
  assert.ok(Object.values(bodyCollection(s, today).counts).some((n) => n > 0));

  // Monday reminder when last week's wrap is waiting; none once opened
  const monday = weekStart(addDays(today, 7));
  const sR = { ...s, reminders: { ...s.reminders, enabled: true, checkin: true } };
  const rs = buildReminders(sR, new Date(addDays(monday, -1) + 'T12:00'));
  const wrapR = rs.find((r) => r.route === `#/wrap/${addDays(monday, -7)}`);
  assert.ok(wrapR, 'Monday wrap reminder');
  assert.match(wrapR.title, /Body Wrap/);
});

test('alarms: specs from settings and day schedule; morning messages from values', async () => {
  const { alarmSpecs, alarmTimes, alarmsOf } = await import('../js/engine/alarms.js');
  const { morningMessages, messageForDay, MESSAGE_SETS } = await import('../js/data/affirmations.js');
  const { sanitize, emptyState } = await import('../js/store.js');
  const { dayAwards, XP } = await import('../js/engine/game.js');
  const base = { profile: { schedule: { wake: '06:30', bed: '22:30' } }, prefs: { mealsPerDay: 4 } };
  assert.deepEqual(alarmSpecs(base), []); // all off by default
  const s = { ...base, alarms: { wake: { on: true, time: '06:45', days: [0, 1, 2, 3, 4] }, wind: { on: true, before: 60 }, bed: { on: true }, meals: { on: true } } };
  const specs = alarmSpecs(s);
  const by = Object.fromEntries(specs.map((x) => [x.id, x]));
  assert.equal(by.wake.hour, 6);
  assert.equal(by.wake.minute, 45);
  assert.deepEqual(by.wake.days, [0, 1, 2, 3, 4]);
  assert.equal(by.wake.style, 'ring');
  assert.equal(by.wake.route, '#/wake');
  assert.equal(`${by.wind.hour}:${by.wind.minute}`, '21:30'); // 60 min before 22:30
  assert.equal(`${by.bed.hour}:${by.bed.minute}`, '22:30');
  assert.equal(by.wind.style, 'gentle');
  assert.ok(by.meal_breakfast && by.meal_lunch && by.meal_dinner && !by.meal_snack2);
  assert.ok(by.meal_breakfast.hour * 60 + by.meal_breakfast.minute < by.meal_dinner.hour * 60 + by.meal_dinner.minute);
  assert.match(by.wind.body, /22:30/);
  // Wake time falls back to the day schedule
  assert.equal(alarmTimes({ ...base, alarms: { wake: { on: true } } }).wake, 6 * 60 + 30);
  assert.equal(alarmsOf({}).snooze, 5);

  // Messages: values and why are woven in; no unreplaced placeholders; custom + favourites included
  const msgs = morningMessages({ values: ['family', 'energy'], why: 'To have energy to play with my kids.', custom: ['You’ve got this.'], favs: ['You deserve a healthy life.'] });
  assert.ok(msgs.length >= 20);
  assert.ok(msgs.every((m) => !/[{}]/.test(m)), 'no placeholders left');
  assert.ok(msgs.some((m) => /You care about the people you love/.test(m)));
  // Your own values: turned round to speak to you, mixed with presets, no placeholders left
  const { valueInfo } = await import('../js/data/affirmations.js');
  assert.deepEqual(valueInfo('My kids'), { label: 'My kids', phrase: 'your kids', custom: true });
  assert.equal(valueInfo('being there for my mum').phrase, 'being there for your mum');
  assert.equal(valueInfo('NYC marathon').phrase, 'NYC marathon');
  assert.equal(valueInfo('family').label, 'Family');
  assert.equal(valueInfo('  '), null);
  const own = morningMessages({ values: ['My kids', 'painting', 'family'], sets: ['values'] });
  assert.ok(own.some((m) => m.startsWith('You care about your kids.')));
  assert.ok(own.some((m) => /for painting\./.test(m)));
  assert.ok(own.some((m) => /the people you love/i.test(m)));
  assert.ok(own.every((m) => !/[{}]/.test(m)));
  assert.ok(msgs.some((m) => /to have energy to play with my kids/.test(m)));
  assert.ok(msgs.includes('You look beautiful today.'));
  assert.ok(msgs.filter((m) => m === 'You’ve got this.').length >= 3, 'own words come up more often');
  // Without a why, future lines that need it are skipped; without compliments, none appear
  const plain = morningMessages({ sets: ['future', 'worth'] });
  assert.ok(plain.every((m) => !/\{|undefined/.test(m)));
  assert.ok(!morningMessages({ sets: ['worth', 'compassion'] }).some((m) => MESSAGE_SETS.compliments.lines.includes(m)));
  // Same message all day, a different one tomorrow (matches the native epoch-day rotation)
  const d1 = new Date('2026-11-25T06:00:00Z');
  assert.equal(messageForDay(msgs, d1), msgs[Math.floor(d1.getTime() / 86400000) % msgs.length]);
  assert.notEqual(messageForDay(msgs, d1), messageForDay(msgs, new Date(d1.getTime() + 86400000)));

  // Store sanitising
  const dirty = { ...emptyState(), alarms: { wake: { on: 1, time: '7am', days: [9, 1, 1, 0] }, wind: { before: 999 }, snooze: 99 }, affirm: { values: ['a', 'b', 'c', 'd'], why: 5, custom: ['x', 3, ''] }, wakes: { '2026-11-25': '06:31', bad: '1' } };
  const clean = sanitize(dirty);
  assert.equal(clean.alarms.wake.on, true);
  assert.equal(clean.alarms.wake.time, null);
  assert.deepEqual(clean.alarms.wake.days, [0, 1]);
  assert.equal(clean.alarms.wind.before, 120);
  assert.equal(clean.alarms.snooze, 30);
  assert.equal(clean.affirm.values.length, 3);
  assert.equal(clean.affirm.why, '');
  assert.deepEqual(clean.affirm.custom, ['x']);
  assert.deepEqual(Object.keys(clean.wakes), ['2026-11-25']);

  // Morning intention earns XP once that day
  const w = { ...emptyState(), profile: { startDate: '2026-11-01' }, wakes: { '2026-11-25': '06:31' } };
  assert.ok(dayAwards(w, '2026-11-25').some((a) => a.kind === 'wake' && a.xp === XP.wake));
});

test('body levels: consistency over weeks, capped weekly points, streak bonus', async () => {
  const { weekPoints, bodyLevelOf, bodyLevelStart, bodyLevelTitle, bodyCollection, ORGAN_GUIDE, ORGANS, weekBody } = await import('../js/engine/body.js');
  const { demoState } = await import('../js/demo.js');
  const { isoDate, weekStart } = await import('../js/engine/util.js');
  assert.deepEqual(weekPoints(2.5, 0), { base: 100, bonus: 0, total: 100 }); // capped: one huge week ≠ many steady ones
  assert.deepEqual(weekPoints(0.6, 3), { base: 60, bonus: 30, total: 90 });
  assert.equal(weekPoints(0.4, 9).bonus, 0); // below half-full: no streak bonus
  assert.equal(weekPoints(1, 12).bonus, 50); // bonus capped
  assert.equal(bodyLevelOf(0), 1);
  assert.equal(bodyLevelOf(99), 1);
  assert.equal(bodyLevelOf(100), 2);
  assert.equal(bodyLevelOf(1000), 5);
  assert.equal(bodyLevelStart(4), 600);
  assert.equal(bodyLevelTitle(5), 'Strong');
  assert.match(bodyLevelTitle(12), /Legendary/);
  const s = demoState();
  const today = isoDate();
  const c = bodyCollection(s, today);
  for (const o of ORGANS) {
    const lv = c.levels[o.id];
    assert.ok(lv.level >= 2, `${o.id} levelled up over 10 demo weeks`);
    assert.ok(lv.into >= 0 && lv.into < lv.need);
    assert.ok(lv.history.length >= 2 && lv.history.length <= 12);
    assert.equal(lv.history.at(-1).ws, weekStart(today)); // this week included, so the meter moves daily
    // Every body part explains what it needs, with rows that read this week's stats
    const g = ORGAN_GUIDE[o.id];
    assert.ok(g.needs && g.tips.length && g.actions.length);
    for (const [label, value, target] of g.rows(weekBody(s, weekStart(today), { asOf: today }).stats)) assert.ok(label && Number.isFinite(value) && target > 0, `${o.id} ${label}`);
  }
  // No activity → no points; the same steady weeks beat one big week
  const empty = { profile: { startDate: today } };
  assert.equal(bodyCollection(empty, today).levels.heart.points, 0);
});

test('week start: user-chosen reset day; plans, history, wraps and reminders follow it', async () => {
  const u = await import('../js/engine/util.js');
  const { demoState } = await import('../js/demo.js');
  const store = await import('../js/store.js');
  const { mealsFor } = await import('../js/views/shared.js');
  const { weekBody, lastWeekStart } = await import('../js/engine/body.js');
  const { buildReminders } = await import('../js/engine/reminders.js');
  try {
    // 2026-11-25 is a Wednesday
    assert.equal(u.weekStart('2026-11-25', 0), '2026-11-23'); // Monday start
    assert.equal(u.weekStart('2026-11-25', 6), '2026-11-22'); // Sunday start
    assert.equal(u.weekStart('2026-11-22', 6), '2026-11-22');
    assert.equal(u.weekStart('2026-11-25', 2), '2026-11-25'); // Wednesday start
    assert.equal(u.weekStart('2026-11-24', 2), '2026-11-18');
    assert.deepEqual(u.weekOrder(6), [6, 0, 1, 2, 3, 4, 5]);
    assert.equal(u.dateInWeek('2026-11-22', 6), '2026-11-22');
    assert.equal(u.dateInWeek('2026-11-22', 0), '2026-11-23');
    // Sanitising applies the setting; bad values fall back to Monday
    store.sanitize({ ...store.emptyState(), prefs: { ...store.emptyState().prefs, weekStart: 9 } });
    assert.equal(u.getWeekStart(), 6); // clamped to Sunday (0–6)
    store.sanitize({ ...store.emptyState(), prefs: { ...store.emptyState().prefs, weekStart: 'x' } });
    assert.equal(u.getWeekStart(), 0);

    // Switching mid-week keeps what you already ate and the past days of the plan
    u.setWeekStart(0);
    let s = demoState();
    const today = u.isoDate();
    const before = Object.fromEntries(Array.from({ length: 7 }, (_, i) => u.addDays(today, -i)).map((d) => [d, mealsFor(s, d).map((m) => m.recipeId).join()]));
    s.prefs.weekStart = 6;
    u.setWeekStart(6);
    s = store.ensurePlan(s, today).state;
    assert.ok(s.plans[u.weekStart(today)], 'plan exists under the new week key');
    for (let i = 1; i < 7; i++) {
      const d = u.addDays(today, -i);
      if (d < u.weekStart(today)) continue;
      assert.equal(mealsFor(s, d).map((m) => m.recipeId).join(), before[d], `past day ${d} unchanged`);
    }
    for (const slot of Object.keys(s.mealLog[today] || {})) assert.ok(mealsFor(s, today).some((m) => m.slot === slot), 'today’s logged meals kept');

    // Body week and the wrap follow the new boundary
    const ws = u.weekStart(today);
    assert.equal(u.weekdayOf(ws), 6);
    assert.equal(weekBody(s, ws, { asOf: today }).ws, ws);
    assert.equal(u.weekdayOf(lastWeekStart(s, today)), 6);
    // The "Body Wrap is ready" notification fires on the first day of the user's week
    const sR = { ...s, reminders: { ...s.reminders, enabled: true, checkin: true } };
    const wraps = buildReminders(sR, new Date(today + 'T00:05')).filter((r) => r.route.startsWith('#/wrap/'));
    assert.ok(wraps.length >= 1, 'a wrap reminder is scheduled');
    for (const r of wraps) assert.equal(r.at.getDay(), 0, 'wrap reminder on Sunday');
  } finally {
    u.setWeekStart(0);
  }
});

test('alarm sounds: melody specs are valid, reach the native spec, and survive sanitising', async () => {
  const { MELODIES, DEFAULT_SOUND, nativeSound, soundLabel, melodiesFor } = await import('../js/data/melodies.js');
  const { alarmSpecs } = await import('../js/engine/alarms.js');
  const { sanitize, emptyState } = await import('../js/store.js');
  assert.ok(Object.keys(MELODIES).length >= 6);
  for (const [id, m] of Object.entries(MELODIES)) {
    assert.ok(m.name && m.hint, id);
    assert.ok(m.beat > 0.03 && m.beat < 2 && m.decay >= 0 && m.attack > 0 && m.rest >= 0, id);
    assert.ok(m.partials.every(([mult, amp]) => mult > 0 && amp > 0), id);
    assert.ok(m.notes.some(([f]) => f > 0), id);
    for (const [f, beats, to] of m.notes) assert.ok(f >= 0 && f < 6000 && beats > 0 && (to == null || (to > 0 && to < 6000)), `${id} note`);
    const pattern = m.notes.reduce((t, [, b]) => t + b * m.beat, 0) + m.rest;
    assert.ok(pattern > 0.8 && pattern < 8, `${id} pattern length ${pattern.toFixed(2)} s`);
  }
  for (const k of Object.keys(DEFAULT_SOUND)) assert.ok(MELODIES[DEFAULT_SOUND[k]], k);
  assert.equal(melodiesFor('bed')[0][1].moods.includes('bed'), true); // night sounds listed first at night
  assert.deepEqual(nativeSound('device'), { sound: 'device' });
  assert.deepEqual(nativeSound('uri:content://media/internal/audio/media/12|Cesium'), { sound: 'uri', uri: 'content://media/internal/audio/media/12' });
  assert.equal(soundLabel('uri:content://media/internal/audio/media/12|Cesium'), 'Cesium');
  assert.equal(nativeSound('nope').melody.notes.length, MELODIES.sunrise.notes.length); // unknown → Sunrise
  // Each alarm carries its sound; defaults per kind
  const specs = alarmSpecs({ profile: { schedule: {} }, prefs: {}, alarms: { wake: { on: true, sound: 'birdsong' }, wind: { on: true }, meals: { on: true, sound: 'device' } } });
  const by = Object.fromEntries(specs.map((s) => [s.id, s]));
  assert.equal(by.wake.sound, 'melody');
  assert.deepEqual(by.wake.melody.notes, MELODIES.birdsong.notes);
  assert.deepEqual(by.wind.melody.notes, MELODIES.ocean.notes);
  assert.equal(by.meal_lunch.sound, 'device');
  // Sanitising keeps valid sounds and drops junk
  const clean = sanitize({ ...emptyState(), alarms: { wake: { sound: 'birdsong' }, wind: { sound: 'uri:content://media/x/1|My song' }, bed: { sound: 'javascript:alert(1)' }, meals: { sound: 42 } } });
  assert.equal(clean.alarms.wake.sound, 'birdsong');
  assert.equal(clean.alarms.wind.sound, 'uri:content://media/x/1|My song');
  assert.equal(clean.alarms.bed.sound, undefined);
  assert.equal(clean.alarms.meals.sound, undefined);
});

// ---------- Your day: habits placed by their cue ----------
import { cueTime, planDay, partOf } from '../js/engine/dayplan.js';
test('habit cues map to the right moment of the day', () => {
  const profile = { schedule: { wake: '06:30', bed: '22:30', firstMeal: '07:00', lastMeal: '19:00' } };
  const meals = { breakfast: 420, lunch: 750, dinner: 1140 };
  assert.equal(cueTime('After I finish lunch', profile, meals).time, 780);
  assert.equal(cueTime('After I finish washing up', profile, meals).label, 'After dinner');
  assert.equal(cueTime('When I plate up dinner', profile, meals).time, 1139);
  assert.equal(cueTime('When I check my phone at 6 pm', profile, meals).time, 18 * 60);
  assert.equal(cueTime('After I use the bathroom in the morning', profile, meals).time, 400);
  assert.equal(cueTime('After I brush my teeth at night', profile, meals).time, 22 * 60);
  assert.equal(cueTime('When I feel like a soda or juice', profile, meals), null);
  assert.equal(cueTime('', profile, meals), null);
  assert.equal(partOf(400), 'morning');
  assert.equal(partOf(780), 'afternoon');
  assert.equal(partOf(1200), 'evening');
});
test('planDay orders meals and habits by time; unplaced habits go to any time', () => {
  const profile = { schedule: { wake: '06:30', bed: '22:30', firstMeal: '07:00', lastMeal: '19:00' } };
  const p = planDay(profile, {
    meals: [{ slot: 'breakfast', time: 420 }, { slot: 'lunch', time: 750 }, { slot: 'dinner', time: 1140 }],
    habits: [{ id: 'kitchen_closed', cue: 'After I finish washing up' }, { id: 'walk_after_meal', cue: 'After I finish lunch' }, { id: 'water_meals', cue: 'When I feel like a soda' }],
    weigh: true,
  });
  assert.deepEqual(p.timed.map((x) => x.slot || x.id || x.kind), ['weigh', 'breakfast', 'lunch', 'walk_after_meal', 'dinner', 'kitchen_closed']);
  assert.deepEqual(p.anytime.map((x) => x.id), ['water_meals']);
});

test('snooze starts at 5 minutes; the old 9-minute default moves to 5 once, a chosen value is kept', async () => {
  const store = await import('../js/store.js');
  const { emptyState } = store;
  const fresh = store.sanitize({ ...emptyState(), alarms: {} });
  assert.equal(fresh.alarms.snooze, 5);
  const old = store.sanitize({ ...emptyState(), alarms: { snooze: 9 } });
  assert.equal(old.alarms.snooze, 5);
  assert.equal(old.flags.snooze5, true);
  assert.equal(store.sanitize({ ...emptyState(), alarms: { snooze: 15 } }).alarms.snooze, 15);
  // After the move, a deliberate 9 stays 9
  assert.equal(store.sanitize({ ...emptyState(), alarms: { snooze: 9 }, flags: { snooze5: true } }).alarms.snooze, 9);
});

test('lock-screen morning hand-off is validated', async () => {
  const { parseWake } = await import('../js/alarm-native.js');
  assert.deepEqual(parseWake('{"date":"2026-11-26","at":"06:52","value":"family","fav":true,"message":"Hi"}'), { date: '2026-11-26', at: '06:52', values: ['family'], other: '', fav: true, message: 'Hi' });
  assert.deepEqual(parseWake('{"date":"2026-11-26","at":"06:52","values":["family","me",5],"other":" my kids "}').values, ['family', 'me']);
  assert.equal(parseWake('{"date":"2026-11-26","at":"06:52","values":[],"other":" my kids "}').other, 'my kids');
  assert.equal(parseWake('{"date":"<b>","at":"06:52"}'), null);
  assert.equal(parseWake('{"date":"2026-11-26","at":"99:99"}'), null);
  assert.equal(parseWake('not json'), null);
  assert.equal(parseWake('{"date":"2026-11-26","at":"07:00","fav":"yes"}').fav, false);
});

test('morning reasons: several values, me, and your own words', async () => {
  const { reasonLine } = await import('../js/data/affirmations.js');
  assert.equal(reasonLine(['me']), 'Good. You are reason enough.');
  assert.equal(reasonLine([]), '');
  assert.equal(reasonLine(['family']), 'Holding on to the people you love today. Every good choice counts.');
  assert.equal(reasonLine(['family', 'health'], 'my kids'), 'Holding on to the people you love, feeling healthy and strong and my kids today. Every good choice counts.');
  assert.equal(reasonLine(['me', 'family']), 'For you, and for the people you love. Every good choice counts.');
  assert.equal(reasonLine([], '  a walk  with Sam '), 'Holding on to a walk with Sam today. Every good choice counts.');
});
