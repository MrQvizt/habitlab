// Demo profile with ~10 weeks of realistic history, so the app can be explored before real use.
import { emptyState, ensurePlan, ensureProgress } from './store.js';
import { addDays, isoDate, round, rng, weekStart } from './engine/util.js';
import { HABITS } from './data/habits.js';
import { computeIntake } from './views/shared.js';

export function demoState() {
  const today = isoDate();
  const start = addDays(today, -70);
  const rand = rng('demo');
  let s = emptyState();
  s.profile = {
    units: 'metric', sex: 'female', age: 46, heightCm: 167, weightKg: 112, goalWeightKg: 90, activity: 'sedentary', pace: 'steady', phase: 'lose',
    medical: [], limitations: ['knee'], experience: 'none', equipment: ['bands'], daysAvailable: [0, 2, 4, 5], sessionMinutes: 30,
    baselineCardioMin: 40, baselineSteps: 4200, cardioPrefs: ['walk', 'cycle'], struggles: ['evening', 'time'],
    startDate: start, startWeightKg: 112, habitsOnly: false, stepLevel: 2, demo: true,
  };
  s.prefs = { ...s.prefs, diet: 'omnivore', variety: 'medium' };
  s.calcWeightKg = 108;
  // Weight: ~0.7 kg/week for 6 weeks, then a 4-week plateau (so the check-in shows the plateau flow).
  let kg = 112;
  for (let d = 0; d <= 70; d++) {
    const date = addDays(start, d);
    kg += d < 42 ? -0.7 / 7 : 0.005;
    const water = (rand() - 0.5) * 1.4 + (new Date(date).getDay() === 1 ? 0.4 : 0);
    if (rand() < 0.85 || d === 70) s.weights.push({ date, kg: round(kg + water, 0.1) });
    if (rand() < 0.8) s.steps[date] = Math.round(4500 + d * 40 + rand() * 2500);
  }
  s.habits.active = ['weigh_daily', 'kitchen_closed', 'walk_after_meal'].map((id, i) => ({ id, cue: HABITS.find((h) => h.id === id).cue, started: addDays(start, i * 21), automaticity: i === 0 ? 4.25 : null }));
  s.habits.retired = [{ id: 'water_meals', date: addDays(start, 40) }];
  for (let d = 0; d < 70; d++) {
    const date = addDays(start, d);
    const day = {};
    for (const a of s.habits.active) if (date >= a.started && rand() < 0.82) day[a.id] = true;
    s.habits.log[date] = day;
    const wd = (new Date(date).getDay() + 6) % 7;
    const items = [];
    if ([0, 4].includes(wd) && rand() < 0.85) items.push({ kind: 'strength', variant: wd === 0 ? 'A' : 'B', minutes: 30 });
    if ([1, 2, 3, 5, 6].includes(wd) && rand() < 0.75) items.push({ kind: 'cardio', mode: rand() < 0.7 ? 'walk' : 'cycle', minutes: Math.round(15 + d * 0.35) });
    if (items.length) s.workouts.log[date] = items;
  }
  s.waist = [0, 21, 42, 63].map((d, i) => ({ date: addDays(start, d), cm: 118 - i * 2.5 }));
  s.checkins = [7, 14, 21, 28, 35, 42, 49, 56].map((d) => ({ date: addDays(start, d), answers: {}, applied: d === 35 ? [{ type: 'steps' }] : [], rate: d < 14 ? null : -0.6 }));
  s = ensureProgress(s);
  for (const k of ['squat', 'hinge', 'push']) s.workouts.progress[k].reps = 14;
  // Meal plans + logs for the last 2 weeks, so the app can learn energy needs.
  for (let d = 14; d >= 0; d--) {
    const date = addDays(today, -d);
    s = ensurePlan(s, date).state;
    const wk = weekStart(date);
    const di = (new Date(date + 'T12:00').getDay() + 6) % 7;
    const meals = s.plans[wk].days[di];
    if (d === 0) continue;
    const log = {};
    for (const m of meals) log[m.slot] = rand() < 0.8 ? { status: 'ate' } : rand() < 0.5 ? { status: 'other', kcal: 650 } : { status: 'skip' };
    s.mealLog[date] = log;
    s.intake[date] = computeIntake(s, date);
  }
  return s;
}
