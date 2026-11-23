// Your day: wake/bed times and eating window → a timeline of meal times.
// Evidence (see Learn → "When to eat"): stop eating 2–3 h before bed (ACG GERD guideline, Katz 2022);
// eating late increases hunger and lowers energy expenditure (Vujović 2022); an earlier main meal is
// linked with better weight loss (Garaulet 2013). Restricting the window itself adds no weight loss
// beyond calories (Liu 2022), so the app sets a comfortable window rather than pushing fasting.

export const BED_GAP_MIN = 3 * 60; // recommended: finish eating ~3 h before bed
export const BED_GAP_FLOOR = 2 * 60; // never plan the last meal closer than 2 h to bed

export function toMin(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function toHHMM(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
const round15 = (m) => Math.round(m / 15) * 15;

/**
 * Normalised day schedule with defaults. Times are minutes from the wake day's midnight
 * (bed after midnight becomes > 1440).
 */
export function daySchedule(profile = {}) {
  const s = profile.schedule || {};
  const wake = toMin(s.wake || '07:00');
  let bed = toMin(s.bed || '23:00');
  if (bed <= wake) bed += 1440;
  let first = s.firstMeal ? toMin(s.firstMeal) : wake + 30;
  if (first < wake) first += 1440;
  let last = s.lastMeal ? toMin(s.lastMeal) : bed - BED_GAP_MIN;
  if (last < first) last += 1440;
  // Keep the last meal at least 2 h before bed, and a usable window of at least 4 h.
  last = Math.min(last, bed - BED_GAP_FLOOR);
  if (last - first < 240) first = Math.max(wake, last - 240);
  return {
    wake, bed, first, last,
    window: last - first,
    gapBeforeBed: bed - last,
    sleepMinutes: 1440 - (bed - wake),
    isSet: !!(s.wake && s.bed),
  };
}

/**
 * Meal times for the slots in a day: breakfast opens the window, dinner closes it, lunch a little
 * before the middle (earlier main meals), and snacks spaced between meals — never after dinner.
 * @returns {slot: minutes}
 */
export function mealTimes(profile, slots) {
  const d = daySchedule(profile);
  const has = (x) => slots.includes(x);
  const t = {};
  const B = d.first;
  const D = d.last;
  const L = round15(B + (D - B) * 0.42);
  if (has('breakfast')) t.breakfast = B;
  if (has('lunch')) t.lunch = L;
  if (has('dinner')) t.dinner = D;
  const snacks = slots.filter((x) => x.startsWith('snack'));
  if (snacks.length === 1) t[snacks[0]] = round15((L + D) / 2); // afternoon
  else if (snacks.length === 2) {
    t[snacks[0]] = round15((B + L) / 2); // mid-morning
    t[snacks[1]] = round15((L + D) / 2); // afternoon
  } else if (snacks.length >= 3) {
    t[snacks[0]] = round15((B + L) / 2);
    t[snacks[1]] = round15(L + (D - L) / 3);
    t[snacks[2]] = round15(L + (2 * (D - L)) / 3);
  }
  return t;
}

/** Meals sorted into the order you eat them, each with its time. */
export function orderMeals(profile, meals) {
  const t = mealTimes(profile, meals.map((m) => m.slot));
  return meals.map((m) => ({ ...m, time: t[m.slot] ?? 0 })).sort((a, b) => a.time - b.time);
}

/** Friendly checks shown next to the schedule inputs. */
export function scheduleAdvice(profile) {
  const d = daySchedule(profile);
  const tips = [];
  const sleepH = d.sleepMinutes / 60;
  if (sleepH < 7) tips.push({ level: 'warn', text: `That’s about ${sleepH.toFixed(1)} hours of sleep. Adults do best with 7+ — even 30 minutes more can reduce next-day snacking.` });
  const req = profile.schedule?.lastMeal ? toMin(profile.schedule.lastMeal) : null;
  if (req != null && d.last < (req < d.first ? req + 1440 : req)) tips.push({ level: 'info', text: `Your last meal is planned for ${toHHMM(d.last)} so there are at least 2 hours before bed.` });
  if (d.gapBeforeBed < BED_GAP_MIN) tips.push({ level: 'info', text: `Finishing eating about 3 hours before bed (${toHHMM(d.bed - BED_GAP_MIN)}) is gentler on reflux and sleep.` });
  if (d.window > 13 * 60) tips.push({ level: 'info', text: `A ${Math.round(d.window / 60)}-hour eating window leaves little time for the kitchen to be closed. Many people find a 10–12 hour window easier.` });
  return tips;
}
