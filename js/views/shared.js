// Pieces shared by several views.
import { esc, icon } from '../ui/dom.js';
import { byId, scaledNutrition, SLOT_LABEL, ingredientText } from '../engine/meals.js';
import * as store from '../store.js';
import { orderMeals } from '../engine/schedule.js';
import { daysBetween, weekdayOf, planDayFor } from '../engine/util.js';

export function dayIndex(date) {
  return weekdayOf(date);
}

/** The day's meals in the order you eat them (by your day timeline), each with `time` in minutes. */
export function mealsFor(state, date) {
  const day = planDayFor(state, date);
  return orderMeals(state.profile || {}, day);
}

/** Calories logged so far today (meal ticks + extras). */
export function eatenSoFar(state, date) {
  const log = state.mealLog[date] || {};
  let kcal = 0;
  for (const m of mealsFor(state, date)) {
    const entry = log[m.slot];
    if (entry?.status === 'ate') kcal += scaledNutrition(byId(m.recipeId), m.scale).kcal;
    else if (entry?.status === 'other') kcal += Number(entry.kcal) || 0;
  }
  for (const x of state.extras[date] || []) kcal += Number(x.kcal) || 0;
  return Math.round(kcal);
}

/** True when every planned meal has a status (eaten / something else / skipped). */
export function dayComplete(state, date) {
  const log = state.mealLog[date] || {};
  const meals = mealsFor(state, date);
  return meals.length > 0 && meals.every((m) => log[m.slot]);
}

/**
 * Intake used for learning your energy needs: only fully logged days count, so a half-logged
 * day can't look like a very low-calorie day and drag the estimate down.
 */
export function computeIntake(state, date) {
  return dayComplete(state, date) ? eatenSoFar(state, date) : 0;
}

export function proteinEaten(state, date) {
  const log = state.mealLog[date] || {};
  let p = 0;
  for (const m of mealsFor(state, date)) if (log[m.slot]?.status === 'ate') p += scaledNutrition(byId(m.recipeId), m.scale).p;
  return p;
}

export function recipeDetails(m, units = 'metric', open = false) {
  const r = byId(m.recipeId);
  return `<details class="recipe" ${open ? 'open' : ''}><summary>Recipe & ingredients</summary>
    <ul class="ingredients">${r.ingredients.map(([fid, g]) => `<li>${esc(ingredientText(fid, g * m.scale, units))}</li>`).join('')}</ul>
    <ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    <small class="muted">Season freely with herbs, spices, garlic, lemon, vinegar, mustard and salt to taste.</small></details>`;
}


export function slotLabel(slot) {
  return SLOT_LABEL[slot] || slot;
}


export function safetyNotices(state, levels = ['block', 'warn']) {
  const s = store.safety(state);
  return s.flags
    .filter((f) => levels.includes(f.level))
    .map((f) => `<div class="notice ${f.level === 'block' ? 'block' : f.level === 'warn' ? 'warn' : 'info'}">${icon(f.level === 'info' ? 'info' : 'alert')}<div>${esc(f.text)}</div></div>`)
    .join('');
}

export function checkinDue(state, date) {
  const last = state.checkins.length ? state.checkins[state.checkins.length - 1].date : state.profile.startDate;
  return daysBetween(last, date) >= 7;
}

/** Update one meal's log status for a date (returns the mutated state). */
export function setMealStatus(st, date, slot, fn) {
  const day = { ...(st.mealLog[date] || {}) };
  const next = fn(day[slot]);
  if (next) day[slot] = next;
  else delete day[slot];
  st.mealLog[date] = day;
  st.intake[date] = computeIntake(st, date);
  if (Object.keys(day).length && st.habits.active.some((a) => a.id === 'log_meals')) st.habits.log[date] = { ...(st.habits.log[date] || {}), log_meals: true };
  return st;
}

/** After a swap or pick, flag the changed slot (and keep earlier flags) so plan rebuilds keep it. */
export function markChosen(meals, previous, slot) {
  const prev = Object.fromEntries((previous || []).map((m) => [m.slot, m]));
  return meals.map((m) => ({ ...m, chosen: m.slot === slot || (prev[m.slot]?.chosen && prev[m.slot].recipeId === m.recipeId) || undefined }));
}
