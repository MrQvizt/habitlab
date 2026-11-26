// The day you're logging on Today. Normally today; step back up to 7 days to fill in what you forgot.
import * as store from './store.js';
import { addDays } from './engine/util.js';

export const MAX_BACK = 7;
let viewing = null;

/** A date you may log on: today or up to MAX_BACK days before. */
export function validLogDate(d) {
  const t = store.today();
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= t && d >= addDays(t, -MAX_BACK);
}

export function setViewDate(d) {
  viewing = validLogDate(d) && d !== store.today() ? d : null;
}

/** Where taps on Today and its sheets are saved. */
export function logDate() {
  return viewing && validLogDate(viewing) ? viewing : store.today();
}

export function isPast() {
  return logDate() !== store.today();
}
