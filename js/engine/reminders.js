// Reminder schedule: turns the plan and today's progress into specific, friendly notifications
// for the next few days. Pure — the platform layer (js/notify.js) delivers them.
//
// Principles: specific beats generic ("Lunch: Greek salad with chicken" > "Time to eat"); skip
// anything already done; never shame; quiet by default at night; a few encouraging messages,
// rotating so they don't go stale.
import { addDays, parseDate, hashString, isoDate, planDayFor, weekdayOf, getWeekStart } from './util.js';
import { quests } from './game.js';
import { byId } from './meals.js';
import { mealTimes, daySchedule } from './schedule.js';
import { weekBody } from './body.js';

export const DEFAULT_REMINDERS = {
  enabled: false,
  morningOn: true,
  morning: '07:30', // weigh-in + today's plan
  meals: true, // a nudge to log each main meal
  breakfast: '09:00',
  lunch: '13:00',
  dinner: '19:30',
  moveOn: true,
  move: '17:30', // today's session / walk
  encourage: true, // one encouraging note mid-afternoon
  encourageAt: '15:30',
  eveningOn: true,
  evening: '21:00', // streak saver: quests left
  checkin: true, // weekly check-in reminder
  checkinDay: 6, // 0 = Monday … 6 = Sunday
  checkinAt: '18:00',
};

export const ENCOURAGEMENTS = [
  ['Small wins add up', 'Every meal you log and every walk you take is a vote for the person you’re becoming.'],
  ['One slip changes nothing', 'Missing a day doesn’t break a habit. Just don’t miss twice.'],
  ['Protein tip', 'A palm of protein at your next meal helps you stay full for longer.'],
  ['Water check', 'Thirst can feel like hunger. A glass of water now?'],
  ['Move a little', 'Two minutes of walking still counts. Stand up, stretch, step outside.'],
  ['You’re doing the hard part', 'Showing up on ordinary days is how lasting change happens.'],
  ['Plateaus are normal', 'The trend matters more than any single day on the scale.'],
  ['Be kind to yourself', 'Talk to yourself the way you’d talk to a friend who’s trying.'],
  ['Plan the next meal', 'Deciding ahead is easier than deciding hungry. Peek at your plan.'],
  ['Sleep is a superpower', 'An earlier night tonight makes tomorrow’s choices easier.'],
  ['Halfway through the day', 'Check your quests — a couple of taps could make today a perfect day.'],
  ['Veg first', 'Starting with vegetables fills you up on fewer calories.'],
];

const DAY_SLOTS = ['morning', 'breakfast', 'lunch', 'move', 'encourage', 'dinner', 'evening', 'checkin', 'wrap'];

/** Notification id: stable per (date, slot) so rescheduling replaces rather than duplicates. */
export function reminderId(date, slot) {
  const d = parseDate(date);
  const dayNum = Math.floor(d.getTime() / 86400000) % 1000;
  return 100000 + dayNum * 10 + DAY_SLOTS.indexOf(slot);
}

function at(date, hhmm) {
  const [h, m] = String(hhmm || '12:00').split(':').map(Number);
  const d = parseDate(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function atMin(date, minutes) {
  const d = parseDate(date);
  d.setHours(0, minutes, 0, 0); // minutes past midnight; values over 1440 roll into the next day
  return d;
}

function mealsFor(state, date) {
  return planDayFor(state, date);
}

/**
 * @param state app state
 * @param now Date
 * @param ctx {habitsOnly, schedule(date) → day items, streak, days = 7}
 * @returns [{id, at: Date, title, body, route}] sorted by time, only in the future
 */
export function buildReminders(state, now, ctx = {}) {
  const r = { ...DEFAULT_REMINDERS, ...(state.reminders || {}) };
  if (!r.enabled || !state.profile) return [];
  const habitsOnly = !!ctx.habitsOnly;
  const days = ctx.days ?? 7;
  const today = isoDate(now);
  const out = [];
  const push = (date, slot, time, title, body, route) => {
    const when = typeof time === 'number' ? atMin(date, time) : at(date, time);
    if (when > now) out.push({ id: reminderId(date, slot), at: when, title, body, route });
  };
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const isToday = i === 0;
    const q = isToday ? quests(state, date, { habitsOnly }) : null;
    const qDone = (id) => !!q?.find((x) => x.id === id)?.done;
    const meals = mealsFor(state, date);
    const log = state.mealLog?.[date] || {};
    const dayItems = ctx.schedule ? ctx.schedule(date) : [];
    const session = dayItems.find((it) => it.kind === 'strength') || dayItems.find((it) => it.kind === 'activity') || dayItems.find((it) => it.kind === 'cardio');

    // Morning: weigh-in + today's headline
    if (r.morningOn && r.morning && !(isToday && (habitsOnly || qDone('weigh')))) {
      const first = meals[0] ? byId(meals[0].recipeId)?.name : null;
      push(date, 'morning', r.morning, habitsOnly ? 'Good morning' : 'Good morning — weigh in',
        habitsOnly ? `Today starts with ${first || 'a good breakfast'}. Your quests are ready.` : `Step on the scale for +5 XP, then ${first ? `breakfast: ${first}` : 'check today’s plan'}.`, '#/today');
    } else if (r.morningOn && r.morning && habitsOnly && !isToday) {
      push(date, 'morning', r.morning, 'Good morning', 'Your quests for today are ready.', '#/today');
    }

    // Meal logging nudges: 45 minutes after each main meal on the person's own timeline
    if (r.meals) {
      const times = mealTimes(state.profile, meals.map((m) => m.slot));
      for (const slot of ['breakfast', 'lunch', 'dinner']) {
        const m = meals.find((x) => x.slot === slot);
        if (!m || (isToday && log[slot])) continue;
        const name = byId(m.recipeId)?.name || slot;
        const label = slot[0].toUpperCase() + slot.slice(1);
        const body = slot === 'dinner'
          ? `Planned: ${name}. Kitchen closes after dinner — about ${Math.round(daySchedule(state.profile).gapBeforeBed / 60)} h before bed helps sleep and hunger.`
          : `Planned: ${name}. Ate something else? Log that instead — it’s worth the same.`;
        push(date, slot, (times[slot] ?? 12 * 60) + 45, `${label}: log it for +10 XP`, body, '#/today');
      }
    }

    // Movement
    if (r.moveOn && r.move && session && !(isToday && qDone('move'))) {
      const body = session.kind === 'strength'
        ? `Strength session ${session.variant} is on today’s plan — about ${session.minutes} minutes, +40 XP.`
        : session.kind === 'activity'
          ? `${session.name} today (${session.minutes} min). Tap Done afterwards for XP — it counts toward your week.`
          : `${session.minutes} minutes of ${session.label?.toLowerCase() || 'cardio'} today. Walking counts.`;
      const title = session.kind === 'strength' ? 'Strength time' : session.kind === 'activity' ? `Enjoy ${session.name.toLowerCase()}` : 'Time to move';
      push(date, 'move', r.move, title, body, session.kind === 'strength' ? `#/move/session/${session.variant}` : '#/today');
    }

    // Encouragement (rotates by date)
    if (r.encourage) {
      const [t, b] = ENCOURAGEMENTS[hashString(date) % ENCOURAGEMENTS.length];
      push(date, 'encourage', r.encourageAt, t, b, '#/today');
    }

    // Evening streak saver (today: only if quests are left; future days: generic)
    if (r.eveningOn && r.evening) {
      if (isToday) {
        const left = q.filter((x) => !x.done);
        if (left.length) {
          const streak = ctx.streak || 0;
          push(date, 'evening', r.evening, streak >= 2 ? `Keep your ${streak}-day streak going` : 'Quick wrap-up',
            `${left.length} quest${left.length > 1 ? 's' : ''} left: ${left.map((x) => x.label.toLowerCase()).join(', ')}. Finish them all for a perfect day.`, '#/today');
        }
      } else {
        push(date, 'evening', r.evening, 'Wrap up your day', 'Tick off anything you haven’t logged — a perfect day is +25 XP.', '#/today');
      }
    }

    // Weekly check-in
    if (r.checkin && (parseDate(date).getDay() + 6) % 7 === Number(r.checkinDay)) {
      const last = (state.checkins || []).map((c) => c.date).sort().pop();
      if (!(isToday && last === date)) push(date, 'checkin', r.checkinAt, 'Weekly check-in (+50 XP)', 'Two minutes to look back at your week and tune the plan.', '#/checkin');
    }

    // First day of the week: last week's Body Wrap is ready
    if (r.checkin && weekdayOf(date) === getWeekStart()) {
      const ws = addDays(date, -7);
      if (state.profile?.startDate && addDays(ws, 6) >= state.profile.startDate && !state.wraps?.[ws]) {
        const w = weekBody(state, ws);
        const top = w.earned[0];
        push(date, 'wrap', '08:15', `🎁 Your Body Wrap is ready`, top ? `${top.emoji} ${top.head} — plus ${w.earned.length - 1 > 0 ? `${w.earned.length - 1} more thank-you${w.earned.length - 1 === 1 ? '' : 's'}` : 'a look at your week'}. +30 XP` : 'See what last week did for your body. +30 XP', `#/wrap/${ws}`);
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
