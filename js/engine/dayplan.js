// "Your day": put meals, habits and the weigh-in on one clock so Today reads top to bottom
// like the day itself. Habits are placed by their cue ("After I finish lunch" → after lunch),
// which is the implementation intention the person wrote — the cue is the time.
import { daySchedule } from './schedule.js';

/** Where a habit cue sits in the day: { time (minutes), label } or null for "any time". */
export function cueTime(cue, profile = {}, meals = {}) {
  const c = String(cue || '').toLowerCase();
  const d = daySchedule(profile);
  const t = (slot, fallback) => (meals[slot] != null ? meals[slot] : fallback);
  const clock = c.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (clock) {
    let h = Number(clock[1]) % 12;
    if (clock[3] === 'pm') h += 12;
    return { time: h * 60 + Number(clock[2] || 0), label: `${String(h).padStart(2, '0')}:${clock[2] || '00'}` };
  }
  if (/breakfast/.test(c)) return { time: t('breakfast', d.first) - 1, label: 'At breakfast' };
  if (/lunch/.test(c)) return { time: t('lunch', 12 * 60 + 30) + 30, label: 'After lunch' };
  if (/plate up dinner|cook dinner|make dinner/.test(c)) return { time: t('dinner', d.last) - 1, label: 'At dinner' };
  if (/dinner|washing up|dishes/.test(c)) return { time: t('dinner', d.last) + 40, label: 'After dinner' };
  if (/bed|night|wind-down|teeth|pyjama|pajama/.test(c)) return { time: d.bed - 30, label: 'Before bed' };
  if (/morning|wake|get up|alarm goes off in the morning/.test(c)) return { time: d.wake + 10, label: 'Morning' };
  if (/home from work|after work|commute/.test(c)) return { time: 17 * 60 + 30, label: 'After work' };
  if (/afternoon/.test(c)) return { time: 15 * 60, label: 'Afternoon' };
  if (/evening/.test(c)) return { time: Math.min(d.bed - 60, 20 * 60), label: 'Evening' };
  return null;
}

export const PARTS = [
  { id: 'morning', label: 'Morning', until: 12 * 60 },
  { id: 'afternoon', label: 'Afternoon', until: 17 * 60 },
  { id: 'evening', label: 'Evening', until: 24 * 60 + 1 },
];

/** Which part of the day a minute falls in. */
export function partOf(min) {
  return PARTS.find((p) => min < p.until).id;
}

/**
 * Timed items, sorted, plus the habits with no clear time.
 * meals: [{ slot, time }]; habits: [{ id, cue }]; weigh: include a morning weigh-in.
 */
export function planDay(profile, { meals = [], habits = [], weigh = false }) {
  const d = daySchedule(profile);
  const mt = Object.fromEntries(meals.map((m) => [m.slot, m.time]));
  const timed = [];
  const anytime = [];
  if (weigh) timed.push({ kind: 'weigh', time: d.wake + 5, label: 'Morning', order: 0 });
  meals.forEach((m, i) => timed.push({ kind: 'meal', time: m.time, slot: m.slot, order: 2 + i }));
  habits.forEach((h, i) => {
    const at = cueTime(h.cue, profile, mt);
    if (at) timed.push({ kind: 'habit', id: h.id, time: at.time, label: at.label, order: 1 + i / 100 });
    else anytime.push({ kind: 'habit', id: h.id });
  });
  timed.sort((a, b) => a.time - b.time || a.order - b.order);
  return { timed, anytime };
}
