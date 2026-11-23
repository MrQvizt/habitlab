// Bottom-sheet flows shared by Today and Meals: a meal's detail + logging, weigh-in stepper,
// steps, extra food and habit detail. Every reversible change offers Undo instead of asking first.
import { esc, icon, fmtNum, fmtWeight, toKg, weightNum } from '../ui/dom.js';
import { openSheet, closeSheet, updateSheet } from '../ui/sheet.js';
import * as store from '../store.js';
import { mealsFor, setMealStatus, markChosen, dayIndex, computeIntake } from './shared.js';
import { byId, scaledNutrition, swapMeal, ingredientText, SLOT_LABEL } from '../engine/meals.js';
import { FOODS } from '../data/foods.js';
import { habitById, streak } from '../engine/habits.js';
import { stepGoal } from '../engine/workouts.js';
import { round, weekStart, isoDate, addDays } from '../engine/util.js';

const SLOT_ICON = { breakfast: 'today', lunch: 'meals', dinner: 'meals', snack: 'star', snack2: 'star', snack3: 'star' };
export const slotIcon = (slot) => SLOT_ICON[slot] || 'meals';

function units(state) {
  return state.profile.units === 'imperial' ? 'imperial' : 'metric';
}

// ---------- Meal ----------
function mealSheetHtml(state, date, slot, mode = '') {
  const meal = mealsFor(state, date).find((m) => m.slot === slot);
  if (!meal) return '<p class="muted">This meal isn’t in the plan any more.</p>';
  const r = byId(meal.recipeId);
  const n = scaledNutrition(r, meal.scale);
  const show = !store.habitsOnly(state);
  const status = state.mealLog?.[date]?.[slot]?.status;
  const isToday = date === store.today();
  const u = units(state);
  const facts = [
    `${icon('clock', 'tiny')} ${meal.leftover ? 'leftovers' : `${r.minutes} min`}`,
    ...(show ? [`${fmtNum(n.kcal, 10)} kcal`, `${Math.round(n.p)} g protein`, `${Math.round(n.fib)} g fibre`] : []),
    ...(r.batch ? ['batch-friendly'] : []),
    ...(r.nocook ? ['no-cook'] : []),
  ];
  const fav = (state.prefs.favorites || []).includes(r.id);
  const statusLine = status === 'ate' ? 'Logged as eaten' : status === 'skip' ? 'Logged as skipped' : status === 'other' ? `Logged: something else${show ? ` (${fmtNum(state.mealLog[date][slot].kcal)} kcal)` : ''}` : '';
  const other = mode === 'other'
    ? `<form data-form="sheetMealOtherSave" data-date="${date}" data-slot="${slot}" class="card flat" style="margin:12px 0">
        <label class="field" style="margin:0"><span>${show ? 'Roughly how many calories? A guess is fine.' : 'What did you have instead? (optional)'}</span>
        ${show ? `<div class="quick-chips">${[300, 500, 700, 900].map((k) => `<button type="button" data-action="sheetQuickKcal" data-v="${k}">${k}</button>`).join('')}</div>
        <div class="inline-inputs"><input type="number" name="kcal" inputmode="numeric" min="0" max="5000" value="500" autofocus><span class="unit">kcal</span></div>` : '<input type="text" name="note" maxlength="60">'}</label>
        <div class="row" style="margin-top:12px"><button class="btn primary">Save</button><button type="button" class="btn ghost" data-action="sheetMealBack" data-date="${date}" data-slot="${slot}">Cancel</button></div>
      </form>`
    : '';
  return `<div class="sheet-head"><div><div class="over">${esc(SLOT_LABEL[slot] || slot)}${isToday ? '' : ` · ${esc(new Date(date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' }))}`}</div><h2>${esc(r.name)}</h2></div>
      <button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <div class="facts">${facts.map((f) => `<span class="tag">${f}</span>`).join('')}</div>
    ${statusLine ? `<div class="notice ok" style="margin:14px 0 0">${icon('check')}<div class="grow">${esc(statusLine)}</div><button class="btn small ghost" data-action="sheetMealClear" data-date="${date}" data-slot="${slot}">Clear</button></div>` : ''}
    ${other || (date <= store.today() ? `<div class="actions-grid">
      <button class="btn primary full" data-action="sheetMealAte" data-date="${date}" data-slot="${slot}">${icon('check')}I ate this</button>
      <button class="btn" data-action="sheetMealOther" data-date="${date}" data-slot="${slot}">Something else</button>
      <button class="btn" data-action="sheetMealSkip" data-date="${date}" data-slot="${slot}">Skipped it</button>
    </div>` : '<div style="height:12px"></div>')}
    <div class="row" style="gap:8px">
      <button class="btn tonal small" data-action="sheetMealSwap" data-date="${date}" data-slot="${slot}">${icon('swap')}Swap</button>
      <a class="btn tonal small" href="#/meals/recipes/${slot}/${dayIndex(date)}">Choose a recipe</a>
      <button class="btn small ${fav ? 'on' : ''}" data-action="sheetFav" data-id="${r.id}" data-date="${date}" data-slot="${slot}" aria-pressed="${fav}">${icon('star')}${fav ? 'Favourite' : 'Favourite'}</button>
    </div>
    <div class="section-title">Ingredients${meal.scale !== 1 ? ` <span class="muted" style="font-weight:500">· your portion</span>` : ''}</div>
    <ul class="ingredients">${r.ingredients.map(([fid, g]) => `<li>${esc(ingredientText(fid, g * meal.scale, u))}</li>`).join('')}</ul>
    <div class="section-title">Method</div>
    <ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    <p class="muted" style="font-size:var(--text-sm);margin-top:12px">Season freely with herbs, spices, garlic, lemon, vinegar and mustard.</p>
    <button class="btn ghost small danger" data-action="sheetBlock" data-id="${r.id}" style="margin-top:4px">Don’t suggest this recipe again</button>`;
}

/** Meal rows (shared by Today and Meals). Ticking is possible for today and past days. */
export function mealRows(state, date) {
  const meals = mealsFor(state, date);
  const log = state.mealLog[date] || {};
  const show = !store.habitsOnly(state);
  const canLog = date <= store.today();
  const favs = new Set(state.prefs.favorites || []);
  return meals.map((m) => {
    const r = byId(m.recipeId);
    const n = scaledNutrition(r, m.scale);
    const st = log[m.slot]?.status;
    const sub = st === 'skip' ? 'Skipped' : st === 'other' ? `Something else${show ? ` · ${fmtNum(log[m.slot].kcal)} kcal` : ''}` : `${m.leftover ? 'Leftovers' : `${r.minutes} min`}${show ? ` · ${Math.round(n.p)} g protein` : ''}${r.batch && !m.leftover ? ' · batch' : ''}`;
    const lead = canLog
      ? `<button class="check ${st === 'ate' || st === 'other' ? 'on' : st === 'skip' ? 'skip' : ''}" data-action="mealCheck" data-date="${date}" data-slot="${m.slot}" aria-pressed="${!!st}" aria-label="${st ? 'Clear log for' : 'Mark eaten:'} ${esc(r.name)}">${st === 'skip' ? icon('x') : icon('check')}</button>`
      : `<span class="slot-ico">${icon(slotIcon(m.slot))}</span>`;
    return `<li><div class="lrow ${st ? 'done' : ''}">${lead}
      <button class="body row-btn" data-action="openMeal" data-slot="${m.slot}" data-date="${date}"><div class="over">${esc(SLOT_LABEL[m.slot] || m.slot)}${show ? ` · ${fmtNum(n.kcal, 10)} kcal` : ''}${favs.has(r.id) ? ' · ★' : ''}</div><div class="title"><span>${esc(r.name)}</span></div><div class="sub">${sub}</div></button>
      <span class="trail" aria-hidden="true">${icon('chevron')}</span></div></li>`;
  }).join('');
}

export function openMeal(ctx, date, slot) {
  openSheet(mealSheetHtml(ctx.state, date, slot), { label: 'Meal details' });
}

// ---------- Weigh-in ----------
function dateChips(name = 'date') {
  const t = store.today();
  const opts = [[t, 'Today'], [addDays(t, -1), 'Yesterday'], [addDays(t, -2), new Date(addDays(t, -2) + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' })]];
  return `<div class="segmented" role="radiogroup" aria-label="Date" style="margin:4px 0 6px">${opts.map(([v, l], i) => `<label><input type="radio" name="${name}" value="${v}" ${i === 0 ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
}

function weighSheetHtml(state, withDate = false) {
  const u = units(state);
  const date = store.today();
  const todays = state.weights.find((w) => w.date === date);
  const last = todays?.kg ?? state.weights[state.weights.length - 1]?.kg ?? state.profile.weightKg;
  const v = round(weightNum(last, u), 0.1).toFixed(1);
  const step = u === 'imperial' ? 0.2 : 0.1;
  return `<div class="sheet-head"><div><div class="over">Weigh-in</div><h2>${todays ? 'Update today’s weight' : 'Today’s weight'}</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <p class="muted" style="margin:0">Same time each morning, after the bathroom. Daily numbers bounce with water — the trend is what counts.</p>
    <form data-form="sheetWeigh">
      ${withDate ? dateChips() : ''}
      <div class="stepper">
        <button type="button" data-action="sheetStep" data-d="${-step}" aria-label="Decrease">−</button>
        <div class="val"><input name="w" type="number" inputmode="decimal" step="${step}" value="${v}" aria-label="Weight in ${u === 'imperial' ? 'pounds' : 'kilograms'}"><span class="unit">${u === 'imperial' ? 'lb' : 'kg'}</span></div>
        <button type="button" data-action="sheetStep" data-d="${step}" aria-label="Increase">+</button>
      </div>
      <button class="btn primary large block" style="margin-top:14px">Save weigh-in</button>
    </form>`;
}

// ---------- Steps ----------
function stepsSheetHtml(state) {
  const date = store.today();
  const goal = stepGoal(state.profile.baselineSteps, state.profile.stepLevel || 0, state.profile.age);
  const cur = state.steps[date] || 0;
  return `<div class="sheet-head"><div><div class="over">Steps · goal ${fmtNum(goal)}</div><h2>Steps today</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <p class="muted" style="margin:0">Copy the number from your phone or watch.</p>
    <form data-form="sheetSteps">
      <div class="stepper"><button type="button" data-action="sheetStep" data-d="-500" aria-label="Minus 500">−</button>
      <div class="val"><input name="steps" type="number" inputmode="numeric" min="0" max="100000" step="1" value="${cur}" autofocus aria-label="Steps"><span class="unit">steps</span></div>
      <button type="button" data-action="sheetStep" data-d="500" aria-label="Plus 500">+</button></div>
      <button class="btn primary large block" style="margin-top:14px">Save steps</button>
    </form>`;
}

// ---------- Extra food ----------
function extraSheetHtml(state) {
  const show = !store.habitsOnly(state);
  return `<div class="sheet-head"><div><div class="over">Not on the plan</div><h2>Add something you ate</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <form data-form="sheetExtra">
      <label class="field"><span>What was it?</span><input type="text" name="label" maxlength="60" placeholder="e.g. latte, biscuit, glass of wine" autofocus></label>
      ${show ? `<label class="field"><span>Roughly how many calories?</span><div class="quick-chips">${[50, 100, 150, 250, 400].map((k) => `<button type="button" data-action="sheetQuickKcal" data-v="${k}">${k}</button>`).join('')}</div><div class="inline-inputs"><input type="number" name="kcal" inputmode="numeric" min="0" max="3000" placeholder="kcal"><span class="unit">kcal</span></div></label>` : ''}
      <button class="btn primary large block">Add</button>
      <p class="muted" style="font-size:var(--text-sm);margin-top:10px">Logging honestly is what matters — it earns the same as eating to plan.</p>
    </form>`;
}

// ---------- Habit ----------
function habitSheetHtml(state, id) {
  const a = state.habits.active.find((x) => x.id === id);
  const h = habitById(id);
  if (!a || !h) return '';
  const date = store.today();
  const on = !!state.habits.log[date]?.[id];
  const st = streak(state.habits.log, id, date);
  return `<div class="sheet-head"><div><div class="over">Habit · ${st}-day streak</div><h2>${esc(h.title)}</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <div class="card flat" style="margin:0 0 12px"><div class="eyebrow">Your plan</div><p style="margin:4px 0 0;font-weight:600">${esc(a.cue)} → ${esc(h.title.toLowerCase())}</p></div>
    <p><strong>Hard day?</strong> ${esc(h.tiny)}.</p>
    <p class="muted">${esc(h.why)}</p>
    <div class="actions-grid"><button class="btn ${on ? '' : 'primary'} full" data-action="sheetHabitToggle" data-id="${id}">${on ? 'Mark as not done' : `${icon('check')}Done today`}</button></div>
    <a class="btn ghost small" href="#/habits">Edit cue & see history</a>`;
}

/** Actions to spread into a view's `actions`. */
export const sheetActions = {
  mealCheck(el, ev, ctx) {
    const date = el.dataset.date || store.today();
    const slot = el.dataset.slot;
    const cur = ctx.state.mealLog[date]?.[slot];
    if (cur) ctx.undoable('Log cleared', (st) => setMealStatus(st, date, slot, () => null));
    else ctx.undoable('Meal logged', (st) => setMealStatus(st, date, slot, () => ({ status: 'ate' })));
  },
  sheetFav(el, ev, ctx) {
    const id = el.dataset.id;
    const on = (ctx.state.prefs.favorites || []).includes(id);
    ctx.update((st) => {
      const f = new Set(st.prefs.favorites || []);
      on ? f.delete(id) : f.add(id);
      st.prefs.favorites = [...f];
      return keepCurrentPlan(st);
    });
    updateSheet(mealSheetHtml(ctx.state, el.dataset.date, el.dataset.slot));
    ctx.toast(on ? 'Removed from favourites' : 'Favourite saved — it’ll come up more often');
  },
  sheetBlock(el, ev, ctx) {
    const id = el.dataset.id;
    closeSheet();
    ctx.undoable('Won’t be suggested again', (st) => {
      st.prefs.blockedRecipes = [...new Set([...(st.prefs.blockedRecipes || []), id])];
      st.prefs.favorites = (st.prefs.favorites || []).filter((x) => x !== id);
      return st;
    });
  },
  sheetClose() {
    closeSheet();
  },
  openMeal(el, ev, ctx) {
    openMeal(ctx, el.dataset.date || store.today(), el.dataset.slot);
  },
  sheetMealAte(el, ev, ctx) {
    const { date, slot } = el.dataset;
    closeSheet();
    ctx.undoable('Meal logged', (st) => setMealStatus(st, date, slot, () => ({ status: 'ate' })));
  },
  sheetMealSkip(el, ev, ctx) {
    const { date, slot } = el.dataset;
    closeSheet();
    ctx.undoable('Marked as skipped', (st) => setMealStatus(st, date, slot, () => ({ status: 'skip' })));
  },
  sheetMealClear(el, ev, ctx) {
    const { date, slot } = el.dataset;
    closeSheet();
    ctx.undoable('Log cleared', (st) => setMealStatus(st, date, slot, () => null));
  },
  sheetMealOther(el, ev, ctx) {
    updateSheet(mealSheetHtml(ctx.state, el.dataset.date, el.dataset.slot, 'other'));
    setTimeout(() => document.querySelector('.sheet input[name=kcal], .sheet input[name=note]')?.focus(), 30);
  },
  sheetMealBack(el, ev, ctx) {
    updateSheet(mealSheetHtml(ctx.state, el.dataset.date, el.dataset.slot));
  },
  sheetQuickKcal(el) {
    const input = el.closest('form').querySelector('input[name=kcal]');
    if (input) input.value = el.dataset.v;
  },
  sheetMealOtherSave(form, ev, ctx, data) {
    const { date, slot } = form.dataset;
    closeSheet();
    ctx.undoable('Logged', (st) => setMealStatus(st, date, slot, () => ({ status: 'other', kcal: Math.max(0, Number(data.kcal) || 0) })));
  },
  sheetMealSwap(el, ev, ctx) {
    const { date, slot } = el.dataset;
    const s = ctx.state;
    const wk = weekStart(date);
    const di = dayIndex(date);
    const t = store.targets(s, date);
    const meals = markChosen(swapMeal(t, s.prefs, s.plans[wk].days[di], slot, `${date}|${Date.now()}`), s.plans[wk].days[di], slot);
    const prev = structuredClone(s);
    ctx.update((st) => {
      st.plans[wk].days[di] = meals;
      return st;
    });
    updateSheet(mealSheetHtml(ctx.state, date, slot));
    ctx.toast(`Swapped for ${byId(meals.find((m) => m.slot === slot).recipeId).name}`, { action: { label: 'Undo', run: () => (ctx.set(prev, { quiet: true }), closeSheet()) } });
  },
  openWeigh(el, ev, ctx) {
    openSheet(weighSheetHtml(ctx.state, el.dataset.pickDate === '1'), { label: 'Weigh-in' });
  },
  openWaist(el, ev, ctx) {
    const u = units(ctx.state);
    const last = (ctx.state.waist || []).slice(-1)[0]?.cm ?? 100;
    const v = u === 'imperial' ? round(last / 2.54, 0.5) : round(last, 0.5);
    openSheet(`<div class="sheet-head"><div><div class="over">Waist</div><h2>Waist measurement</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
      <p class="muted" style="margin:0">Around your middle, level with your belly button, breathing out.</p>
      <form data-form="sheetWaist"><div class="stepper"><button type="button" data-action="sheetStep" data-d="-0.5" aria-label="Decrease">−</button>
        <div class="val"><input name="v" type="number" inputmode="decimal" step="0.5" value="${v.toFixed(1)}" aria-label="Waist"><span class="unit">${u === 'imperial' ? 'in' : 'cm'}</span></div>
        <button type="button" data-action="sheetStep" data-d="0.5" aria-label="Increase">+</button></div>
        <button class="btn primary large block" style="margin-top:14px">Save</button></form>`, { label: 'Waist' });
  },
  sheetWaist(form, ev, ctx, data) {
    const u = units(ctx.state);
    const v = Number(data.v);
    if (!(v > 20)) return;
    const cm = u === 'imperial' ? round(v * 2.54, 0.5) : v;
    const date = store.today();
    closeSheet();
    ctx.undoable('Waist saved', (st) => {
      st.waist = (st.waist || []).filter((w) => w.date !== date).concat({ date, cm });
      return st;
    });
  },
  sheetStep(el) {
    const input = el.closest('form').querySelector('input[type=number]');
    const d = Number(el.dataset.d);
    const dec = String(d).includes('.') ? 1 : 0;
    input.value = Math.max(0, Number(input.value || 0) + d).toFixed(dec);
    try {
      navigator.vibrate?.(5);
    } catch (e) {
      /* ignore */
    }
  },
  sheetWeigh(form, ev, ctx, data) {
    const u = units(ctx.state);
    const kg = toKg(Number(data.w), u);
    if (!(kg > 30 && kg < 400)) return ctx.toast('That number looks off — please check it.');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') && data.date <= store.today() ? data.date : store.today();
    const prevTrend = store.trendWeight(ctx.state);
    closeSheet();
    ctx.undoable(Math.abs(kg - prevTrend) > 8 ? 'Saved — that’s a big jump; double-check the units.' : 'Weigh-in saved', (st) => {
      st.weights = st.weights.filter((w) => w.date !== date).concat({ date, kg: round(kg, 0.01) }).sort((a, b) => (a.date < b.date ? -1 : 1));
      if (st.habits.active.some((a) => a.id === 'weigh_daily')) st.habits.log[date] = { ...(st.habits.log[date] || {}), weigh_daily: true };
      return st;
    });
  },
  openSteps(el, ev, ctx) {
    openSheet(stepsSheetHtml(ctx.state), { label: 'Steps' });
  },
  sheetSteps(form, ev, ctx, data) {
    const n = Math.round(Number(data.steps));
    if (!(n >= 0)) return;
    const date = store.today();
    closeSheet();
    ctx.undoable('Steps saved', (st) => {
      st.steps[date] = n;
      const goal = stepGoal(st.profile.baselineSteps, st.profile.stepLevel || 0, st.profile.age);
      if (n >= goal && st.habits.active.some((a) => a.id === 'step_goal')) st.habits.log[date] = { ...(st.habits.log[date] || {}), step_goal: true };
      return st;
    });
  },
  openExtra(el, ev, ctx) {
    openSheet(extraSheetHtml(ctx.state), { label: 'Add food' });
  },
  sheetExtra(form, ev, ctx, data) {
    if (!data.label && !data.kcal) return;
    const date = store.today();
    closeSheet();
    ctx.undoable('Added', (st) => {
      st.extras[date] = [...(st.extras[date] || []), { label: data.label || 'Extra', kcal: Number(data.kcal) || 0 }];
      st.intake[date] = computeIntake(st, date);
      return st;
    });
  },
  openHabit(el, ev, ctx) {
    openSheet(habitSheetHtml(ctx.state, el.dataset.id), { label: 'Habit' });
  },
  sheetHabitToggle(el, ev, ctx) {
    closeSheet();
    toggleHabit(ctx, el.dataset.id);
  },
};

/** Re-sign the current plan after a change that shouldn't rebuild it (like starring a recipe). */
function keepCurrentPlan(st) {
  const wk = weekStart(store.today());
  const old = st.plans[wk];
  const { plan } = store.ensurePlan(st);
  if (old) st.plans[wk] = { ...plan, days: old.days };
  return st;
}

export function toggleHabit(ctx, id) {
  const date = store.today();
  ctx.update((st) => {
    const day = { ...(st.habits.log[date] || {}) };
    if (day[id]) delete day[id];
    else day[id] = true;
    st.habits.log[date] = day;
    return st;
  });
}

export { isoDate };
