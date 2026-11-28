// The (+) in the tab bar: everything you can log, one tap away, from any screen.
import { icon } from '../ui/dom.js';
import * as store from '../store.js';
import { openSheet } from '../ui/sheet.js';
import { itemKey } from '../engine/workouts.js';
import { planEmoji, itemName } from './planmove.js';

/** Today's next planned session that isn't done yet (or null). */
function nextSession(state) {
  const date = store.today();
  const items = store.dayItems(state, date).filter((it) => it.kind !== 'rest');
  const logs = state.workouts.log[date] || [];
  return items.find((it) => !logs.some((x) => (it.kind === 'strength' ? x.kind === 'strength' && x.variant === it.variant : it.kind === 'activity' ? x.actId === it.id : x.kind === 'cardio'))) || null;
}

export function quickLogHtml(state) {
  const today = store.today();
  const next = nextSession(state);
  const tile = (emoji, label, attrs) => `<button class="ql-tile" ${attrs}><span class="ql-emoji" aria-hidden="true">${emoji}</span><span>${label}</span></button>`;
  return `<div class="sheet-head"><div><h2>Log</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    ${next ? `<button class="ql-next" data-action="openPlanItem" data-key="${itemKey(next)}" data-date="${today}"><span class="ql-emoji" aria-hidden="true">${planEmoji(next)}</span><span class="grow"><small>Planned today</small><strong>${itemName(next)}</strong></span>${icon('chevron')}</button>` : ''}
    <div class="ql-grid">
      ${tile('🍽️', 'Food', 'data-action="openExtra"')}
      ${tile('⚖️', 'Weight', 'data-action="openWeigh"')}
      ${tile('🚶', 'Walk', 'data-action="cardioDone" data-mode="walk" data-min="30"')}
      ${tile('👟', 'Steps', 'data-action="openSteps"')}
      ${tile('🏃', 'Other activity', 'data-action="quickGo" data-href="#/move"')}
      ${tile('🌊', 'Craving', 'data-action="quickGo" data-href="#/sos"')}
      ${tile('📅', 'Add to calendar', `data-action="calAdd" data-date="${today}"`)}
      ${tile('🌙', 'Plan tomorrow', 'data-action="quickGo" data-href="#/plan"')}
    </div>`;
}

export function openQuickLog(ctx) {
  openSheet(quickLogHtml(ctx.state), { label: 'Log something' });
}
