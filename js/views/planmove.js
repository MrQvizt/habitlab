// Re-planning the week (move a session to another day) and logging a regular activity with
// how long it really took and how hard it felt.
import { esc, icon } from '../ui/dom.js';
import * as store from '../store.js';
import { logDate } from '../viewdate.js';
import { INTENSITY, itemKey } from '../engine/workouts.js';
import { CARDIO } from '../data/exercises.js';
import { weekStart, weekOrder, dateInWeek } from '../engine/util.js';
import { openSheet, closeSheet, updateSheet } from '../ui/sheet.js';

const DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** How a planned session shows up everywhere (calendar, plan tomorrow, Today): its emoji and calendar type. */
export const planEmoji = (it) => ({ strength: '💪', cardio: '🚶', activity: '🏸' })[it.kind] || '📌';
export const planKind = (it) => (it.kind === 'activity' ? 'sport' : it.kind === 'cardio' ? 'walk' : 'workout');

export function itemName(it) {
  return it.kind === 'strength' ? `Strength session ${it.variant}` : it.kind === 'activity' ? it.name : `${it.minutes} min ${CARDIO[it.mode]?.label.toLowerCase() || 'cardio'}`;
}

function moveSheetHtml(state, date, key, from) {
  const wk = weekStart(date);
  const { schedule } = store.schedule(state, date);
  const it = schedule[from]?.items.find((x) => itemKey(x) === key);
  if (!it) return '';
  const moved = (state.workouts.moves?.[wk] || []).some((m) => m.key === key);
  const busy = (d) => schedule[d].items.filter((x) => x.kind !== 'rest').map(itemName);
  return `<div class="sheet-head"><div><div class="over">Re-plan this week</div><h2>Move ${esc(itemName(it))}</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <p class="muted" style="margin-top:0">Now on <strong>${DAY[from]}</strong>. Pick a better day — life happens, the plan should bend.</p>
    <div class="move-days">${weekOrder().map((d) => {
      const others = busy(d).filter((n) => n !== itemName(it));
      return `<button class="move-day ${d === from ? 'on' : ''}" data-action="moveItemTo" data-key="${esc(key)}" data-from="${from}" data-to="${d}" data-date="${dateInWeek(wk, d)}" ${d === from ? 'aria-current="true"' : ''}><strong>${DAY[d]}</strong><small>${others.length ? esc(others.join(' · ')) : 'free'}</small></button>`;
    }).join('')}</div>
    ${moved ? `<button class="btn ghost small" data-action="moveItemReset" data-key="${esc(key)}" data-date="${date}" style="margin-top:10px">Put it back where the plan had it</button>` : ''}
    <p class="muted" style="font-size:var(--text-xs);margin-top:10px">Tip: keep a rest day between strength sessions so muscles recover.</p>`;
}

/**
 * "How did it go?" — how long and how hard. For one of your regular activities ({ id }), or for
 * a walk/workout/sport from your calendar ({ ev: { id, title, dur, date } }), so it counts as movement.
 */
function activitySheetHtml(state, id, ev = null) {
  const a = ev ? { id: '', name: ev.title, minutes: ev.dur || 30, intensity: 'moderate' } : (state.profile.activities || []).find((x) => x.id === id);
  if (!a) return '';
  return `<div class="sheet-head"><div><div class="over">Nice work</div><h2>${esc(a.name)}</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <form data-form="activityDoneSave" data-id="${esc(a.id)}" ${ev ? `data-ev="${esc(ev.id)}" data-name="${esc(ev.title)}" data-date="${esc(ev.date)}"` : ''}>
      <label class="field"><span>How long did you go?</span>
        <div class="quick-chips">${[15, 30, 45, 60, 90].map((m) => `<button type="button" data-action="sheetQuickMin" data-v="${m}">${m} min</button>`).join('')}</div>
        <div class="inline-inputs"><input type="number" name="minutes" inputmode="numeric" min="1" max="600" value="${a.minutes}" required><span class="unit">min</span></div></label>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend style="font-weight:600;margin-bottom:6px">How hard did it feel?</legend>
        <div class="intensity-opts">${Object.entries(INTENSITY).map(([k, v]) => `<label class="int-opt"><input type="radio" name="intensity" value="${k}" ${k === a.intensity ? 'checked' : ''}><span><strong>${v.label}</strong><small>${esc(v.hint)}</small></span></label>`).join('')}</div></fieldset>
      <button class="btn primary large block" style="margin-top:14px">Save</button>
    </form>`;
}

/** Open the "how did it go?" sheet for a planned regular activity. */
export function askActivity(ctx, id, ev = null) {
  openSheet(activitySheetHtml(ctx.state, id, ev), { label: 'Log activity' });
}

const saveMoves = (ctx, date, fn) => ctx.update((st) => {
  const wk = weekStart(date);
  st.workouts.moves = { ...(st.workouts.moves || {}), [wk]: fn([...(st.workouts.moves?.[wk] || [])]) };
  return st;
}, { quiet: true });

export const planActions = {
  /** A walk / workout / sport in your calendar is done: ask how long and how hard, and count it. */
  eventDone(el, ev, ctx) {
    askActivity(ctx, '', { id: el.dataset.ev, title: el.dataset.title, dur: Number(el.dataset.dur) || 0, date: el.dataset.date });
  },
  openMoveItem(el, ev, ctx) {
    openSheet(moveSheetHtml(ctx.state, el.dataset.date, el.dataset.key, Number(el.dataset.from)), { label: 'Move to another day' });
  },
  moveItemTo(el, ev, ctx) {
    const key = el.dataset.key;
    const from = Number(el.dataset.from);
    const to = Number(el.dataset.to);
    if (from === to) return closeSheet();
    saveMoves(ctx, el.dataset.date, (list) => {
      // Moving again from the moved-to day: update the original move rather than stacking.
      const prev = list.find((m) => m.key === key && m.to === from);
      if (prev) {
        prev.to = to;
        return list.filter((m) => m.from !== m.to);
      }
      return [...list, { key, from, to }];
    });
    closeSheet();
    ctx.toast(`Moved to ${DAY[to]}`);
  },
  moveItemReset(el, ev, ctx) {
    saveMoves(ctx, el.dataset.date, (list) => list.filter((m) => m.key !== el.dataset.key));
    closeSheet();
    ctx.toast('Back on its planned day');
  },
  sheetQuickMin(el) {
    const input = el.closest('form').querySelector('input[name=minutes]');
    if (input) input.value = el.dataset.v;
  },
  activityDoneSave(form, ev, ctx, data) {
    const evId = form.dataset.ev || '';
    const a = evId ? { id: '', name: form.dataset.name || 'Activity', intensity: 'moderate' } : (ctx.state.profile.activities || []).find((x) => x.id === form.dataset.id);
    const minutes = Math.round(Number(data.minutes));
    if (!a || !(minutes > 0 && minutes <= 600)) return;
    const intensity = INTENSITY[data.intensity] ? data.intensity : a.intensity;
    const date = evId && /^\d{4}-\d{2}-\d{2}$/.test(form.dataset.date || '') ? form.dataset.date : logDate();
    closeSheet();
    ctx.update((st) => {
      const entry = evId ? { kind: 'activity', evId, name: a.name, intensity, minutes } : { kind: 'activity', actId: a.id, name: a.name, intensity, minutes };
      st.workouts.log[date] = [...(st.workouts.log[date] || []).filter((x) => !evId || x.evId !== evId), entry];
      return st;
    });
    ctx.toast(`${a.name} logged — ${minutes} min, ${INTENSITY[intensity].label.toLowerCase()}. Nice!`);
  },
};

export { updateSheet };
