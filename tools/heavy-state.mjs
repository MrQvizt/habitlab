// Builds a realistic heavy dataset: ~2 years of daily use (meals, workouts, habits, steps, weigh-ins,
// check-ins, wraps). Used by tests/perf.test.mjs and the browser performance check.
import { demoState } from '../js/demo.js';
import { addDays, isoDate } from '../js/engine/util.js';

export function heavyState(days = 730) {
  const s = demoState();
  const today = isoDate();
  const start = addDays(today, -days);
  s.profile.startDate = start;
  s.profile.startWeightKg = 140;
  const templates = Object.entries(s.mealLog).slice(0, 7).map(([, v]) => v);
  const habits = s.habits.active.map((a) => a.id);
  let kg = 140;
  s.weights = [];
  for (let i = days; i >= 1; i--) {
    const d = addDays(today, -i);
    if (!s.mealLog[d]) s.mealLog[d] = templates[i % templates.length] || {};
    s.habits.log[d] = Object.fromEntries(habits.filter((_, k) => (i + k) % 3).map((id) => [id, true]));
    s.steps[d] = 5000 + ((i * 37) % 5000);
    if (i % 2 === 0) s.workouts.log[d] = [{ kind: i % 4 === 0 ? 'strength' : 'cardio', minutes: 30, mode: 'walk' }];
    kg -= 0.04;
    if (i % 2 === 0) s.weights.push({ date: d, kg: Math.round((kg + Math.sin(i) * 0.6) * 10) / 10 });
    if (i % 7 === 0) s.checkins.push({ date: d, rate: -0.3, applied: [] });
  }
  s.weights.sort((a, b) => a.date.localeCompare(b.date));
  return s;
}
