// Weekly meal plan: browse days, swap meals, star favourites, regenerate.
import { html, esc, icon, chips, fmtDate, fmtNum } from '../ui/dom.js';
import { mealRows } from './sheets.js';
import * as store from '../store.js';
import { recipeDetails, mealMeta, slotLabel, totalsLine, dayIndex, setMealStatus, eatenSoFar, dayComplete } from './shared.js';
import { markChosen } from './shared.js';
import { byId, swapMeal, candidates, recipeNutrition, planDay, SLOT_LABEL, dayTotals } from '../engine/meals.js';
import { RECIPES } from '../data/recipes.js';
import { rng } from '../engine/util.js';
import { weekStart, dateInWeek, weekOrder } from '../engine/util.js';
import { DIETS } from '../data/foods.js';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function browser(state, slot, di) {
  const date = store.today();
  const wk = weekStart(date);
  const showNumbers = !store.habitsOnly(state);
  const base = slot.startsWith('snack') ? 'snack' : slot;
  const allowedIds = new Set(candidates(slot, { ...state.prefs, maxMinutesWeekday: 999, maxMinutesWeekend: 999, budget: 'flexible' }).map((r) => r.id));
  const list = RECIPES.filter((r) => r.slot === base && allowedIds.has(r.id));
  const u = state.profile.units === 'imperial' ? 'imperial' : 'metric';
  return html`<a class="btn ghost small" href="#/meals/${di}">${icon('back')}Back to ${DAY[di]}</a>
    <h1>Choose a ${esc((SLOT_LABEL[slot] || slot).toLowerCase())}</h1>
    <p class="muted">${list.length} recipes that fit your diet and allergies. Portions are scaled to fit the day when you pick one.</p>
    <ul class="list card">${list.map((r) => {
      const n = recipeNutrition(r);
      return `<li class="meal"><div><div class="name">${esc(r.name)}</div><div class="meta">${r.minutes} min${showNumbers ? ` · per base portion ${Math.round(n.kcal)} kcal · ${Math.round(n.p)} g protein · ${Math.round(n.fib)} g fibre` : ''} ${r.batch ? '<span class="tag">batch-friendly</span>' : ''}${r.nocook ? '<span class="tag">no-cook</span>' : ''}</div></div>
        <div class="actions"><button class="btn small primary" data-action="pick" data-id="${r.id}" data-slot="${slot}" data-day="${di}">Use</button></div>
        ${recipeDetails({ recipeId: r.id, scale: 1 }, u)}</li>`;
    }).join('')}</ul>`;
  void wk;
}

export default {
  render(state, params) {
    if (params[0] === 'recipes') return browser(state, params[1] || 'dinner', Math.max(0, Math.min(6, Number(params[2]) || 0)));
    const date = store.today();
    const wk = weekStart(date);
    const plan = state.plans[wk];
    const di = params[0] != null && params[0] !== '' ? Math.max(0, Math.min(6, Number(params[0]))) : dayIndex(date);
    const meals = plan.days[di] || [];
    const u = state.profile.units === 'imperial' ? 'imperial' : 'metric';
    const showNumbers = !store.habitsOnly(state);
    const t = store.targets(state, dateInWeek(wk, di));
    const favs = new Set(state.prefs.favorites || []);
    const dayDate = dateInWeek(wk, di);
    const canLog = dayDate <= date;
    const log = state.mealLog[dayDate] || {};
    const tabs = weekOrder().map((i) => {
      const dd = dateInWeek(wk, i);
      return `<a href="#/meals/${i}" class="${i === di ? 'on' : ''} ${dd === date ? 'today' : ''}">${DAY[i]}<b>${Number(dd.slice(8))}</b></a>`;
    }).join('');
    const totals = dayTotals(meals);
    return html`<header class="page-head"><div><div class="eyebrow">This week</div><h1>Meal plan</h1></div><a class="btn tonal small" href="#/shopping" aria-label="Shopping list">${icon('cart')}List</a></header>
      <nav class="scroll-x daytabs" aria-label="Days">${tabs}</nav>
      ${canLog && dayDate < date && !dayComplete(state, dayDate) ? `<div class="notice info">${icon('info')}<div>Forgot to log this day? Tick what you ate — complete days help the app learn your real energy needs.</div></div>` : ''}
      <div class="section-head"><h2>${fmtDate(dayDate, { weekday: 'long', day: 'numeric', month: 'short' })}</h2>${showNumbers ? `<span class="meta">${fmtNum(totals.kcal, 10)} kcal · ${Math.round(totals.p)} g protein · ${Math.round(totals.fib)} g fibre</span>` : ''}</div>
      <div class="card tight">
        ${canLog && showNumbers ? `<div class="kcal-sum"><div class="row between nowrap"><div><span class="big">${fmtNum(eatenSoFar(state, dayDate))}</span> <span class="of">/ ${fmtNum(t.kcal)} kcal logged</span></div><span class="of">${dayComplete(state, dayDate) ? '✓ Complete' : ''}</span></div><div class="meter"><span style="width:${Math.min(100, (eatenSoFar(state, dayDate) / t.kcal) * 100).toFixed(1)}%"></span></div></div>` : ''}
        <ul class="rows">${mealRows(state, dayDate)}</ul>
      </div>
      <p class="muted" style="font-size:var(--text-sm);margin:-4px 4px 18px">${showNumbers ? `Built to about ${t.kcal.toLocaleString()} kcal, ${t.proteinG} g protein and ${t.fiberG}+ g fibre. ` : ''}Tap a meal for the recipe, to swap it or to log it.</p>
      <details class="card"><summary class="row nowrap" style="cursor:pointer;list-style:none"><span class="slot-ico">${icon('settings')}</span><span class="grow"><strong>Plan settings</strong><span class="sub" style="display:block;font-size:var(--text-sm);color:var(--ink-3)">${esc(DIETS[state.prefs.diet]?.label || '')} · ${esc(state.prefs.variety || 'medium')} variety · up to ${state.prefs.maxMinutesWeekday} min on weekdays</span></span>${icon('chevron')}</summary>
        <form data-form="prefs" style="margin-top:16px">
          <div class="grid two">
            <fieldset><legend>Diet</legend>${chips('diet', Object.fromEntries(Object.entries(DIETS).map(([k, d]) => [k, d.label])), state.prefs.diet, { multi: false })}</fieldset>
            <fieldset><legend>Variety</legend>${chips('variety', { low: 'Low (repeat meals)', medium: 'Medium', high: 'High' }, state.prefs.variety || 'medium', { multi: false })}</fieldset>
            <label class="field"><span>Meals a day</span><select name="mealsPerDay">${[['', 'Auto'], ['3', '3'], ['4', '3 + snack'], ['5', '3 + 2 snacks']].map(([v, l]) => `<option value="${v}" ${String(state.prefs.mealsPerDay || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="field"><span>Weekday cooking time</span><select name="maxMinutesWeekday">${[15, 30, 45, 60].map((v) => `<option value="${v}" ${Number(state.prefs.maxMinutesWeekday) === v ? 'selected' : ''}>Up to ${v} min</option>`).join('')}</select></label>
          </div>
          <div class="row"><button class="btn primary">Save & rebuild plan</button><button type="button" class="btn" data-action="regen">${icon('swap')}Give me a different week</button></div>
          <p class="muted" style="font-size:.85rem;margin-top:10px">Allergies and disliked foods are in <a href="#/settings">Settings</a>. ${state.prefs.blockedRecipes?.length ? `${state.prefs.blockedRecipes.length} recipe(s) hidden — <button type="button" class="btn small ghost" data-action="unblock">show them again</button>` : ''}</p>
        </form>
      </details>
      <details class="card flat"><summary class="row nowrap" style="cursor:pointer;list-style:none"><span class="grow"><strong>Why the plan looks like this</strong></span>${icon('chevron')}</summary><ul class="muted-2" style="padding-left:20px;margin:12px 0 0;font-size:.93rem">
        <li><strong>Protein first:</strong> it’s the most filling nutrient and protects muscle while you lose fat.</li>
        <li><strong>Lots of vegetables, beans and fruit:</strong> high-volume, low-energy-density foods let you eat satisfying portions.</li>
        <li><strong>Mostly minimally processed:</strong> in a controlled trial, people ate ~500 kcal/day more on ultra-processed food without noticing.</li>
        <li><strong>Repeats and leftovers on purpose:</strong> fewer decisions makes the plan easier to follow — and following it is what works.</li>
      </ul></details>`;
  },
  after(root) {
    root.querySelector('.daytabs a.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  },
  actions: {
    ate(el, ev, ctx) {
      ctx.update((st) => setMealStatus(st, el.dataset.date, el.dataset.slot, (cur) => (cur?.status === 'ate' ? null : { status: 'ate' })));
    },
    skip(el, ev, ctx) {
      ctx.update((st) => setMealStatus(st, el.dataset.date, el.dataset.slot, (cur) => (cur?.status === 'skip' ? null : { status: 'skip' })));
    },
    async other(el, ev, ctx) {
      const show = !store.habitsOnly(ctx.state);
      const v = show ? await ctx.ask('Roughly how many calories was it? A rough guess is fine.', { value: '500' }) : '0';
      if (v == null) return;
      ctx.update((st) => setMealStatus(st, el.dataset.date, el.dataset.slot, () => ({ status: 'other', kcal: Math.max(0, Number(v) || 0) })));
    },
    pick(el, ev, ctx) {
      const s = ctx.state;
      const wk = weekStart(store.today());
      const di = Number(el.dataset.day);
      const slot = el.dataset.slot;
      const t = store.targets(s, dateInWeek(wk, di));
      const locked = {};
      for (const m of s.plans[wk].days[di]) locked[m.slot] = m.recipeId;
      locked[slot] = el.dataset.id;
      const meals = markChosen(planDay(t, s.prefs, { rand: rng(`pick|${Date.now()}`), recent: new Map(), favorites: s.prefs.favorites || [], locked }), s.plans[wk].days[di], slot);
      ctx.update((st) => {
        st.plans[wk].days[di] = meals;
        return st;
      });
      ctx.toast('Added. Portions re-balanced across the day.');
      ctx.go(`#/meals/${di}`);
    },
    swap(el, ev, ctx) {
      const s = ctx.state;
      const wk = weekStart(store.today());
      const di = Number(el.dataset.day);
      const t = store.targets(s, dateInWeek(wk, di));
      const meals = markChosen(swapMeal(t, s.prefs, s.plans[wk].days[di], el.dataset.slot, `${wk}|${di}|${Date.now()}`), s.plans[wk].days[di], el.dataset.slot);
      ctx.update((st) => {
        st.plans[wk].days[di] = meals;
        return st;
      });
    },
    fav(el, ev, ctx) {
      const id = el.dataset.id;
      ctx.update((st) => {
        const f = new Set(st.prefs.favorites || []);
        f.has(id) ? f.delete(id) : f.add(id);
        st.prefs.favorites = [...f];
        // Favourites change scoring; keep the current week's plan but stamp it so it isn't rebuilt.
        return keepPlan(st);
      });
      ctx.toast('Favourites appear more often in future weeks.');
    },
    block(el, ev, ctx) {
      const s = ctx.state;
      const wk = weekStart(store.today());
      const di = Number(el.dataset.day);
      const id = el.dataset.id;
      ctx.update((st) => {
        st.prefs.blockedRecipes = [...new Set([...(st.prefs.blockedRecipes || []), id])];
        st.prefs.favorites = (st.prefs.favorites || []).filter((x) => x !== id);
        return st; // signature changes → the rest of the week is rebuilt without it
      });
      ctx.toast('Got it — that recipe won’t be suggested.');
      void s;
      void di;
    },
    unblock(el, ev, ctx) {
      ctx.update((st) => {
        st.prefs.blockedRecipes = [];
        return st;
      });
    },
    regen(el, ev, ctx) {
      ctx.update((st) => {
        st.prefs.seed = (st.prefs.seed || 0) + 1;
        return st;
      });
      ctx.toast('New week generated. Past days are kept as they were.');
    },
    prefs(form, ev, ctx, data) {
      ctx.update((st) => {
        st.prefs.diet = data.diet || st.prefs.diet;
        st.prefs.variety = data.variety || st.prefs.variety;
        st.prefs.mealsPerDay = data.mealsPerDay ? Number(data.mealsPerDay) : null;
        st.prefs.maxMinutesWeekday = Number(data.maxMinutesWeekday) || 30;
        return st;
      });
      ctx.toast('Plan rebuilt.');
    },
  },
};

/** Re-sign the current plan after a change that shouldn't rebuild it (like starring a meal). */
function keepPlan(st) {
  const { plan } = store.ensurePlan(st);
  const wk = weekStart(store.today());
  const old = st.plans[wk];
  if (old) st.plans[wk] = { ...plan, days: old.days };
  return st;
}
