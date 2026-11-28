// Food picker: search ~3,800 foods (yours first), set how much (portions, cups, slices or grams),
// add sides, build a counter meal (burrito, sub, burger, pizza, salad), create your own food and
// save a combination as one of your meals. Used by "Something else" on a planned meal and by
// "Add something you ate".
import { esc, icon, fmtNum } from '../ui/dom.js';
import { SIDES, SHOWN_SIDES, FOOD_CATS, FOOD_COUNT, searchFoods, totalOf, describe, foodById, foodOf, nutritionOf, gramsOf, ownFoods, newFoodId } from '../data/fooddb.js';
import { TEMPLATES, templateById, matchTemplates, stepsOf, buildFood } from '../data/builder.js';
import { updateSheet } from '../ui/sheet.js';

let items = [];
let rerender = null;
let query = '';
let mode = ''; // '' | 'build' | 'create'
let tplId = '';
let picks = {};
let manage = false;

/** Start a fresh pick; `redraw` re-renders the sheet that hosts the picker. */
export function startPick(redraw) {
  items = [];
  rerender = redraw;
  query = '';
  mode = '';
  picks = {};
  manage = false;
}

export const picked = () => items.slice();
const show1 = (x) => Math.round(x);

// ---------- Search ----------
const hitRow = (x, show) => `<li><button type="button" class="food-hit" data-action="foodAdd" data-id="${esc(x.id)}"><span class="grow"><strong>${esc(x.name)}</strong><small>${esc(x.portion)}${x.g && x.portion !== '100 g' ? ` · ${show1(x.g)} g` : ''}${show ? ` · ${fmtNum(x.kcal)} kcal · ${show1(x.p)} g protein` : ''}${x.src === 'own' ? ' · yours' : ''}</small></span><span class="food-plus" aria-hidden="true">${icon('plus')}</span></button></li>`;
const tplRow = (t) => `<li><button type="button" class="food-hit food-build" data-action="foodMode" data-m="build" data-t="${t.id}"><span class="ql-emoji" aria-hidden="true">${t.emoji}</span><span class="grow"><strong>Build it: ${esc(t.name)}</strong><small>Pick the parts you had — we add it up</small></span>${icon('chevron')}</button></li>`;

function resultsHtml(q, show) {
  if (!q.trim()) return '';
  const tpls = matchTemplates(q).map(tplRow).join('');
  const hits = searchFoods(q);
  if (!hits.length && !tpls) return `<li class="food-none"><span class="muted">Nothing called “${esc(q)}”.</span> <button type="button" class="btn small" data-action="foodMode" data-m="create">${icon('plus')}Create it</button></li>`;
  return tpls + hits.map((x) => hitRow(x, show)).join('');
}

// Live search and gram typing without re-rendering the sheet (keeps the keyboard open).
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.matches?.('[data-food-search]')) {
    query = t.value;
    const box = t.closest('.food-picker');
    const list = box?.querySelector('.food-results');
    if (list) list.innerHTML = resultsHtml(t.value, t.dataset.show === '1');
    const quick = box?.querySelector('.food-quick');
    if (quick) quick.hidden = !!t.value.trim();
  }
  if (t.matches?.('[data-food-grams]')) {
    const it = items[Number(t.dataset.i)];
    if (!it) return;
    it.n = Math.max(0, Math.min(5000, Math.round(Number(t.value) || 0)));
    paintTotals(t.closest('.food-picker'), t.dataset.show === '1');
  }
});

function paintTotals(box, show) {
  if (!box) return;
  items.forEach((it, i) => {
    const el = box.querySelector(`[data-fi-kcal="${i}"]`);
    if (el) el.textContent = itemMeta(it, show);
  });
  const t = totalOf(items);
  const tot = box.querySelector('.food-total');
  if (tot) tot.innerHTML = totalHtml(t);
  const kcal = box.closest('form')?.querySelector('input[name=kcal]');
  if (kcal) kcal.value = t.kcal;
}

const totalHtml = (t) => `<strong>${fmtNum(t.kcal)} kcal</strong> · ${t.p} g protein · ${t.fib} g fibre · ${t.c} g carbs · ${t.f} g fat`;
function itemMeta(it, show) {
  const v = nutritionOf(it);
  const g = gramsOf(it);
  return `${g ? `${show1(g)} g` : ''}${show ? `${g ? ' · ' : ''}${fmtNum(Math.round(v.kcal))} kcal · ${show1(v.p)} g protein` : ''}`;
}

// ---------- What you picked ----------
function itemHtml(it, i, show) {
  const x = foodOf(it);
  if (!x) return '';
  const unitChips = x.units
    ? `<div class="fi-units" role="group" aria-label="Amount of ${esc(x.name)}">${x.units.map(([label], u) => (label === '100 g' ? '' : `<button type="button" class="fi-unit ${it.u !== 'g' && (Number(it.u) || 0) === u ? 'on' : ''}" data-action="foodUnit" data-i="${i}" data-u="${u}">${esc(label)}</button>`)).join('')}<button type="button" class="fi-unit ${it.u === 'g' ? 'on' : ''}" data-action="foodUnit" data-i="${i}" data-u="g">grams</button></div>`
    : '';
  const amount = it.u === 'g'
    ? `<span class="fi-grams"><input type="number" inputmode="numeric" min="0" max="5000" value="${it.n}" data-food-grams data-i="${i}" data-show="${show ? 1 : 0}" aria-label="Grams of ${esc(x.name)}"><span class="unit">g</span></span>`
    : `<span class="stepper mini"><button type="button" data-action="foodStep" data-i="${i}" data-d="-1" aria-label="Less ${esc(x.name)}">−</button><span>${it.n}</span><button type="button" data-action="foodStep" data-i="${i}" data-d="1" aria-label="More ${esc(x.name)}">+</button></span>`;
  return `<li class="food-item"><div class="fi-top"><strong class="grow">${esc(x.name)}</strong><button type="button" class="icon-btn small" data-action="foodRemove" data-i="${i}" aria-label="Remove ${esc(x.name)}">${icon('x')}</button></div>
    ${unitChips}
    <div class="fi-amt">${amount}<small class="muted" data-fi-kcal="${i}">${itemMeta(it, show)}</small></div></li>`;
}

// ---------- Quick picks: your meals, your foods, build it ----------
function quickHtml(state) {
  const meals = state?.foods?.meals || [];
  const own = ownFoods();
  const x = (kind, id, name) => (manage ? `<button type="button" class="chip-x" data-action="${kind}" data-id="${esc(id)}" aria-label="Delete ${esc(name)}">${icon('x')}</button>` : '');
  return `<div class="food-quick" ${query.trim() ? 'hidden' : ''}>
    ${meals.length ? `<div class="over">Your meals</div><div class="side-chips">${meals.map((m) => `<span class="chip-wrap"><button type="button" class="side-chip" data-action="mealUse" data-id="${esc(m.id)}">${esc(m.name)}</button>${x('mealDelete', m.id, m.name)}</span>`).join('')}</div>` : ''}
    ${own.length ? `<div class="over">Your foods</div><div class="side-chips">${own.slice(0, 24).map((f) => `<span class="chip-wrap"><button type="button" class="side-chip" data-action="foodAdd" data-id="${esc(f.id)}">${esc(f.name)}</button>${x('ownDelete', f.id, f.name)}</span>`).join('')}</div>` : ''}
    ${meals.length || own.length ? `<button type="button" class="link-btn" data-action="foodManage">${manage ? 'Done' : 'Edit'}</button>` : ''}
    <button type="button" class="food-hit food-build" data-action="foodMode" data-m="build" data-t=""><span class="ql-emoji" aria-hidden="true">🍽️</span><span class="grow"><strong>Eating out?</strong><small>Build what you had at the counter — we add it up</small></span>${icon('chevron')}</button>
  </div>`;
}

// ---------- Build it ----------
function builderHtml(show) {
  const tpl = templateById(tplId);
  // No template yet: the kinds of counter meals (shown only once you ask — no food cues up front).
  if (!tpl) {
    return `<div class="food-builder"><button type="button" class="btn ghost small" data-action="foodMode" data-m="">${icon('back')}Back</button>
      <h3 style="margin:4px 0 8px">What kind of meal?</h3>
      <div class="build-tiles">${TEMPLATES.map((t) => `<button type="button" class="ql-tile" data-action="foodMode" data-m="build" data-t="${t.id}"><span class="ql-emoji" aria-hidden="true">${t.emoji}</span><span>${esc(t.name)}</span></button>`).join('')}</div></div>`;
  }
  const f = buildFood(tpl, picks);
  return `<div class="food-builder">
    <div class="row between nowrap"><button type="button" class="btn ghost small" data-action="foodMode" data-m="">${icon('back')}Back</button><span class="ql-emoji" aria-hidden="true">${tpl.emoji}</span></div>
    <h3 style="margin:4px 0 2px">${esc(tpl.name)}</h3>
    <p class="muted" style="margin:0 0 8px;font-size:var(--text-sm)">Tap what you had. Tap again for extra${tpl.groups.some((g) => g.steps) ? ' (or more slices)' : ''}.</p>
    ${tpl.groups.map((g) => `<div class="bg"><div class="over">${esc(g.name)}</div><div class="side-chips">${g.parts.map((p) => {
      const q = Number(picks[`${g.id}.${p.id}`]) || 0;
      const tag = q === 1.5 ? ' · extra' : q > 1 ? ` × ${q}` : '';
      return `<button type="button" class="side-chip ${q ? 'on' : ''}" data-action="buildPick" data-k="${g.id}.${p.id}" aria-pressed="${!!q}">${esc(p.name)}${tag}${show && p.kcal ? ` <small>${fmtNum(Math.round(p.kcal * (q || 1)))}</small>` : ''}</button>`;
    }).join('')}</div></div>`).join('')}
    <div class="build-sum"><div class="grow"><strong>${esc(f.name)}</strong>${show ? `<small>${fmtNum(f.kcal)} kcal · ${f.p} g protein · ${f.fib} g fibre</small>` : ''}</div>
      <button type="button" class="btn primary" data-action="buildAdd" ${f.kcal || Object.keys(picks).length ? '' : 'disabled'}>Add</button></div>
  </div>`;
}

// ---------- Create a food ----------
function createHtml() {
  const v = (k) => esc(String(createDraft[k] ?? ''));
  const num = (k, label, unit, max = 5000) => `<label class="field"><span>${label}</span><div class="inline-inputs"><input type="number" inputmode="decimal" min="0" max="${max}" step="0.1" data-nf="${k}" value="${v(k)}"><span class="unit">${unit}</span></div></label>`;
  return `<div class="food-create">
    <div class="row between nowrap"><button type="button" class="btn ghost small" data-action="foodMode" data-m="">${icon('back')}Back</button></div>
    <h3 style="margin:4px 0 2px">Create a food</h3>
    <p class="muted" style="margin:0 0 8px;font-size:var(--text-sm)">Copy it from the packet or the restaurant’s website. It’s saved for next time.</p>
    <label class="field"><span>Name</span><input type="text" maxlength="60" data-nf="name" value="${v('name')}" placeholder="e.g. Chicken wrap from work"></label>
    <div class="grid two">
      <label class="field"><span>Portion</span><input type="text" maxlength="30" data-nf="portion" value="${v('portion') || '1 portion'}"></label>
      ${num('g', 'Weighs <span class="hint">optional</span>', 'g')}
      ${num('kcal', 'Calories', 'kcal')}
      ${num('p', 'Protein', 'g', 500)}
      ${num('fib', 'Fibre', 'g', 200)}
      ${num('c', 'Carbs <span class="hint">optional</span>', 'g', 1000)}
      ${num('f', 'Fat <span class="hint">optional</span>', 'g', 500)}
    </div>
    <button type="button" class="btn primary block" data-action="foodCreateSave">Save and add</button>
  </div>`;
}
let createDraft = {};

/** The picker block (inside a form). `show` = show calories. */
export function pickerHtml(show, state) {
  if (mode === 'build') return `<div class="food-picker">${builderHtml(show)}</div>`;
  if (mode === 'create') return `<div class="food-picker">${createHtml()}</div>`;
  const t = totalOf(items);
  // Everyday sides as chips; anything else you picked through search stays visible too.
  const chipSides = [...SHOWN_SIDES, ...SIDES.filter((x) => !SHOWN_SIDES.includes(x) && items.some((i) => i.id === x.id))];
  const sides = chipSides.map((x) => `<button type="button" class="side-chip ${items.some((i) => i.id === x.id) ? 'on' : ''}" data-action="foodAdd" data-id="${x.id}">${esc(x.name)}${show && x.kcal ? ` <small>${fmtNum(x.kcal)}</small>` : ''}</button>`).join('');
  return `<div class="food-picker">
      <label class="field" style="margin:0"><span class="sr-only">Search foods</span><input type="search" data-food-search data-show="${show ? 1 : 0}" value="${esc(query)}" placeholder="Search ${fmtNum(Math.floor(FOOD_COUNT / 100) * 100)}+ foods — kiwi, kefir, burrito…" autocomplete="off" enterkeyhint="search" aria-label="Search foods"></label>
      <ul class="food-results">${resultsHtml(query, show)}</ul>
      ${items.length ? `<div class="food-picked"><div class="over">Your meal</div><ul>${items.map((it, i) => itemHtml(it, i, show)).join('')}</ul>${show ? `<div class="food-total">${totalHtml(t)}</div>` : ''}
        <button type="button" class="link-btn" data-action="mealSave">${icon('star')}Add to my meals</button></div>` : quickHtml(state)}
      <details class="food-sides" ${items.length ? 'open' : ''}><summary><strong>Add sides</strong> <span class="muted">salad, veggies, rice, sauce…</span></summary><div class="side-chips">${sides}</div></details>
      <p class="muted" style="font-size:var(--text-xs);margin:8px 0 0">Not there? <button type="button" class="link-btn" data-action="foodMode" data-m="create">Create a food</button> · Values are typical portions; most foods from USDA FoodData (public domain).</p>
    </div>`;
}

const readCreate = (root) => {
  for (const el of root.querySelectorAll('[data-nf]')) createDraft[el.dataset.nf] = el.value;
};

export const foodActions = {
  foodAdd(el) {
    const id = el.dataset.id;
    const x = foodById(id);
    if (!x) return;
    const cur = items.find((i) => i.id === id && !i.food && i.u !== 'g' && !Number(i.u));
    if (cur && x.side) items = items.filter((i) => i !== cur); // a side chip toggles
    else if (cur) cur.n += 1;
    else items.push({ id, n: 1, u: 0 });
    query = '';
    rerender?.();
  },
  foodRemove(el) {
    items.splice(Number(el.dataset.i), 1);
    rerender?.();
  },
  foodStep(el) {
    const it = items[Number(el.dataset.i)];
    if (!it) return;
    const d = Number(el.dataset.d);
    // Portions go in halves below one ("half a sandwich"), whole steps above.
    it.n = it.n + d < 1 && it.n + d > 0 ? 0.5 : it.n === 0.5 && d > 0 ? 1 : Math.round((it.n + d) * 2) / 2;
    if (it.n <= 0) items.splice(Number(el.dataset.i), 1);
    rerender?.();
  },
  foodUnit(el) {
    const it = items[Number(el.dataset.i)];
    if (!it) return;
    const u = el.dataset.u;
    if (u === 'g') {
      if (it.u !== 'g') it.n = Math.round(gramsOf(it)) || 100;
      it.u = 'g';
    } else {
      it.u = Number(u);
      it.n = 1;
    }
    rerender?.();
    if (u === 'g') setTimeout(() => document.querySelector(`.sheet [data-food-grams][data-i="${el.dataset.i}"]`)?.select(), 30);
  },
  foodMode(el) {
    if (mode === 'create') readCreate(document.querySelector('.sheet .food-create') || document);
    mode = el.dataset.m || '';
    if (mode === 'build') {
      tplId = el.dataset.t;
      picks = {};
    }
    if (mode === 'create') createDraft = { name: query.trim() ? query.trim()[0].toUpperCase() + query.trim().slice(1) : '', portion: '1 portion' };
    rerender?.();
    document.querySelector('.sheet')?.scrollTo({ top: 0 });
  },
  foodManage() {
    manage = !manage;
    rerender?.();
  },
  buildPick(el) {
    const tpl = templateById(tplId);
    const [gid] = el.dataset.k.split('.');
    const g = tpl?.groups.find((x) => x.id === gid);
    if (!g) return;
    const steps = stepsOf(g);
    const cur = Number(picks[el.dataset.k]) || 0;
    const next = steps[(steps.indexOf(cur) + 1) % steps.length] ?? 0;
    if (g.one) for (const p of g.parts) delete picks[`${g.id}.${p.id}`];
    if (next) picks[el.dataset.k] = g.one ? 1 : next;
    else delete picks[el.dataset.k];
    rerender?.();
  },
  buildAdd() {
    const tpl = templateById(tplId);
    if (!tpl) return;
    items.push({ id: `b${Date.now().toString(36)}`, n: 1, food: buildFood(tpl, picks) });
    mode = '';
    query = '';
    rerender?.();
  },
  foodCreateSave(el, ev, ctx) {
    readCreate(el.closest('.food-create'));
    const d = createDraft;
    const name = String(d.name || '').trim().slice(0, 60);
    const kcal = Math.round(Number(d.kcal));
    if (!name) return ctx.toast('Give it a name.');
    if (!(kcal >= 0 && kcal <= 5000) || d.kcal === '') return ctx.toast('Add the calories (a guess is fine).');
    const n = (k, max) => Math.max(0, Math.min(max, Math.round((Number(d[k]) || 0) * 10) / 10));
    const food = { id: newFoodId(), name, portion: String(d.portion || '1 portion').trim().slice(0, 30) || '1 portion', kcal, p: n('p', 500), c: n('c', 1000), f: n('f', 500), fib: n('fib', 200), ...(n('g', 5000) ? { g: n('g', 5000) } : {}) };
    ctx.update((st) => {
      st.foods = { own: [food, ...(st.foods?.own || [])].slice(0, 300), meals: st.foods?.meals || [] };
      return st;
    }, { quiet: true });
    items.push({ id: food.id, n: 1, u: 0 });
    mode = '';
    query = '';
    createDraft = {};
    ctx.toast(`${name} saved to your foods`);
    rerender?.();
  },
  async mealSave(el, ev, ctx) {
    if (!items.length) return;
    const name = await ctx.ask('Name this meal', { type: 'text', value: describe(items).slice(0, 40), ok: 'Save' });
    if (!name || !String(name).trim()) return;
    const meal = { id: newFoodId('meal'), name: String(name).trim().slice(0, 50), items: structuredClone(items) };
    ctx.update((st) => {
      st.foods = { own: st.foods?.own || [], meals: [meal, ...(st.foods?.meals || [])].slice(0, 100) };
      return st;
    }, { quiet: true });
    ctx.toast(`Saved — find “${meal.name}” under Your meals`);
    rerender?.();
  },
  mealUse(el, ev, ctx) {
    const meal = (ctx.state.foods?.meals || []).find((m) => m.id === el.dataset.id);
    if (!meal) return;
    items.push(...structuredClone(meal.items).filter((it) => foodOf(it)));
    rerender?.();
  },
  async mealDelete(el, ev, ctx) {
    const meal = (ctx.state.foods?.meals || []).find((m) => m.id === el.dataset.id);
    if (!meal || !(await ctx.confirm(`Delete your meal “${meal.name}”?`, { ok: 'Delete', danger: true }))) return;
    ctx.update((st) => {
      st.foods.meals = st.foods.meals.filter((m) => m.id !== meal.id);
      return st;
    }, { quiet: true });
    rerender?.();
  },
  async ownDelete(el, ev, ctx) {
    const f = ownFoods().find((x) => x.id === el.dataset.id);
    if (!f || !(await ctx.confirm(`Delete “${f.name}” from your foods? Past logs keep it.`, { ok: 'Delete', danger: true }))) return;
    ctx.update((st) => {
      st.foods.own = st.foods.own.filter((x) => x.id !== f.id);
      return st;
    }, { quiet: true });
    rerender?.();
  },
};

/** What to save: {kcal, p, fib, label} from the picks, or from the typed fallback. */
export function pickResult(data) {
  if (items.length) {
    const t = totalOf(items);
    const typed = Number(data.kcal);
    return { kcal: Number.isFinite(typed) && data.kcal !== '' && typed !== t.kcal ? Math.max(0, typed) : t.kcal, p: t.p, fib: t.fib, label: describe(items).slice(0, 120) };
  }
  return { kcal: Math.max(0, Number(data.kcal) || 0), p: 0, fib: 0, label: String(data.label || '').trim().slice(0, 120) };
}

export { FOOD_CATS, updateSheet };
