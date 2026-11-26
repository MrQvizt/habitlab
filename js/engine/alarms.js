// Alarm clock settings → the specs the native alarm scheduler uses (js/alarm-native.js).
// Defaults follow sleep research:
// - The same wake time every day, weekends included: irregular sleep/wake timing is linked to a
//   later body clock and worse daytime functioning (Phillips 2017).
// - A wind-down reminder 45 minutes before bed to put screens away: reading on a light-emitting
//   device before bed delayed sleep, suppressed melatonin and reduced next-morning alertness
//   compared with a printed book (Chang 2015).
// - Meals at regular times from your day schedule.
import { daySchedule, mealTimes, toHHMM, toMin } from './schedule.js';
import { DEFAULT_SOUND, nativeSound } from '../data/melodies.js';

export const DEFAULT_ALARMS = {
  wake: { on: false, time: null, days: [0, 1, 2, 3, 4, 5, 6], style: 'ring' },
  wind: { on: false, before: 45, style: 'gentle' },
  bed: { on: false, style: 'gentle' },
  meals: { on: false, style: 'gentle', snacks: false },
  snooze: 5,
};

export const STYLES = {
  ring: { label: 'Alarm', hint: 'Rings with a gentle melody until you tap “I’m up”. Not answered? It snoozes itself every 5 min for up to an hour.' },
  gentle: { label: 'Chime', hint: 'One chime and a notification' },
};

const SLOT_LABEL = { breakfast: 'Breakfast', snack: 'Morning snack', lunch: 'Lunch', snack2: 'Afternoon snack', dinner: 'Dinner', snack3: 'Evening snack' };

export function alarmsOf(state) {
  const a = state.alarms || {};
  return {
    wake: { ...DEFAULT_ALARMS.wake, ...(a.wake || {}) },
    wind: { ...DEFAULT_ALARMS.wind, ...(a.wind || {}) },
    bed: { ...DEFAULT_ALARMS.bed, ...(a.bed || {}) },
    meals: { ...DEFAULT_ALARMS.meals, ...(a.meals || {}) },
    snooze: a.snooze || DEFAULT_ALARMS.snooze,
  };
}

const hm = (min) => {
  const t = toHHMM(min);
  return { hour: Number(t.slice(0, 2)), minute: Number(t.slice(3)) };
};

/** Wake, wind-down and bed times for this person (wake alarm time can differ from the day schedule). */
export function alarmTimes(state) {
  const a = alarmsOf(state);
  const d = daySchedule(state.profile || {});
  const wake = a.wake.time ? toMin(a.wake.time) : d.wake;
  return { wake, wind: d.bed - a.wind.before, bed: d.bed };
}

/** The meal slots to remind about (main meals, plus snacks if chosen). */
export function mealSlots(state, withSnacks) {
  const n = state.prefs?.mealsPerDay || 4;
  const slots = ['breakfast', 'lunch', 'dinner'];
  if (withSnacks) slots.push(...(n >= 5 ? ['snack', 'snack2'] : n >= 4 ? ['snack2'] : []));
  return slots;
}

/**
 * Everything the native scheduler needs. Each alarm repeats on its days at hour:minute.
 * Days are Monday = 0 … Sunday = 6.
 */
export function alarmSpecs(state) {
  const a = alarmsOf(state);
  const t = alarmTimes(state);
  const d = daySchedule(state.profile || {});
  const out = [];
  const bed = toHHMM(d.bed);
  const snd = (key) => nativeSound(a[key].sound || DEFAULT_SOUND[key]);
  if (a.wake.on) out.push({ id: 'wake', kind: 'wake', label: 'Good morning', body: '', ...hm(t.wake), days: a.wake.days?.length ? a.wake.days : [0, 1, 2, 3, 4, 5, 6], style: a.wake.style, route: '#/wake', ...snd('wake') });
  if (a.wind.on) out.push({ id: 'wind', kind: 'wind', label: 'Time to wind down', body: `Dim the lights and put screens away — bright screens before bed push sleep later. Bed at ${bed}.`, ...hm(t.wind), days: [0, 1, 2, 3, 4, 5, 6], style: a.wind.style, route: '#/today', ...snd('wind') });
  if (a.bed.on) out.push({ id: 'bed', kind: 'bed', label: 'Bedtime', body: 'Lights out. A good night’s sleep makes tomorrow’s choices easier — people who slept longer ate less the next day.', ...hm(t.bed), days: [0, 1, 2, 3, 4, 5, 6], style: a.bed.style, route: '#/today', ...snd('bed') });
  if (a.meals.on) {
    const slots = mealSlots(state, a.meals.snacks);
    const times = mealTimes(state.profile || {}, slots);
    for (const s of slots) {
      if (times[s] == null) continue;
      out.push({ id: `meal_${s}`, kind: 'meal', label: `${SLOT_LABEL[s]} time`, body: 'Your meal is ready in today’s plan. Sit down, eat slowly, and tick it off.', ...hm(times[s]), days: [0, 1, 2, 3, 4, 5, 6], style: a.meals.style, route: '#/today', ...snd('meals') });
    }
  }
  return out;
}

/** "07:00", for display. */
export function fmtTime(min) {
  return toHHMM(min);
}
