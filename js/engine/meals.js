// Meal planner: builds a 7-day plan that hits the calorie target, front-loads protein and fibre,
// respects diet, allergies, dislikes and time limits, and repeats meals on purpose (fewer decisions).
import { FOODS, DIETS } from '../data/foods.js';
import { RECIPES } from '../data/recipes.js';
import { rng, round, clamp } from './util.js';

export const SLOT_SPLIT = {
  3: { breakfast: 0.27, lunch: 0.33, dinner: 0.4 },
  4: { breakfast: 0.25, lunch: 0.3, dinner: 0.33, snack: 0.12 },
  5: { breakfast: 0.23, lunch: 0.28, dinner: 0.31, snack: 0.09, snack2: 0.09 },
  6: { breakfast: 0.21, lunch: 0.26, dinner: 0.29, snack: 0.08, snack2: 0.08, snack3: 0.08 },
};
export const SLOT_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', snack2: 'Snack', snack3: 'Snack' };
export const MIN_SCALE = 0.6;
export const MAX_SCALE = 2.2; // large portions are fine for high calorie targets (e.g. 3,000 kcal)
/**
 * Soft fibre ceiling: plenty for fullness (guideline ≈14 g per 1,000 kcal, ≥25 g) without the bloating
 * that a sudden very large jump can cause. ≈18 g per 1,000 kcal, between 35 and 60 g.
 */
export function fibreCeiling(kcal) {
  return Math.min(60, Math.max(35, (kcal / 1000) * 18));
}

const cache = new Map();
/** Nutrition for one base serving of a recipe. */
export function recipeNutrition(recipe) {
  if (cache.has(recipe.id)) return cache.get(recipe.id);
  const n = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, tags: new Set() };
  for (const [fid, g] of recipe.ingredients) {
    const food = FOODS[fid];
    if (!food) throw new Error(`Unknown food ${fid} in ${recipe.id}`);
    const k = g / 100;
    n.kcal += food.kcal * k;
    n.p += food.p * k;
    n.c += food.c * k;
    n.f += food.f * k;
    n.fib += food.fib * k;
    food.tags.forEach((t) => n.tags.add(t));
  }
  n.tags = [...n.tags];
  cache.set(recipe.id, n);
  return n;
}

export function scaledNutrition(recipe, scale) {
  const n = recipeNutrition(recipe);
  return { kcal: n.kcal * scale, p: n.p * scale, c: n.c * scale, f: n.f * scale, fib: n.fib * scale };
}

/** Can this person eat this recipe? */
export function allowed(recipe, prefs) {
  const n = recipeNutrition(recipe);
  const excluded = new Set([...(DIETS[prefs.diet]?.excludes || []), ...(prefs.allergies || [])]);
  if (n.tags.some((t) => excluded.has(t))) return false;
  const dislikes = new Set(prefs.dislikes || []);
  if (recipe.ingredients.some(([fid]) => dislikes.has(fid))) return false;
  if ((prefs.blockedRecipes || []).includes(recipe.id)) return false;
  return true;
}

export function candidates(slot, prefs, { weekend = false } = {}) {
  const base = slot.startsWith('snack') ? 'snack' : slot;
  const maxMin = weekend ? prefs.maxMinutesWeekend ?? 45 : prefs.maxMinutesWeekday ?? 30;
  const pool = RECIPES.filter((r) => r.slot === base && allowed(r, prefs));
  const timed = pool.filter((r) => r.minutes <= maxMin && (!prefs.noCookLunch || base !== 'lunch' || r.nocook || r.batch));
  const budget = prefs.budget === 'tight' ? 1 : prefs.budget === 'flexible' ? 3 : 2;
  const cheap = timed.filter((r) => r.cost <= budget);
  // Fall back gracefully rather than return nothing.
  if (cheap.length >= 2) return cheap;
  if (timed.length) return timed;
  return pool;
}

function score(recipe, { recent, favorites, rand, proteinNeed, weekCount, fibreRoom, scale = 1 }) {
  const n = recipeNutrition(recipe);
  const proteinDensity = (n.p * 4) / n.kcal; // share of calories from protein
  const fibreDensity = n.fib / (n.kcal / 100);
  let s = proteinDensity * 4 * proteinNeed + fibreDensity * 0.5;
  // Fibre is good up to a ceiling; beyond it, penalise (rapid big increases cause GI discomfort).
  if (fibreRoom != null) {
    const over = n.fib * scale - fibreRoom;
    if (over > 0) s -= over * 0.35;
  }
  if (favorites.includes(recipe.id)) s += 0.8;
  const lastUsed = recent.get(recipe.id);
  if (lastUsed != null) s -= lastUsed <= 1 ? 3 : 1.2; // used in the last day or two
  s -= (weekCount?.get(recipe.id) || 0) * 0.7; // spread across the week
  s += rand() * 0.9; // variety
  return s;
}

function choose(slot, slotKcal, prefs, ctx) {
  const list = candidates(slot, prefs, ctx);
  if (!list.length) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const r of list) {
    const n = recipeNutrition(r);
    const scale = slotKcal / n.kcal;
    // Penalise recipes that must be stretched far from a natural portion.
    const stretch = scale < MIN_SCALE || scale > MAX_SCALE ? 2.5 : Math.abs(Math.log(scale)) * 0.8;
    const s = score(r, { ...ctx, scale: clamp(scale, MIN_SCALE, MAX_SCALE) }) - stretch;
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

/**
 * Build one day. Returns meals with portion scales chosen so the day hits target kcal.
 * @param ctx {rand, recent: Map(recipeId -> daysAgo), favorites, weekend, leftovers: {lunch: recipeId}}
 */
export function planDay(targets, prefs, ctx) {
  // Very high targets get a sixth eating occasion so portions stay realistic.
  const auto = targets.kcal >= 3200 ? 6 : targets.kcal >= 2300 ? 5 : 4;
  const mealsPerDay = targets.kcal >= 3200 ? Math.max(auto, prefs.mealsPerDay || 0) : clamp(prefs.mealsPerDay || auto, 3, 5);
  const split = SLOT_SPLIT[mealsPerDay];
  const slots = Object.keys(split);
  const meals = [];
  let proteinSoFar = 0;
  let kcalSoFar = 0;
  let fibreSoFar = 0;
  const fibreMax = fibreCeiling(targets.kcal);
  const used = new Set();
  for (const slot of slots) {
    const slotKcal = targets.kcal * split[slot];
    const remainingP = targets.proteinG - proteinSoFar;
    const remainingK = Math.max(targets.kcal - kcalSoFar, 1);
    // How badly do we still need protein relative to calories left? (>1 means behind)
    const proteinNeed = clamp((remainingP * 4) / remainingK / 0.25, 0.5, 2.5);
    let recipe = null;
    if (slot === 'lunch' && ctx.leftovers?.lunch) recipe = RECIPES.find((r) => r.id === ctx.leftovers.lunch) || null;
    if (ctx.locked?.[slot]) recipe = RECIPES.find((r) => r.id === ctx.locked[slot]) || recipe;
    if (!recipe) {
      const recent = new Map(ctx.recent);
      used.forEach((id) => recent.set(id, 0));
      // Fibre room for this slot: its share of the ceiling, plus anything unused by earlier slots.
      const fibreRoom = Math.max(0, fibreMax - fibreSoFar) * (split[slot] / slots.slice(slots.indexOf(slot)).reduce((a, k) => a + split[k], 0));
      recipe = choose(slot, slotKcal, prefs, { ...ctx, recent, proteinNeed, fibreRoom });
    }
    if (!recipe) continue;
    used.add(recipe.id);
    const scale = clamp(slotKcal / recipeNutrition(recipe).kcal, MIN_SCALE, MAX_SCALE);
    const n = scaledNutrition(recipe, scale);
    proteinSoFar += n.p;
    kcalSoFar += n.kcal;
    fibreSoFar += n.fib;
    meals.push({ slot, recipeId: recipe.id, scale, leftover: slot === 'lunch' && ctx.leftovers?.lunch === recipe.id });
  }
  fitToTarget(meals, targets.kcal);
  // Protein top-up: on small calorie budgets the day can fall short of the protein minimum.
  // Try swapping snacks (then breakfast) for the most protein-dense option that's allowed.
  const minP = targets.proteinMinG ?? targets.proteinG * 0.85;
  if (dayTotals(meals).p < minP) {
    const order = meals.filter((m) => m.slot.startsWith('snack')).concat(meals.filter((m) => m.slot === 'breakfast'));
    for (const m of order) {
      if (dayTotals(meals).p >= minP || ctx.locked?.[m.slot] || m.leftover) continue;
      const inDay = new Set(meals.map((x) => x.recipeId));
      const options = candidates(m.slot, prefs, ctx)
        .filter((r) => !inDay.has(r.id))
        .sort((a, b) => recipeNutrition(b).p / recipeNutrition(b).kcal - recipeNutrition(a).p / recipeNutrition(a).kcal)
        .slice(0, 2);
      for (const r of options) {
        const trial = meals.map((x) => (x === m ? { ...x, recipeId: r.id } : { ...x }));
        fitToTarget(trial, targets.kcal);
        if (dayTotals(trial).p > dayTotals(meals).p + 3) {
          meals.splice(0, meals.length, ...trial);
          break;
        }
      }
    }
  }
  // At the safety floor, rounding must never take the day below it: nudge portions up.
  if (targets.floor && targets.kcal <= targets.floor) {
    for (let guard = 0; guard < 20 && dayTotals(meals).kcal < targets.kcal; guard++) {
      const m = meals.reduce((a, b) => (scaledNutrition(byId(b.recipeId), b.scale).kcal > scaledNutrition(byId(a.recipeId), a.scale).kcal ? b : a));
      m.scale = round(m.scale + 0.05, 0.05);
    }
  }
  return meals;
}

/** Scale portions so the day's total lands on the calorie target (keeping each slot's share). */
function fitToTarget(meals, kcal) {
  const total = meals.reduce((a, m) => a + scaledNutrition(byId(m.recipeId), m.scale).kcal, 0);
  if (total <= 0) return;
  const k = kcal / total;
  for (const m of meals) m.scale = round(clamp(m.scale * k, MIN_SCALE * 0.9, MAX_SCALE * 1.1), 0.05);
}

export function byId(id) {
  return RECIPES.find((r) => r.id === id);
}

export function dayTotals(meals) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
  for (const m of meals) {
    const n = scaledNutrition(byId(m.recipeId), m.scale);
    for (const k of Object.keys(t)) t[k] += n[k];
  }
  return t;
}

/**
 * Seven-day plan. `variety`: 'low' repeats breakfasts and uses dinner leftovers for lunch (fewest decisions),
 * 'medium' (default), 'high' maximises variety.
 */
export function planWeek(targets, prefs, weekKey, opts = {}) {
  const rand = rng(`${weekKey}|${prefs.seed || 0}|${prefs.diet}|${targets.kcal}`);
  const variety = prefs.variety || 'medium';
  const favorites = prefs.favorites || [];
  const days = [];
  const history = []; // recipe ids per day
  let fixedBreakfast = null;
  for (let d = 0; d < 7; d++) {
    const recent = new Map();
    const lookback = variety === 'high' ? 4 : variety === 'low' ? 1 : 2;
    for (let back = 1; back <= lookback && d - back >= 0; back++) {
      for (const id of history[d - back]) if (!recent.has(id)) recent.set(id, back);
    }
    const weekend = d >= 5;
    const weekCount = new Map();
    for (const ids of history) for (const id of ids) weekCount.set(id, (weekCount.get(id) || 0) + 1);
    const ctx = { rand, recent, favorites, weekend, locked: {}, weekCount };
    if (variety === 'low') {
      if (fixedBreakfast) ctx.locked.breakfast = fixedBreakfast;
      const prevDinner = days[d - 1]?.find((m) => m.slot === 'dinner');
      if (prevDinner && byId(prevDinner.recipeId).batch && prefs.leftovers !== false && d % 2 === 1) ctx.leftovers = { lunch: prevDinner.recipeId };
      recent.delete(fixedBreakfast);
    } else if (variety === 'medium' && d > 0) {
      const prevDinner = days[d - 1].find((m) => m.slot === 'dinner');
      if (prevDinner && byId(prevDinner.recipeId).batch && prefs.leftovers !== false && d % 2 === 1) {
        ctx.leftovers = { lunch: prevDinner.recipeId };
      }
    }
    if (opts.overrides?.[d]) Object.assign(ctx.locked, opts.overrides[d]);
    const meals = planDay(targets, prefs, ctx);
    if (variety === 'low' && !fixedBreakfast) fixedBreakfast = meals.find((m) => m.slot === 'breakfast')?.recipeId;
    days.push(meals);
    history.push(meals.map((m) => m.recipeId));
  }
  return days;
}

/** Swap one meal for the next-best alternative not already in that day. */
export function swapMeal(targets, prefs, dayMeals, slot, seed) {
  const rand = rng(`swap|${seed}`);
  const recent = new Map(dayMeals.map((m) => [m.recipeId, 0]));
  const current = dayMeals.find((m) => m.slot === slot);
  const locked = {};
  for (const m of dayMeals) if (m.slot !== slot) locked[m.slot] = m.recipeId;
  const blocked = [...(prefs.blockedRecipes || []), current?.recipeId].filter(Boolean);
  const meals = planDay(targets, { ...prefs, blockedRecipes: blocked }, { rand, recent, favorites: prefs.favorites || [], locked });
  return meals;
}

/** The day re-planned with `recipeId` in `slot` (other meals stay; portions rebalance). */
export function swapTo(targets, prefs, dayMeals, slot, recipeId) {
  const locked = { [slot]: recipeId };
  for (const m of dayMeals) if (m.slot !== slot) locked[m.slot] = m.recipeId;
  return planDay(targets, prefs, { rand: rng(`swapTo|${slot}|${recipeId}`), recent: new Map(dayMeals.map((m) => [m.recipeId, 0])), favorites: prefs.favorites || [], locked });
}

/** Up to `n` different recipes that fit this slot today (best fits first), skipping `skip`. */
export function swapOptions(targets, prefs, dayMeals, slot, n = 5, skip = []) {
  const current = dayMeals.find((m) => m.slot === slot)?.recipeId;
  const found = [];
  for (let i = 0; i < 40 && found.length < n; i++) {
    const meals = swapMeal(targets, { ...prefs, blockedRecipes: [...(prefs.blockedRecipes || []), ...skip, ...found] }, dayMeals, slot, `opt${i}`);
    const id = meals.find((m) => m.slot === slot)?.recipeId;
    if (id && id !== current && !found.includes(id) && !skip.includes(id)) found.push(id);
  }
  return found;
}

/** Aggregate ingredients for a set of days into a shopping list grouped by aisle. */
export function shoppingList(days) {
  const totals = new Map();
  for (const meals of days) {
    for (const m of meals) {
      for (const [fid, g] of byId(m.recipeId).ingredients) totals.set(fid, (totals.get(fid) || 0) + g * m.scale);
    }
  }
  const aisles = {};
  for (const [fid, g] of totals) {
    const food = FOODS[fid];
    (aisles[food.aisle] ||= []).push({ id: fid, name: food.name, grams: g, display: formatQty(fid, g) });
  }
  for (const list of Object.values(aisles)) list.sort((a, b) => a.name.localeCompare(b.name));
  return aisles;
}

export function formatQty(fid, grams, units = 'metric') {
  const food = FOODS[fid];
  if (food?.each) {
    const n = grams / food.each.g;
    const shown = n < 1 ? round(n, 0.5) || 0.5 : round(n, 0.5);
    const unit = shown === 1 ? food.each.unit : `${food.each.unit}s`;
    return `${shown} ${unit}`;
  }
  if (units === 'imperial') {
    const oz = grams / 28.35;
    return oz >= 16 ? `${round(oz / 16, 0.1)} lb` : `${round(oz, oz < 2 ? 0.25 : 0.5)} oz`;
  }
  if (grams >= 1000) return `${round(grams / 1000, 0.05)} kg`;
  return `${round(grams, grams < 30 ? 1 : 5)} g`;
}

/** Ingredient line for recipes: "2 slices wholegrain bread", "1.5 × eggs", "150 g greek yogurt". */
export function ingredientText(fid, grams, units = 'metric') {
  const food = FOODS[fid];
  const q = formatQty(fid, grams, units);
  const name = food.name.toLowerCase();
  if (food.each && name.includes(food.each.unit)) return `${q.split(' ')[0]} × ${name}`;
  return `${q} ${name}`;
}
