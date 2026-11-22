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
  const { strengthDays } = weekSchedule(p, initialProgress(p), 0);
  assert.equal(strengthDays.length, 3);
  for (let i = 1; i < strengthDays.length; i++) assert.ok(strengthDays[i] - strengthDays[i - 1] >= 2);
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
