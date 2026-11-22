// Store tests: plan rebuild rules, calc-weight recalculation, export/import round trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, ensurePlan, targets, calcWeight, exportJson, importJson, weekKey, migrate } from '../js/store.js';
import { addDays } from '../js/engine/util.js';

function baseState() {
  const s = emptyState();
  s.profile = { sex: 'female', age: 40, heightCm: 165, weightKg: 100, activity: 'sedentary', pace: 'steady', phase: 'lose', startDate: '2026-11-16', startWeightKg: 100, units: 'metric', medical: [], equipment: [], limitations: [], daysAvailable: [0, 2, 4] };
  s.weights = [{ date: '2026-11-16', kg: 100 }];
  return s;
}

test('plan is stable until targets or preferences change', () => {
  const date = '2026-11-19'; // Thursday
  let s = baseState();
  const a = ensurePlan(s, date);
  s = a.state;
  const b = ensurePlan(s, date);
  assert.equal(b.state, s, 'no rebuild without changes');
});

test('preference change keeps past days and rebuilds today onward', () => {
  const date = '2026-11-19';
  let s = ensurePlan(baseState(), date).state;
  const wk = weekKey(date);
  const before = structuredClone(s.plans[wk].days);
  s = { ...s, prefs: { ...s.prefs, diet: 'vegan' } };
  s = ensurePlan(s, date).state;
  const after = s.plans[wk].days;
  for (let d = 0; d < 3; d++) assert.deepEqual(after[d], before[d], `past day ${d} kept`);
  assert.notDeepEqual(after[4], before[4]);
});

test('targets recalculate only after a 2 kg trend change', () => {
  const s = baseState();
  s.calcWeightKg = 100;
  for (let i = 1; i <= 20; i++) s.weights.push({ date: addDays('2026-11-16', i), kg: 99.5 });
  assert.equal(calcWeight(s), 100);
  for (let i = 21; i <= 60; i++) s.weights.push({ date: addDays('2026-11-16', i), kg: 96 });
  assert.ok(calcWeight(s) < 98);
  assert.ok(targets(s).kcal < targets({ ...s, weights: [{ date: '2026-11-16', kg: 100 }] }).kcal);
});

test('habits-only mode removes the deficit', () => {
  const s = baseState();
  const normal = targets(s);
  s.profile.habitsOnly = true;
  const t = targets(s);
  assert.ok(t.kcal > normal.kcal);
  assert.ok(t.maintenance);
});

test('export/import round-trip and rejects foreign files', () => {
  const s = migrate(ensurePlan(baseState(), '2026-11-19').state); // normalised once
  const back = importJson(exportJson(s));
  assert.deepEqual(back.profile, s.profile);
  assert.deepEqual(back.plans, s.plans);
  assert.throws(() => importJson('{"hello":1}'));
});

test('import sanitises hostile or malformed backups', () => {
  const s = baseState();
  s.profile.age = '"><img src=x onerror=alert(1)>';
  s.profile.daysAvailable = ['0', 3, '<x>'];
  s.weights = [{ date: '', kg: 80 }, { date: '2026-11-01', kg: '<b>' }, { date: '2026-11-02', kg: 99 }];
  s.workouts.progress = { squat: { stepId: 'bw_squat', sets: '<img>', reps: 8 }, bogus: {} };
  s.habits.active = [{ id: 'weigh_daily', cue: 'x'.repeat(500) }, { id: 'nope' }];
  const out = importJson(JSON.stringify({ state: s }));
  assert.equal(out.profile.age, 40);
  assert.deepEqual(out.profile.daysAvailable, [0, 3]);
  assert.deepEqual(out.weights, [{ date: '2026-11-02', kg: 99 }]);
  assert.equal(out.workouts.progress.squat.sets, 2);
  assert.ok(!('bogus' in out.workouts.progress));
  assert.equal(out.habits.active.length, 1);
  assert.equal(out.habits.active[0].cue.length, 160);
});

test('rebuilding the plan keeps today’s logged and hand-picked meals', () => {
  const date = '2026-11-19';
  let s = ensurePlan(baseState(), date).state;
  const wk = weekKey(date);
  const today = s.plans[wk].days[3];
  const breakfast = today.find((m) => m.slot === 'breakfast').recipeId;
  const lunch = today.find((m) => m.slot === 'lunch');
  lunch.chosen = true;
  s.mealLog = { [date]: { breakfast: { status: 'ate' } } };
  s = { ...s, prefs: { ...s.prefs, variety: 'high', seed: 7 } };
  s = ensurePlan(s, date).state;
  const after = s.plans[wk].days[3];
  assert.equal(after.find((m) => m.slot === 'breakfast').recipeId, breakfast);
  assert.equal(after.find((m) => m.slot === 'lunch').recipeId, lunch.recipeId);
});
