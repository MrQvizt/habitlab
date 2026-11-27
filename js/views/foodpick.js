// Food picker: search common foods, add sides ("sausage + side salad"), adjust portions.
// Used by "Something else" on a planned meal and by "Add something else you ate".
import { esc, icon, fmtNum } from '../ui/dom.js';
import { FOOD_DB, SIDES, SHOWN_SIDES, FOOD_CATS, searchFoods, totalOf, describe, foodById } from '../data/fooddb.js';
import { updateSheet } from '../ui/sheet.js';

let items = [];
let rerender = null;

/** Start a fresh pick; `redraw` re-renders the sheet that hosts the picker. */
export function startPick(redraw) {
  items = [];
  rerender = redraw;
}

export const picked = () => items.slice();

const row = (x, show) => `<li><button type="button" class="food-hit" data-action="foodAdd" data-id="${x.id}"><span class="grow"><strong>${esc(x.name)}</strong><small>${esc(x.portion)}${show ? ` · ${fmtNum(x.kcal)} kcal · ${x.p} g protein` : ''}</small></span><span class="food-plus">${icon('plus')}</span></button></li>`;

function resultsHtml(q, show) {
  const hits = searchFoods(q);
  if (!q.trim()) return '';
  if (!hits.length) return `<li class="muted food-none">Nothing found — type it below instead.</li>`;
  return hits.map((x) => row(x, show)).join('');
}

// Live search without re-rendering the sheet (keeps the keyboard open).
document.addEventListener('input', (ev) => {
  if (!ev.target.matches?.('[data-food-search]')) return;
  const list = ev.target.closest('.food-picker')?.querySelector('.food-results');
  if (list) list.innerHTML = resultsHtml(ev.target.value, ev.target.dataset.show === '1');
});

/** The picker block (inside a form). `show` = show calories. */
export function pickerHtml(show) {
  const t = totalOf(items);
  // Everyday sides as chips; anything else you picked through search stays visible too.
  const chipSides = [...SHOWN_SIDES, ...SIDES.filter((x) => !SHOWN_SIDES.includes(x) && items.some((i) => i.id === x.id))];
  const sides = chipSides.map((x) => `<button type="button" class="side-chip ${items.some((i) => i.id === x.id) ? 'on' : ''}" data-action="foodAdd" data-id="${x.id}">${esc(x.name)}${show && x.kcal ? ` <small>${fmtNum(x.kcal)}</small>` : ''}</button>`).join('');
  const list = items.map((it) => {
    const x = foodById(it.id);
    return `<li class="food-item"><span class="grow"><strong>${esc(x.name)}</strong><small>${it.n === 1 ? esc(x.portion) : `${it.n} × ${esc(x.portion)}`}${show ? ` · ${fmtNum(x.kcal * it.n)} kcal` : ''}</small></span>
      <span class="stepper"><button type="button" data-action="foodStep" data-id="${x.id}" data-d="-0.5" aria-label="Less ${esc(x.name)}">−</button><span>${it.n}</span><button type="button" data-action="foodStep" data-id="${x.id}" data-d="0.5" aria-label="More ${esc(x.name)}">+</button></span></li>`;
  }).join('');
  return `<div class="food-picker">
      <label class="field" style="margin:0"><span>Search foods</span><input type="search" data-food-search data-show="${show ? 1 : 0}" placeholder="e.g. chicken, soup, yogurt" autocomplete="off" aria-label="Search foods"></label>
      <ul class="food-results"></ul>
      ${items.length ? `<div class="food-picked"><div class="over">Your meal</div><ul>${list}</ul>${show ? `<div class="food-total"><strong>${fmtNum(t.kcal)} kcal</strong> · ${t.p} g protein · ${t.c} g carbs · ${t.f} g fat</div>` : ''}</div>` : ''}
      <details class="food-sides" ${items.length ? 'open' : ''}><summary><strong>Add sides</strong> <span class="muted">salad, veggies, rice…</span></summary><div class="side-chips">${sides}</div><p class="muted" style="font-size:var(--text-xs);margin:6px 0 0">Can’t see it? Everything else is in the search above.</p></details>
      <p class="muted" style="font-size:var(--text-xs);margin:8px 0 0">${FOOD_DB.length + SIDES.length} foods to search. Values are typical portions — close enough to learn from. Every food fits; logging it honestly is what counts.</p>
    </div>`;
}

export const foodActions = {
  foodAdd(el) {
    const id = el.dataset.id;
    const cur = items.find((i) => i.id === id);
    if (cur && foodById(id)?.side) items = items.filter((i) => i.id !== id); // a side chip toggles
    else if (cur) cur.n += 1;
    else items.push({ id, n: 1 });
    rerender?.();
  },
  foodStep(el) {
    const cur = items.find((i) => i.id === el.dataset.id);
    if (!cur) return;
    cur.n = Math.round((cur.n + Number(el.dataset.d)) * 2) / 2;
    if (cur.n <= 0) items = items.filter((i) => i !== cur);
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
