// Performance budgets and cache correctness on a heavy, two-year dataset.
// Budgets are generous (CI machines vary); they catch regressions of the order fixed in the
// performance pass (a tap used to recompute 730 days several times over).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heavyState } from '../tools/heavy-state.mjs';
import * as store from '../js/store.js';
import { summary, clearDayCache } from '../js/engine/game.js';
import { bodyCollection } from '../js/engine/body.js';

const today = store.today();
const strip = (g) => ({ xp: g.xp, level: g.level, streak: g.streak, bestStreak: g.bestStreak, badges: [...g.badges].sort(), todayXp: g.todayXp, quests: g.quests.map((q) => [q.id, q.done]), stats: { ...g.stats, body: undefined } });

test('per-day cache gives exactly the uncached result, before and after changes', () => {
  const s = heavyState(400);
  clearDayCache();
  const cold = strip(summary(s, today));
  const warm = strip(summary(s, today));
  assert.deepEqual(warm, cold);
  // Change today, an old day, a weigh-in, a check-in and the active habits: cached == fresh every time
  const mutations = [
    (x) => { x.habits.log[today] = { ...(x.habits.log[today] || {}), water_meals: true }; },
    (x) => { const d = Object.keys(x.mealLog).sort()[10]; x.mealLog[d] = {}; },
    (x) => { x.weights.push({ date: Object.keys(x.mealLog).sort()[20], kg: 120 }); },
    (x) => { x.checkins.push({ date: today, rate: -0.4, applied: [] }); },
    (x) => { x.habits.active = x.habits.active.slice(0, 1); },
    (x) => { x.workouts.log[today] = [{ kind: 'strength', minutes: 30 }]; },
  ];
  let cur = s;
  for (const m of mutations) {
    cur = structuredClone(cur);
    m(cur);
    const cached = strip(summary(cur, today));
    clearDayCache();
    const fresh = strip(summary(cur, today));
    assert.deepEqual(cached, fresh);
  }
});

test('store.game is computed once per state object', () => {
  const s = heavyState(200);
  const a = store.game(s);
  assert.equal(store.game(s), a); // same object: cached
  const s2 = structuredClone(s);
  assert.notEqual(store.game(s2), a);
});

test('performance budgets on two years of data', () => {
  const s = heavyState(730);
  clearDayCache();
  let t = performance.now();
  summary(s, today);
  const cold = performance.now() - t;
  const s2 = structuredClone(s);
  s2.habits.log[today] = { ...(s2.habits.log[today] || {}), walk_after_meal: true };
  t = performance.now();
  summary(s2, today);
  const warm = performance.now() - t;
  t = performance.now();
  bodyCollection(s, today);
  const body = performance.now() - t;
  console.log(`  summary cold ${cold.toFixed(1)} ms, after a tap ${warm.toFixed(1)} ms, body levels ${body.toFixed(1)} ms`);
  assert.ok(cold < 400, `cold summary ${cold.toFixed(0)} ms`);
  assert.ok(warm < 120, `summary after a tap ${warm.toFixed(0)} ms`);
  assert.ok(body < 120, `body levels ${body.toFixed(0)} ms`);
});
