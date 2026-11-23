// Shopping list for the rest of this week (or the whole week), grouped by aisle.
import { html, esc, icon } from '../ui/dom.js';
import * as store from '../store.js';
import { shoppingList, formatQty } from '../engine/meals.js';
import { weekStart } from '../engine/util.js';
import { dayIndex } from './shared.js';

const AISLE_ORDER = ['Produce', 'Frozen', 'Meat & fish', 'Dairy & eggs', 'Bakery', 'Canned & dry'];

export default {
  render(state, params) {
    const date = store.today();
    const wk = weekStart(date);
    const plan = state.plans[wk];
    const scope = params[0] === 'week' ? 'week' : 'rest';
    const from = scope === 'week' ? 0 : dayIndex(date);
    const days = plan.days.slice(from);
    const list = shoppingList(days);
    const u = state.profile.units === 'imperial' ? 'imperial' : 'metric';
    const got = new Set(state.shopGot?.[wk] || []);
    const aisles = AISLE_ORDER.filter((a) => list[a]);
    return html`<div class="page-head"><div><div class="eyebrow">Meal plan</div><h1>Shopping list</h1></div><div class="row no-print"><div class="segmented"><a href="#/shopping" class="${scope === 'rest' ? 'on' : ''}">Rest of week</a><a href="#/shopping/week" class="${scope === 'week' ? 'on' : ''}">Whole week</a></div><button class="btn small print-only-host" data-action="print">Print</button></div></div>
      <p class="muted">${days.length} day${days.length === 1 ? '' : 's'} of meals. Quantities are rounded up to sensible shop sizes in your head — buy what makes sense. Herbs, spices, salt and vinegar not listed. <a href="#/meals" class="no-print">Back to plan</a></p>
      <div class="grid two">${aisles.map((a) => `<div class="card"><h2>${esc(a)}</h2>${list[a].map((it) => `<label class="shop-item ${got.has(it.id) ? 'got' : ''}"><input type="checkbox" data-change="got" data-id="${it.id}" ${got.has(it.id) ? 'checked' : ''}><span class="grow">${esc(it.name)}</span><strong>${esc(formatQty(it.id, it.grams, u))}</strong></label>`).join('')}</div>`)}</div>
      <p class="muted no-print">${icon('info')} Tip: shop from the list and keep treats out of sight at home — what’s in the house is what gets eaten.</p>`;
  },
  actions: {
    got(el, ev, ctx) {
      const wk = weekStart(store.today());
      ctx.update((st) => {
        st.shopGot ||= {};
        const s = new Set(st.shopGot[wk] || []);
        el.checked ? s.add(el.dataset.id) : s.delete(el.dataset.id);
        st.shopGot = { [wk]: [...s] };
        return st;
      });
    },
    print() {
      window.print();
    },
  },
};
