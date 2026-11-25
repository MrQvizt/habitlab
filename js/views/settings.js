// Settings: profile, food, movement, units/theme, data export/import/reset.
import { goalHint } from './onboarding.js';
import { alarmsPage, alarmsAfter, alarmActions, alarmsSummary } from './alarms.js';
import { html, esc, icon, chips, fmtWeight, weightNum, toKg, heightFromFtIn, fmtHeight } from '../ui/dom.js';
import * as store from '../store.js';
import { ACTIVITY_LEVELS, PACES, weightAtBmi } from '../engine/calc.js';
import { DIETS, ALLERGENS, FOODS } from '../data/foods.js';
import { CARDIO } from '../data/exercises.js';
import { initialProgress, availableSteps } from '../engine/workouts.js';
import { round, cmToIn, weekOrder } from '../engine/util.js';
import * as notify from '../notify.js';
import { DEFAULT_REMINDERS } from '../engine/reminders.js';
import { dayFields, daySummary, readDay } from './day.js';
import { daySchedule, toHHMM } from '../engine/schedule.js';

const DAYS = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' };
let showBackup = false;
let reminderStatus = '';
let pasteMode = false;
const DISLIKES = Object.fromEntries(Object.entries(FOODS).map(([k, f]) => [k, f.name.replace(/,.*$/, '').replace(/ \(.*\)$/, '')]));

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** When your week resets. */
function weekCard(state) {
  const ws = state.prefs.weekStart || 0;
  const order = weekOrder(ws);
  return `<div class="card" id="week-start"><h2>Your week</h2>
    <label class="field"><span>My week starts on</span><select data-change="weekStartSet" aria-label="Week starts on">${DAY_NAMES.map((d, i) => `<option value="${i}" ${ws === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    <div class="week-strip" aria-hidden="true">${order.map((i, k) => `<span class="${k === 0 ? 'first' : k === 6 ? 'last' : ''}">${DAY_NAMES[i].slice(0, 3)}</span>`).join('')}</div>
    <p class="muted" style="font-size:var(--text-sm);margin-bottom:0">Your body rings, weekly activity target, Body Wrap, meal plan and shopping list all reset on ${DAY_NAMES[ws]}. Pick the day that feels like a fresh start — the day you shop, or the first day after the weekend. Last week’s Body Wrap opens on ${DAY_NAMES[ws]}, and the weekly check-in reminder sits on ${DAY_NAMES[(ws + 6) % 7]}, the last day of your week.</p></div>`;
}

function remindersHtml(state) {
  const r = { ...DEFAULT_REMINDERS, ...(state.reminders || {}) };
  const p = notify.platform();
  const where = p === 'native'
    ? 'They arrive even when the app is closed, and skip anything you’ve already done.'
    : p === 'web'
      ? 'In a browser they only appear while Habit Lab is open — the Android app sends them all day.'
      : 'This browser can’t show notifications. The Android app can.';
  const row = (onKey, timeKey, title, sub) => `<li class="lrow" style="cursor:default;min-height:68px">
      <label class="switch"><input type="checkbox" name="${onKey}" value="1" ${r[onKey] ? 'checked' : ''} aria-label="${esc(title)}"><span></span></label>
      <span class="body"><span class="title" style="display:block">${esc(title)}</span><span class="sub" style="display:block">${esc(sub)}</span></span>
      ${timeKey ? `<input type="time" name="${timeKey}" value="${esc(r[timeKey])}" aria-label="${esc(title)} time" style="width:auto;min-width:108px">` : ''}</li>`;
  return `<div class="card" style="padding:14px 16px"><label class="row nowrap" style="gap:14px;cursor:pointer"><span class="grow"><strong style="display:block">Reminders & encouragement</strong><span class="muted" style="font-size:var(--text-sm)">${esc(where)}</span></span><span class="switch"><input type="checkbox" name="enabled" value="1" ${r.enabled ? 'checked' : ''} aria-label="Turn on reminders"><span></span></span></label></div>
    <div class="card tight reminder-list"><ul class="rows">
      ${row('morningOn', 'morning', 'Morning', 'Weigh-in and today’s plan')}
      <li class="lrow" style="cursor:default;flex-wrap:wrap;row-gap:10px">
        <label class="switch"><input type="checkbox" name="meals" value="1" ${r.meals ? 'checked' : ''} aria-label="Meal logging"><span></span></label>
        <span class="body"><span class="title" style="display:block">Meal logging</span><span class="sub" style="display:block">45 min after each meal in <a href="#/settings/day">your day</a></span></span></li>
      ${row('moveOn', 'move', 'Movement', 'Only on days with a session or activity')}
      ${row('encourage', 'encourageAt', 'Encouragement', 'A short tip or pep talk')}
      ${row('eveningOn', 'evening', 'Evening wrap-up', 'Only if quests are left')}
      ${row('checkin', 'checkinAt', 'Weekly check-in', DAY_NAMES[Number(r.checkinDay)] + 's')}
    </ul></div>
    <label class="field"><span>Check-in day</span><select name="checkinDay">${DAY_NAMES.map((d, i) => `<option value="${i}" ${Number(r.checkinDay) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    <div class="action-bar"><button type="button" class="btn ghost" data-action="testNotify">Send a test</button><button class="btn primary">Save</button></div>
    ${reminderStatus ? `<p class="muted" style="font-size:var(--text-sm)" role="status">${esc(reminderStatus)}</p>` : ''}`;
}

export default {
  render(state, params) {
    const p = state.profile;
    const pr = state.prefs;
    const u = p.units === 'imperial' ? 'imperial' : 'metric';
    const t = store.targets(state);
    const hide = store.habitsOnly(state);
    const hIn = Math.round(cmToIn(p.heightCm));
    let theme = 'auto';
    try {
      theme = localStorage.getItem('habitlab.theme') || 'auto';
    } catch (e) {
      /* ignore */
    }
    const section = params[0] || '';
    const SECTIONS = [
      ['profile', 'About you', 'Body, goal, pace, health', 'today'],
      ['food', 'Food', 'Diet, allergies, foods to avoid', 'meals'],
      ['movement', 'Movement', 'Equipment, joints, days', 'move'],
      ['day', 'Your day & week', (() => { const d = daySchedule(state.profile); return `Up ${toHHMM(d.wake)} · bed ${toHHMM(d.bed)} · week starts ${DAY_NAMES[state.prefs.weekStart || 0]}`; })(), 'clock'],
      ['alarms', 'Alarms & wake-up', alarmsSummary(state), 'clock'],
      ['reminders', 'Reminders', state.reminders?.enabled ? 'Nudges to log, move and keep your streak · on' : 'Nudges to log, move and keep your streak · off', 'calendar'],
      ['appearance', 'Appearance & feedback', 'Theme, sounds, vibration', 'star'],
      ['data', 'Your data', 'Backup, import, delete', 'info'],
    ];
    const head = (title, eyebrow = 'Settings') => `<header class="page-head"><div>${section ? `<a class="btn ghost small" href="#/settings" style="margin:0 0 6px -10px">${icon('back')}Settings</a>` : `<div class="eyebrow">${eyebrow}</div>`}<h1>${title}</h1></div></header>`;
    if (section === 'profile') return head('About you') + `
      ${hide ? '' : `<div class="card"><h2>Your numbers</h2><div class="stats">
        <div class="stat"><span class="v">${t.kcal.toLocaleString()}</span><span class="l">kcal/day target</span></div>
        <div class="stat"><span class="v">${t.tdee.toLocaleString()}</span><span class="l">estimated needs (${t.tdeeSource === 'learned' ? 'learned' : 'formula'})</span></div>
        <div class="stat"><span class="v">${t.proteinG} g</span><span class="l">protein (min ${t.proteinMinG} g)</span></div>
        <div class="stat"><span class="v">${t.fiberG} g</span><span class="l">fibre</span></div></div>
        <p class="muted" style="font-size:.86rem;margin-top:10px">Resting energy ${t.rmr} kcal × activity factor ${ACTIVITY_LEVELS[p.activity].factor}${state.tdeeOffset ? ` ${state.tdeeOffset > 0 ? '+' : '−'} ${Math.abs(state.tdeeOffset)} kcal learned from your data` : ''} − ${t.maintenance ? '0 (maintenance)' : `${PACES[p.pace]?.deficit ?? 500} kcal deficit`}${state.kcalAdjust ? ` ${state.kcalAdjust > 0 ? '+' : '−'} ${Math.abs(state.kcalAdjust)} from check-ins` : ''}${t.hitFloor ? `, held at the ${t.floor} kcal minimum` : ''}.</p></div>`}

      <form data-form="profile" class="card">
        <div class="grid two">
          <label class="field"><span>Units</span><select name="units"><option value="metric" ${u === 'metric' ? 'selected' : ''}>kg / cm</option><option value="imperial" ${u === 'imperial' ? 'selected' : ''}>lb / ft</option></select></label>
          <label class="field"><span>Age</span><input type="number" name="age" value="${esc(p.age)}" min="18" max="100" required></label>
          <div class="field"><span class="field-label">Height (${fmtHeight(p.heightCm, u)})</span>${u === 'imperial' ? `<div class="inline-inputs"><input type="number" name="heightFt" aria-label="Height, feet" value="${Math.floor(hIn / 12)}" min="3" max="8"><span class="unit">ft</span><input type="number" name="heightIn" aria-label="Height, inches" value="${hIn % 12}" min="0" max="11"><span class="unit">in</span></div>` : `<input type="number" name="heightCm" aria-label="Height in centimetres" value="${Math.round(p.heightCm)}" min="120" max="230">`}</div>
          <label class="field"><span>Goal weight</span><div class="inline-inputs"><input type="number" name="goal" step="0.1" value="${p.goalWeightKg ? round(weightNum(p.goalWeightKg, u), 0.1) : ''}"><span class="unit">${u === 'imperial' ? 'lb' : 'kg'}</span></div><span class="hint" style="display:block;margin-top:6px">${goalHint(p.heightCm, store.trendWeight(state), u)} <a href="#/journey">See your journey</a></span></label>
          <label class="field"><span>Activity (outside planned exercise)</span><select name="activity">${Object.entries(ACTIVITY_LEVELS).map(([k, a]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${a.label}</option>`).join('')}</select></label>
          ${hide ? '' : `<label class="field"><span>Pace</span><select name="pace">${Object.entries(PACES).map(([k, a]) => `<option value="${k}" ${p.pace === k ? 'selected' : ''}>${a.label} (−${a.deficit} kcal)</option>`).join('')}</select></label>`}
          <label class="field"><span>Phase</span><select name="phase"><option value="lose" ${p.phase !== 'maintain' ? 'selected' : ''}>Losing weight</option><option value="maintain" ${p.phase === 'maintain' ? 'selected' : ''}>Maintaining</option></select></label>
          <fieldset><legend>Sex (for the energy equation)</legend>${chips('sex', { female: 'Female', male: 'Male' }, p.sex, { multi: false })}</fieldset>
        </div>
        <fieldset><legend>Health</legend>${chips('medical', { pregnant: 'Pregnant / breastfeeding', eating_disorder: 'Eating disorder (current/past)', diabetes_meds: 'Insulin / sulfonylureas', heart: 'Heart condition', kidney: 'Kidney disease', glp1: 'Weight-loss medicine' }, p.medical || [])}</fieldset>
        <label class="option" style="margin-bottom:12px"><input type="checkbox" name="habitsOnly" value="1" ${p.habitsOnly ? 'checked' : ''}><div><strong>Habits-only mode</strong><small class="muted">Hide calorie numbers and weighing; focus on regular meals, movement and wellbeing.</small></div></label>
        <div class="action-bar"><span></span><button class="btn primary">Save</button></div>
      </form>
`;
    if (section === 'day') return head('Your day & week') + `
      <form data-form="daySave" class="card">
        <p class="muted" style="font-size:var(--text-sm);margin-top:0">Your meal times, snacks and reminders follow this. Snacks go between meals, never after the kitchen closes.</p>
        ${dayFields(p)}
        <div data-live="day">${daySummary(p)}</div>
        <div class="action-bar"><span></span><button class="btn primary">Save</button></div>
      </form>
      ${weekCard(state)}`;
    if (section === 'food') return head('Food') + `
      <form data-form="food" class="card">
        <fieldset><legend>Diet</legend>${chips('diet', Object.fromEntries(Object.entries(DIETS).map(([k, d]) => [k, d.label])), pr.diet, { multi: false })}</fieldset>
        <fieldset><legend>Allergies</legend>${chips('allergies', ALLERGENS, pr.allergies)}</fieldset>
        <details><summary style="cursor:pointer;font-weight:600;margin-bottom:8px">Foods to avoid (${(pr.dislikes || []).length})</summary>${chips('dislikes', DISLIKES, pr.dislikes)}</details>
        <div class="grid two" style="margin-top:12px">
          <label class="field"><span>Budget</span><select name="budget">${[['tight', 'Tight'], ['normal', 'Normal'], ['flexible', 'Flexible']].map(([v, l]) => `<option value="${v}" ${pr.budget === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span>Weekend cooking time</span><select name="maxMinutesWeekend">${[30, 45, 60].map((v) => `<option value="${v}" ${Number(pr.maxMinutesWeekend) === v ? 'selected' : ''}>Up to ${v} min</option>`).join('')}</select></label>
        </div>
        <label class="option"><input type="checkbox" name="noCookLunch" value="1" ${pr.noCookLunch ? 'checked' : ''}><div>Make-ahead or no-cook lunches only</div></label>
        <label class="option" style="margin-top:8px"><input type="checkbox" name="leftovers" value="1" ${pr.leftovers !== false ? 'checked' : ''}><div>Use dinner leftovers for some lunches</div></label>
        <div class="action-bar"><span class="muted" style="font-size:var(--text-sm)">Rebuilds the rest of this week</span><button class="btn primary">Save</button></div>
      </form>
`;
    if (section === 'movement') return head('Movement') + `
      <form data-form="movement" class="card">
        <fieldset><legend>Equipment</legend>${chips('equipment', { bands: 'Resistance bands', dumbbells: 'Dumbbells', gym: 'Gym' }, p.equipment)}</fieldset>
        <fieldset><legend>Painful joints</legend>${chips('limitations', { knee: 'Knees', back: 'Lower back', shoulder: 'Shoulders', wrist: 'Wrists' }, p.limitations)}</fieldset>
        <fieldset><legend>Exercise days</legend>${chips('daysAvailable', DAYS, (p.daysAvailable || []).map(String))}</fieldset>
        <fieldset><legend>Cardio types</legend>${chips('cardioPrefs', Object.fromEntries(Object.entries(CARDIO).map(([k, c]) => [k, c.label])), p.cardioPrefs)}</fieldset>
        <div class="grid two">
          <label class="field"><span>Session length</span><select name="sessionMinutes">${[15, 20, 30, 45].map((m) => `<option value="${m}" ${Number(p.sessionMinutes) === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
          <label class="field"><span>Baseline daily steps</span><input type="number" name="baselineSteps" value="${esc(p.baselineSteps ?? '')}" min="0" max="40000" step="100"></label>
        </div>
        <button type="button" class="btn ghost small danger" data-action="resetProgress">Reset exercise levels</button>
        <div class="action-bar"><span></span><button class="btn primary">Save</button></div>
      </form>
`;
    if (section === 'alarms') return head('Alarms & wake-up') + alarmsPage(state);
    if (section === 'reminders') return head('Reminders') + `
      <p class="muted" style="font-size:var(--text-sm);margin-top:-6px">Quiet notifications to log meals, move and keep your streak. Want something that rings, like a wake-up or bedtime alarm? <a href="#/settings/alarms">Alarms & wake-up</a></p>
      <form data-form="reminders" id="reminders">
        ${remindersHtml(state)}
      </form>
`;
    if (section === 'appearance') return head('Appearance & feedback') + `
      <div class="card"><h2 class="h3" style="margin-bottom:10px">Theme</h2><div class="segmented">${[['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" class="${theme === k ? 'on' : ''}" data-action="theme" data-value="${k}">${l}</button>`).join('')}</div></div>

      <div class="card"><h2 class="h3" style="margin-bottom:6px">Feedback</h2>
        <label class="option"><input type="checkbox" data-change="gamePref" data-key="sound" ${state.game.sound ? 'checked' : ''}><div><strong>Sounds</strong><small class="muted">A short chime when you earn XP.</small></div></label>
        <label class="option" style="margin-top:8px"><input type="checkbox" data-change="gamePref" data-key="haptics" ${state.game.haptics ? 'checked' : ''}><div><strong>Vibration</strong><small class="muted">A tiny buzz on supported phones.</small></div></label></div>`;
    if (section === 'data') return head('Your data') + `
      <div class="card" style="order:9"><h2 class="h3" style="margin-bottom:4px">Delete all data</h2><p class="muted" style="font-size:var(--text-sm)">Removes everything from ${notify.platform() === 'native' ? 'this phone' : 'this browser'}. Export a backup first if you might want it back.</p><button class="btn ghost danger small" data-action="reset">${icon('trash')}Delete all data…</button></div>`.replace('style="order:9"', '') + `
      <div class="card">
        <p class="muted">${notify.platform() === 'native' ? 'Everything is stored only on this phone' : 'Everything is stored only in this browser on this device'}. Nothing is uploaded. Export a backup to move to another device or keep a copy.</p>
        <div class="row"><button class="btn" data-action="export">Export backup</button>
          <label class="btn">Import backup file<input type="file" accept="application/json,.json" data-change="importFile" hidden></label>
          <button class="btn" data-action="pasteMode">Paste a backup</button>
          </div>
        ${showBackup ? `<div style="margin-top:14px"><label class="field"><span>Your backup <span class="hint">If no file downloaded, copy this text and save it somewhere safe (a note or an email to yourself).</span></span><textarea id="backup-out" class="backup" readonly>${esc(store.exportJson(state))}</textarea></label><button class="btn small" data-action="copyBackup">Copy to clipboard</button></div>` : ''}
        ${pasteMode ? `<form data-form="pasteImport" style="margin-top:14px"><label class="field"><span>Paste backup text</span><textarea id="backup-in" name="text" class="backup" required></textarea></label><button class="btn primary small">Import</button></form>` : ''}
      </div>`;
    return head('Settings', 'Habit Lab') + `
      <div class="card tight"><ul class="rows">${SECTIONS.map(([id, t, sub, ic]) => `<li><a class="lrow" href="#/settings/${id}" style="text-decoration:none"><span class="slot-ico">${icon(ic)}</span><span class="body"><span class="title" style="display:block">${t}</span><span class="sub" style="display:block">${esc(sub)}</span></span><span class="trail">${icon('chevron')}</span></a></li>`).join('')}</ul></div>
      <div class="card tight"><ul class="rows">
        <li><a class="lrow" href="#/learn" style="text-decoration:none"><span class="slot-ico">${icon('learn')}</span><span class="body"><span class="title" style="display:block">The evidence</span><span class="sub" style="display:block">The research behind every feature</span></span><span class="trail">${icon('chevron')}</span></a></li>
        <li><a class="lrow" href="#/rewards" style="text-decoration:none"><span class="slot-ico">${icon('star')}</span><span class="body"><span class="title" style="display:block">Rewards</span><span class="sub" style="display:block">Level, badges and XP</span></span><span class="trail">${icon('chevron')}</span></a></li>
      </ul></div>
      <p class="footer-note">Habit Lab${window.HABITLAB_VERSION ? ` ${esc(window.HABITLAB_VERSION)}` : ''} · general information based on published guidelines, not medical advice. <a href="#/learn">See the evidence</a>.</p>`;
  },
  after(root, ctx, params) {
    if (params[0] === 'alarms') alarmsAfter(root, ctx);
  },
  actions: {
    ...alarmActions,
    weekStartSet(el, ev, ctx) {
      const next = Number(el.value);
      const prev = ctx.state.prefs.weekStart || 0;
      if (next === prev) return;
      ctx.update((st) => {
        st.prefs = { ...st.prefs, weekStart: next };
        // The check-in reminder followed the old week's last day: move it to the new one.
        if (Number(st.reminders?.checkinDay ?? 6) === (prev + 6) % 7) st.reminders = { ...st.reminders, checkinDay: (next + 6) % 7 };
        return st;
      }, { quiet: true });
      ctx.toast(`Your week now starts on ${DAY_NAMES[next]}`);
    },
    useGoalDraft(el) {
      const input = el.closest('form')?.querySelector('[name=goal]');
      if (input) input.value = el.dataset.value;
    },
    daySave(form, ev, ctx, data) {
      ctx.update((st) => {
        const before = daySchedule(st.profile);
        st.profile.schedule = { ...(st.profile.schedule || {}), ...readDay(data) };
        const d = daySchedule(st.profile);
        // Move untouched default reminder times along with the new rhythm.
        const r = { ...DEFAULT_REMINDERS, ...(st.reminders || {}) };
        if (r.morning === DEFAULT_REMINDERS.morning || r.morning === toHHMM(before.wake + 15)) r.morning = toHHMM(d.wake + 15);
        if (r.evening === DEFAULT_REMINDERS.evening || r.evening === toHHMM(Math.min(before.last + 90, before.bed - 60))) r.evening = toHHMM(Math.min(d.last + 90, d.bed - 60));
        st.reminders = r;
        st.flags = { ...(st.flags || {}), dayAsked: true };
        return st;
      });
      ctx.toast('Your day is saved — meals and reminders now follow it.');
    },
    gamePref(el, ev, ctx) {
      ctx.update((st) => {
        st.game = { ...st.game, [el.dataset.key]: el.checked };
        return st;
      }, { quiet: true });
    },
    async reminders(form, ev, ctx, data) {
      const enabled = !!data.enabled;
      if (enabled && (await notify.permissionState()) !== 'granted') {
        const res = await notify.requestPermission();
        if (res !== 'granted') {
          reminderStatus = 'Notifications are blocked. Allow them for Habit Lab in your phone or browser settings.';
          ctx.update((st) => ({ ...st, reminders: { ...st.reminders, enabled: false } }), { quiet: true });
          return;
        }
      }
      ctx.update((st) => {
        const r = { ...st.reminders, enabled };
        for (const k of ['morning', 'breakfast', 'lunch', 'dinner', 'move', 'evening', 'encourageAt', 'checkinAt']) if (data[k]) r[k] = data[k];
        for (const k of ['meals', 'encourage', 'checkin', 'morningOn', 'moveOn', 'eveningOn']) r[k] = !!data[k];
        r.checkinDay = Number(data.checkinDay);
        st.reminders = r;
        return st;
      }, { quiet: true });
      const res = await ctx.syncReminders();
      reminderStatus = enabled ? `On — ${res?.scheduled ?? 0} reminders scheduled${res?.platform === 'web' ? ' for while this page is open' : ' for the next 7 days'}.` : 'Reminders are off.';
      ctx.rerender();
    },
    async testNotify(el, ev, ctx) {
      if ((await notify.permissionState()) !== 'granted' && (await notify.requestPermission()) !== 'granted') {
        reminderStatus = 'Notifications are blocked. Allow them in your phone or browser settings.';
        return ctx.rerender();
      }
      await notify.test();
      ctx.toast('A test notification will arrive in about 5 seconds.');
    },
    profile(form, ev, ctx, data) {
      ctx.update((st) => {
        const p = st.profile;
        const oldU = p.units;
        p.units = data.units;
        p.age = Number(data.age) || p.age;
        if (oldU === 'imperial' && data.heightFt) {
          const cm = heightFromFtIn(data.heightFt, data.heightIn);
          if (Math.round(cmToIn(cm)) !== Math.round(cmToIn(p.heightCm))) p.heightCm = cm; // only if actually changed
        }
        else if (oldU !== 'imperial' && data.heightCm) p.heightCm = Number(data.heightCm);
        if (data.goal) {
          const g = toKg(Number(data.goal), oldU === 'imperial' ? 'imperial' : 'metric');
          p.goalWeightKg = Math.max(g, Math.ceil(weightAtBmi(18.5, p.heightCm)));
        } else p.goalWeightKg = null;
        p.activity = data.activity;
        if (data.pace) p.pace = data.pace;
        if (data.phase !== p.phase) {
          p.phase = data.phase;
          if (data.phase === 'maintain') st.maintainKg = store.trendWeight(st);
          st.kcalAdjust = 0;
        }
        p.sex = data.sex || p.sex;
        p.medical = data.medical || [];
        p.habitsOnly = !!data.habitsOnly;
        return st;
      });
      ctx.toast('Saved.');
    },
    food(form, ev, ctx, data) {
      ctx.update((st) => {
        Object.assign(st.prefs, {
          diet: data.diet || st.prefs.diet,
          allergies: data.allergies || [],
          dislikes: data.dislikes || [],
          budget: data.budget,
          maxMinutesWeekend: Number(data.maxMinutesWeekend),
          noCookLunch: !!data.noCookLunch,
          leftovers: !!data.leftovers,
        });
        return st;
      });
      ctx.toast('Saved — the rest of this week’s plan has been rebuilt.');
    },
    movement(form, ev, ctx, data) {
      ctx.update((st) => {
        const p = st.profile;
        Object.assign(p, {
          equipment: data.equipment || [],
          limitations: data.limitations || [],
          daysAvailable: (data.daysAvailable || []).map(Number),
          cardioPrefs: data.cardioPrefs?.length ? data.cardioPrefs : ['walk'],
          sessionMinutes: Number(data.sessionMinutes),
          baselineSteps: data.baselineSteps ? Number(data.baselineSteps) : null,
        });
        // Re-fit each chain: keep the level if still available, otherwise drop to the nearest available rung.
        const fresh = initialProgress(p);
        const prog = {};
        for (const [k, init] of Object.entries(fresh)) {
          const cur = st.workouts.progress[k];
          const ok = cur && availableSteps(k, p).some((s) => s.id === cur.stepId);
          prog[k] = ok ? cur : init;
        }
        st.workouts.progress = prog;
        return st;
      });
      ctx.toast('Saved. Exercises updated for your equipment and joints.');
    },
    async resetProgress(el, ev, ctx) {
      if (!(await ctx.confirm('Reset all exercise levels to the start?', { ok: 'Reset' }))) return;
      ctx.update((st) => {
        st.workouts.progress = initialProgress(st.profile);
        return st;
      });
    },
    async export(el, ev, ctx) {
      showBackup = true;
      ctx.rerender();
      const filename = `habit-lab-backup-${store.today()}.json`;
      const json = store.exportJson(ctx.state);
      // Hosts that provide a downloads capability (e.g. a published claude.ai page) ask the viewer to confirm.
      const downloads = window.claude?.use ? await window.claude.use('downloads').catch(() => null) : null;
      if (downloads) {
        try {
          await downloads.save({ filename, data: json });
          ctx.toast('Backup saved.');
        } catch (e) {
          if (e?.code !== 'declined') ctx.toast('A file couldn’t be saved here — copy the backup text below instead.');
        }
        return;
      }
      if (document.documentElement.classList.contains('framed')) return; // embedded: use the copy box
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    },
    importFile(el, ev, ctx) {
      const file = el.files?.[0];
      if (!file) return;
      file.text().then(async (text) => {
        try {
          const data = store.importJson(text);
          if (!(await ctx.confirm('Replace all current data with this backup?', { ok: 'Replace', danger: true }))) return;
          ctx.set(data, { quiet: true });
          ctx.toast('Backup imported.');
        } catch (e) {
          ctx.toast(e.message || 'Couldn’t read that file.');
        }
      });
    },
    async copyBackup(el, ev, ctx) {
      const ta = document.getElementById('backup-out');
      try {
        await navigator.clipboard.writeText(ta.value);
        ctx.toast('Copied.');
      } catch (e) {
        ta.focus();
        ta.select();
        ctx.toast('Text selected — press Ctrl/Cmd+C to copy.');
      }
    },
    pasteMode(el, ev, ctx) {
      pasteMode = !pasteMode;
      ctx.rerender();
    },
    async pasteImport(form, ev, ctx, data) {
      try {
        const st = store.importJson(data.text);
        if (!(await ctx.confirm('Replace all current data with this backup?', { ok: 'Replace', danger: true }))) return;
        pasteMode = false;
        ctx.set(st, { quiet: true });
        ctx.toast('Backup imported.');
      } catch (e) {
        ctx.toast(e instanceof SyntaxError ? 'That text isn’t a complete backup — copy the whole thing.' : e.message);
      }
    },
    async reset(el, ev, ctx) {
      if (!(await ctx.confirm('Delete all your Habit Lab data from this browser? This can’t be undone. Consider exporting a backup first.', { ok: 'Delete everything', danger: true }))) return;
      store.clearAll();
      ctx.set(store.emptyState(), { render: false });
      store.clearAll();
      ctx.go('#/start');
    },
  },
};
void fmtWeight;
