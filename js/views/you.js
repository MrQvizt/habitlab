// You: everything about you and how the app works for you — habits, alarms, account, settings.
import { esc, icon } from '../ui/dom.js';
import * as store from '../store.js';
import * as account from '../account.js';
import { habitById } from '../engine/habits.js';
import { alarmsSummary } from './alarms.js';

const row = (href, ic, title, sub = '') => `<li><a class="you-row" href="${href}"><span class="you-ico" aria-hidden="true">${icon(ic)}</span><span class="grow"><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${icon('chevron')}</a></li>`;

export default {
  render(state) {
    const g = store.game(state);
    const me = account.current();
    const habits = state.habits.active.map((a) => habitById(a.id)).filter(Boolean);
    const days = Math.max(1, Math.round((Date.parse(store.today()) - Date.parse(state.profile.startDate || store.today())) / 864e5) + 1);
    return `<header class="page-head"><div><h1>You</h1></div></header>
      <div class="you-stats">
        <a href="#/rewards"><b>${g?.level ?? 1}</b><span>Level</span></a>
        <a href="#/rewards"><b>${g?.streak ?? 0}</b><span>Day streak</span></a>
        <a href="#/journey"><b>${days}</b><span>Days in</span></a>
      </div>
      <h2 class="you-h">Habits</h2>
      <ul class="you-list">
        <li><a class="you-row" href="#/habits"><span class="you-ico" aria-hidden="true">${icon('habits')}</span><span class="grow"><strong>Your habits</strong><small>${habits.length ? esc(habits.map((h) => h.title).join(' · ')) : 'Pick up to 3 to build'}</small></span>${icon('chevron')}</a></li>
      </ul>
      <h2 class="you-h">Your day</h2>
      <ul class="you-list">
        ${row('#/settings/alarms', 'alarm', 'Alarms & wake-up', alarmsSummary(state))}
        ${row('#/settings/reminders', 'bell', 'Reminders', state.reminders?.enabled ? 'On' : 'Off')}
        ${row('#/settings/day', 'clock', 'Day & week', 'Wake, bed, meal times, week start')}
      </ul>
      <h2 class="you-h">Progress & learning</h2>
      <ul class="you-list">
        ${row('#/rewards', 'star', 'Rewards', g ? `${g.xp} XP` : '')}
        ${row('#/checkin', 'calendar', 'Weekly check-in')}
        ${row('#/learn', 'learn', 'The evidence', 'Why the plan works')}
      </ul>
      <h2 class="you-h">Account & settings</h2>
      <ul class="you-list">
        ${row('#/account', 'user', me ? 'Saved online' : 'Save your progress', me ? me.email : 'Log in so nothing gets lost')}
        ${row('#/settings/profile', 'today', 'About you', 'Body, goal, pace, health')}
        ${row('#/settings/food', 'meals', 'Food', 'Diet, allergies, foods to avoid')}
        ${row('#/settings/movement', 'move', 'Movement', 'Equipment, joints, days')}
        ${row('#/settings/appearance', 'settings', 'Appearance', 'Theme, sounds, vibration')}
        ${row('#/settings/data', 'info', 'Your data', 'Backup, import, delete')}
      </ul>`;
  },
};
