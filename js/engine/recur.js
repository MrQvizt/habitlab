// Repeating calendar events: an event with `repeat` happens on more days than its own `date`.
// repeat = { freq: 'daily' | 'weekly' | 'biweekly' | 'monthly', days?: [0..6] (Monday = 0), until?: ISO }
// `skip` lists dates where one occurrence was moved or deleted.
import { addDays, daysBetween, weekdayOf } from './util.js';

export const FREQS = { daily: 'Every day', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' };

const weekday = weekdayOf;
const monday = (iso) => addDays(iso, -weekday(iso));

/** Does event `e` happen on `date`? */
export function occursOn(e, date) {
  if (!e || !date) return false;
  if (!e.repeat) return e.date === date;
  if (date < e.date) return false;
  if (e.repeat.until && date > e.repeat.until) return false;
  if ((e.skip || []).includes(date)) return false;
  const days = e.repeat.days?.length ? e.repeat.days : [weekday(e.date)];
  switch (e.repeat.freq) {
    case 'daily':
      return true;
    case 'weekly':
      return days.includes(weekday(date));
    case 'biweekly':
      return days.includes(weekday(date)) && (daysBetween(monday(e.date), monday(date)) / 7) % 2 === 0;
    case 'monthly': {
      const want = Number(e.date.slice(8));
      const last = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate();
      return Number(date.slice(8)) === Math.min(want, last); // the 31st → last day of shorter months
    }
    default:
      return e.date === date;
  }
}

/** All occurrences between `from` and `to` (inclusive), each as {...event, date, series}. */
export function expand(events, from, to) {
  const out = [];
  for (const e of events || []) {
    if (!e.repeat) {
      if (e.date >= from && e.date <= to) out.push(e);
      continue;
    }
    for (let d = e.date > from ? e.date : from; d <= to; d = addDays(d, 1)) if (occursOn(e, d)) out.push({ ...e, date: d, series: e.id });
  }
  return out.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
}

/** "Every week on Mon, Wed" */
export function repeatLabel(r) {
  if (!r) return '';
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const on = r.days?.length && (r.freq === 'weekly' || r.freq === 'biweekly') ? ` on ${r.days.map((d) => names[d]).join(', ')}` : '';
  return `${FREQS[r.freq] || 'Repeats'}${on}${r.until ? ` until ${r.until}` : ''}`;
}
