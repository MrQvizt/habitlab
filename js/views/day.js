// "Your day": wake, bed and eating-window inputs, shared by onboarding and Settings.
import { esc, icon } from '../ui/dom.js';
import { daySchedule, scheduleAdvice, toHHMM, mealTimes } from '../engine/schedule.js';

export function dayFields(profile) {
  const d = daySchedule(profile);
  const s = profile.schedule || {};
  const v = (k, fallback) => esc(s[k] || fallback);
  return `<div class="grid two" style="gap:0 14px;margin-bottom:0">
      <label class="field"><span>I usually wake up at</span><input type="time" name="wake" value="${v('wake', toHHMM(d.wake))}" required></label>
      <label class="field"><span>I usually go to bed at</span><input type="time" name="bed" value="${v('bed', toHHMM(d.bed))}" required></label>
      <label class="field"><span>First meal</span><input type="time" name="firstMeal" value="${v('firstMeal', toHHMM(d.first))}" required></label>
      <label class="field"><span>Last meal <span class="hint">Ideally about 3 hours before bed</span></span><input type="time" name="lastMeal" value="${v('lastMeal', toHHMM(d.last))}" required></label>
    </div>`;
}

/** Live summary: sleep, window, kitchen-closed time, timeline preview and advice. */
export function daySummary(profile, slots = ['breakfast', 'snack', 'lunch', 'snack2', 'dinner']) {
  const d = daySchedule(profile);
  const t = mealTimes(profile, slots);
  const names = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', snack2: 'Snack', snack3: 'Snack' };
  const line = Object.entries(t).sort((a, b) => a[1] - b[1]).map(([k, m]) => `<span class="tl-dot"><b>${toHHMM(m)}</b>${names[k]}</span>`).join('');
  const tips = scheduleAdvice(profile);
  return `<div class="day-summary">
      <div class="hero-pills" style="margin-bottom:10px">
        <span class="pill-stat">${icon('clock')}${(d.sleepMinutes / 60).toFixed(1)} h sleep</span>
        <span class="pill-stat">${icon('meals')}${Math.round(d.window / 60)} h eating window</span>
        <span class="pill-stat" style="background:var(--accent-soft);color:var(--accent)">Kitchen closes ${toHHMM(d.last)} · ${(d.gapBeforeBed / 60).toFixed(1)} h before bed</span>
      </div>
      <div class="timeline">${line}</div>
      ${tips.map((x) => `<div class="notice ${x.level === 'warn' ? 'warn' : 'info'}" style="margin:10px 0 0">${icon(x.level === 'warn' ? 'alert' : 'info')}<div>${esc(x.text)}</div></div>`).join('')}
      <p class="muted" style="font-size:var(--text-xs);margin:10px 0 0">Why: eating late raises hunger and lowers energy use, and finishing 2–3 h before bed is easier on reflux and sleep. <a href="#/learn/meal_timing">The evidence</a></p>
    </div>`;
}

export function readDay(data) {
  const ok = (x) => typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
  const out = {};
  for (const k of ['wake', 'bed', 'firstMeal', 'lastMeal']) if (ok(data[k])) out[k] = data[k];
  return out;
}
