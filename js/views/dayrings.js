// Today's three rings: Eat (meals logged), Move (planned sessions and activities), Habits (today's habits).
// Closing a ring is the small, visible daily win; closing all three is a perfect day.
import * as store from '../store.js';
import { mealsFor } from './shared.js';
import { habitLevels, levelIndex } from '../engine/habits.js';
import { itemDone } from './move.js';

export const RING_META = {
  eat: { label: 'Eat', color: 'var(--ring-eat)' },
  move: { label: 'Move', color: 'var(--ring-move)' },
  habits: { label: 'Habits', color: 'var(--ring-habits)' },
};

export function dayRings(state, date = store.today()) {
  if (!state?.profile) return null;
  const meals = mealsFor(state, date);
  const log = state.mealLog?.[date] || {};
  const logged = meals.filter((m) => log[m.slot]).length;
  const eat = { pct: meals.length ? logged / meals.length : 0, text: `${logged}/${meals.length} meals` };

  const items = store.dayItems(state, date).filter((it) => it.kind !== 'rest');
  const done = items.filter((it) => itemDone(state.workouts.log[date] || [], it)).length;
  // Planned sessions and activities close the ring; on a rest day, resting is the plan (any movement logged is a bonus).
  const anyMove = (state.workouts.log[date] || []).length > 0;
  const move = items.length
    ? { pct: done / items.length, text: done === items.length ? (items.length > 1 ? 'All sessions done' : 'Session done') : `${done}/${items.length} session${items.length > 1 ? 's' : ''}` }
    : { pct: 1, text: anyMove ? 'Rest day + you moved' : 'Rest day' };

  const habits = store.visibleHabits(state);
  const hlog = state.habits.log?.[date] || {};
  const hsum = habits.reduce((s, a) => {
    const lv = habitLevels(a.id);
    const i = levelIndex(a.id, hlog[a.id]);
    return s + (i < 0 ? 0 : (i + 1) / lv.length);
  }, 0);
  const full = habits.filter((a) => levelIndex(a.id, hlog[a.id]) === habitLevels(a.id).length - 1).length;
  const hab = { pct: habits.length ? hsum / habits.length : 0, text: habits.length ? `${full}/${habits.length} done` : 'Pick one' };

  const rings = { eat, move, habits: hab };
  for (const r of Object.values(rings)) r.closed = r.pct >= 0.999;
  return rings;
}

/** Concentric rings SVG (outer → inner: eat, move, habits). */
export function ringsSvg(rings, size = 132) {
  const keys = ['eat', 'move', 'habits'];
  const sw = 13;
  const gap = 3;
  const c = size / 2;
  const arcs = keys.map((k, i) => {
    const r = c - sw / 2 - i * (sw + gap);
    const len = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, rings[k].pct));
    const off = len * (1 - p);
    return `<circle class="rb" cx="${c}" cy="${c}" r="${r.toFixed(1)}" style="stroke:${RING_META[k].color}"/>
      <circle class="rf ${p > 0 ? '' : 'empty'}" cx="${c}" cy="${c}" r="${r.toFixed(1)}" style="stroke:${RING_META[k].color}" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>`;
  }).join('');
  return `<svg class="day-rings-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${arcs}</svg>`;
}

/** Which rings closed between two states (for the celebration). */
export function newlyClosed(before, after) {
  const a = dayRings(before);
  const b = dayRings(after);
  if (!a || !b) return [];
  return Object.keys(b).filter((k) => b[k].closed && !a[k].closed);
}

export function allClosed(state) {
  const r = dayRings(state);
  return !!r && Object.values(r).every((x) => x.closed);
}
