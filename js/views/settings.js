// Settings: profile, food, movement, units/theme, data export/import/reset.
import { html, esc, icon, chips, fmtWeight, weightNum, toKg, heightFromFtIn, fmtHeight } from '../ui/dom.js';
import * as store from '../store.js';
import { ACTIVITY_LEVELS, PACES, weightAtBmi } from '../engine/calc.js';
import { DIETS, ALLERGENS, FOODS } from '../data/foods.js';
import { CARDIO } from '../data/exercises.js';
import { initialProgress, availableSteps } from '../engine/workouts.js';
import { round, cmToIn } from '../engine/util.js';
import * as notify from '../notify.js';
import { DEFAULT_REMINDERS } from '../engine/reminders.js';

const DAYS = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' };
let showBackup = false;
let reminderStatus = '';
let pasteMode = false;
const DISLIKES = Object.fromEntries(Object.entries(FOODS).map(([k, f]) => [k, f.name.replace(/,.*$/, '').replace(/ \(.*\)$/, '')]));

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function remindersHtml(state) {
  const r = { ...DEFAULT_REMINDERS, ...(state.reminders || {}) };
  const p = notify.platform();
  const where = p === 'native'
    ? 'Reminders are scheduled on your phone and arrive even when the app is closed.'
    : p === 'web'
      ? 'In a browser, reminders only appear while Habit Lab is open. Install the Android app for reminders all day.'
      : 'This browser doesn’t support notifications. Install the Android app for reminders.';
  const time = (name, label, hint = '') => `<label class="field" style="margin:0"><span>${label}${hint ? ` <span class="hint">${hint}</span>` : ''}</span><input type="time" name="${name}" value="${esc(r[name])}"></label>`;
  const tog = (name, label, hint) => `<label class="option"><input type="checkbox" name="${name}" value="1" ${r[name] ? 'checked' : ''}><div><strong>${label}</strong><small class="muted">${hint}</small></div></label>`;
  return `<p class="muted" style="font-size:.9rem">Friendly, specific nudges through the day — skipped automatically once you’ve done the thing. ${esc(where)}</p>
    <label class="option" style="margin-bottom:12px"><input type="checkbox" name="enabled" value="1" ${r.enabled ? 'checked' : ''}><div><strong>Turn on reminders</strong><small class="muted">You’ll be asked to allow notifications.</small></div></label>
    <div class="grid two">
      ${time('morning', 'Morning weigh-in & plan')}
      ${time('move', 'Movement nudge', 'only on days with a session')}
      ${time('breakfast', 'Log breakfast')}
      ${time('lunch', 'Log lunch')}
      ${time('dinner', 'Log dinner')}
      ${time('evening', 'Evening wrap-up', 'only if quests are left')}
      ${time('encourageAt', 'Encouragement')}
      <div class="grid two" style="gap:8px">${time('checkinAt', 'Check-in reminder')}<label class="field" style="margin:0"><span>on</span><select name="checkinDay">${DAY_NAMES.map((d, i) => `<option value="${i}" ${Number(r.checkinDay) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label></div>
    </div>
    <div class="options" style="margin-top:12px">
      ${tog('meals', 'Meal logging nudges', 'Breakfast, lunch and dinner — showing what’s planned.')}
      ${tog('encourage', 'Daily encouragement', 'One short tip or pep talk each afternoon.')}
      ${tog('checkin', 'Weekly check-in', 'A reminder on your chosen day.')}
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary">Save reminders</button><button type="button" class="btn" data-action="testNotify">Send a test</button>${reminderStatus ? `<span class="muted" style="font-size:.86rem">${esc(reminderStatus)}</span>` : ''}</div>`;
}

export default {
  render(state) {
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
    return html`<header class="page-head"><div><div class="eyebrow">Habit Lab</div><h1>Settings</h1></div></header>
      ${hide ? '' : `<div class="card"><h2>Your numbers</h2><div class="stats">
        <div class="stat"><span class="v">${t.kcal.toLocaleString()}</span><span class="l">kcal/day target</span></div>
        <div class="stat"><span class="v">${t.tdee.toLocaleString()}</span><span class="l">estimated needs (${t.tdeeSource === 'learned' ? 'learned' : 'formula'})</span></div>
        <div class="stat"><span class="v">${t.proteinG} g</span><span class="l">protein (min ${t.proteinMinG} g)</span></div>
        <div class="stat"><span class="v">${t.fiberG} g</span><span class="l">fibre</span></div></div>
        <p class="muted" style="font-size:.86rem;margin-top:10px">Resting energy ${t.rmr} kcal × activity factor ${ACTIVITY_LEVELS[p.activity].factor}${state.tdeeOffset ? ` ${state.tdeeOffset > 0 ? '+' : '−'} ${Math.abs(state.tdeeOffset)} kcal learned from your data` : ''} − ${t.maintenance ? '0 (maintenance)' : `${PACES[p.pace]?.deficit ?? 500} kcal deficit`}${state.kcalAdjust ? ` ${state.kcalAdjust > 0 ? '+' : '−'} ${Math.abs(state.kcalAdjust)} from check-ins` : ''}${t.hitFloor ? `, held at the ${t.floor} kcal minimum` : ''}.</p></div>`}

      <form data-form="profile" class="card"><h2>About you</h2>
        <div class="grid two">
          <label class="field"><span>Units</span><select name="units"><option value="metric" ${u === 'metric' ? 'selected' : ''}>kg / cm</option><option value="imperial" ${u === 'imperial' ? 'selected' : ''}>lb / ft</option></select></label>
          <label class="field"><span>Age</span><input type="number" name="age" value="${esc(p.age)}" min="18" max="100" required></label>
          <div class="field"><span class="field-label">Height (${fmtHeight(p.heightCm, u)})</span>${u === 'imperial' ? `<div class="inline-inputs"><input type="number" name="heightFt" value="${Math.floor(hIn / 12)}" min="3" max="8"><span class="unit">ft</span><input type="number" name="heightIn" value="${hIn % 12}" min="0" max="11"><span class="unit">in</span></div>` : `<input type="number" name="heightCm" value="${Math.round(p.heightCm)}" min="120" max="230">`}</div>
          <label class="field"><span>Goal weight</span><div class="inline-inputs"><input type="number" name="goal" step="0.1" value="${p.goalWeightKg ? round(weightNum(p.goalWeightKg, u), 0.1) : ''}"><span class="unit">${u === 'imperial' ? 'lb' : 'kg'}</span></div></label>
          <label class="field"><span>Activity (outside planned exercise)</span><select name="activity">${Object.entries(ACTIVITY_LEVELS).map(([k, a]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${a.label}</option>`).join('')}</select></label>
          ${hide ? '' : `<label class="field"><span>Pace</span><select name="pace">${Object.entries(PACES).map(([k, a]) => `<option value="${k}" ${p.pace === k ? 'selected' : ''}>${a.label} (−${a.deficit} kcal)</option>`).join('')}</select></label>`}
          <label class="field"><span>Phase</span><select name="phase"><option value="lose" ${p.phase !== 'maintain' ? 'selected' : ''}>Losing weight</option><option value="maintain" ${p.phase === 'maintain' ? 'selected' : ''}>Maintaining</option></select></label>
          <fieldset><legend>Sex (for the energy equation)</legend>${chips('sex', { female: 'Female', male: 'Male' }, p.sex, { multi: false })}</fieldset>
        </div>
        <fieldset><legend>Health</legend>${chips('medical', { pregnant: 'Pregnant / breastfeeding', eating_disorder: 'Eating disorder (current/past)', diabetes_meds: 'Insulin / sulfonylureas', heart: 'Heart condition', kidney: 'Kidney disease', glp1: 'Weight-loss medicine' }, p.medical || [])}</fieldset>
        <label class="option" style="margin-bottom:12px"><input type="checkbox" name="habitsOnly" value="1" ${p.habitsOnly ? 'checked' : ''}><div><strong>Habits-only mode</strong><small class="muted">Hide calorie numbers and weighing; focus on regular meals, movement and wellbeing.</small></div></label>
        <button class="btn primary">Save</button>
      </form>

      <form data-form="food" class="card"><h2>Food</h2>
        <fieldset><legend>Diet</legend>${chips('diet', Object.fromEntries(Object.entries(DIETS).map(([k, d]) => [k, d.label])), pr.diet, { multi: false })}</fieldset>
        <fieldset><legend>Allergies</legend>${chips('allergies', ALLERGENS, pr.allergies)}</fieldset>
        <details><summary style="cursor:pointer;font-weight:600;margin-bottom:8px">Foods to avoid (${(pr.dislikes || []).length})</summary>${chips('dislikes', DISLIKES, pr.dislikes)}</details>
        <div class="grid two" style="margin-top:12px">
          <label class="field"><span>Budget</span><select name="budget">${[['tight', 'Tight'], ['normal', 'Normal'], ['flexible', 'Flexible']].map(([v, l]) => `<option value="${v}" ${pr.budget === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span>Weekend cooking time</span><select name="maxMinutesWeekend">${[30, 45, 60].map((v) => `<option value="${v}" ${Number(pr.maxMinutesWeekend) === v ? 'selected' : ''}>Up to ${v} min</option>`).join('')}</select></label>
        </div>
        <label class="option"><input type="checkbox" name="noCookLunch" value="1" ${pr.noCookLunch ? 'checked' : ''}><div>Make-ahead or no-cook lunches only</div></label>
        <label class="option" style="margin-top:8px"><input type="checkbox" name="leftovers" value="1" ${pr.leftovers !== false ? 'checked' : ''}><div>Use dinner leftovers for some lunches</div></label>
        <button class="btn primary" style="margin-top:12px">Save & rebuild plan</button>
      </form>

      <form data-form="movement" class="card"><h2>Movement</h2>
        <fieldset><legend>Equipment</legend>${chips('equipment', { bands: 'Resistance bands', dumbbells: 'Dumbbells', gym: 'Gym' }, p.equipment)}</fieldset>
        <fieldset><legend>Painful joints</legend>${chips('limitations', { knee: 'Knees', back: 'Lower back', shoulder: 'Shoulders', wrist: 'Wrists' }, p.limitations)}</fieldset>
        <fieldset><legend>Exercise days</legend>${chips('daysAvailable', DAYS, (p.daysAvailable || []).map(String))}</fieldset>
        <fieldset><legend>Cardio types</legend>${chips('cardioPrefs', Object.fromEntries(Object.entries(CARDIO).map(([k, c]) => [k, c.label])), p.cardioPrefs)}</fieldset>
        <div class="grid two">
          <label class="field"><span>Session length</span><select name="sessionMinutes">${[15, 20, 30, 45].map((m) => `<option value="${m}" ${Number(p.sessionMinutes) === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
          <label class="field"><span>Baseline daily steps</span><input type="number" name="baselineSteps" value="${esc(p.baselineSteps ?? '')}" min="0" max="40000" step="100"></label>
        </div>
        <div class="row"><button class="btn primary">Save</button><button type="button" class="btn ghost danger" data-action="resetProgress">Reset exercise levels</button></div>
      </form>

      <form data-form="reminders" class="card" id="reminders"><h2>Reminders & encouragement</h2>
        ${remindersHtml(state)}
      </form>

      <div class="card"><h2>Appearance</h2><div class="segmented">${[['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" class="${theme === k ? 'on' : ''}" data-action="theme" data-value="${k}">${l}</button>`).join('')}</div></div>

      <div class="card"><h2>Your data</h2>
        <p class="muted">Everything is stored only in this browser on this device. Nothing is uploaded. Export a backup to move to another device or keep a copy.</p>
        <div class="row"><button class="btn" data-action="export">Export backup</button>
          <label class="btn">Import backup file<input type="file" accept="application/json,.json" data-change="importFile" hidden></label>
          <button class="btn" data-action="pasteMode">Paste a backup</button>
          <button class="btn danger" data-action="reset">${icon('trash')}Delete everything</button></div>
        ${showBackup ? `<div style="margin-top:14px"><label class="field"><span>Your backup <span class="hint">If no file downloaded, copy this text and save it somewhere safe (a note or an email to yourself).</span></span><textarea id="backup-out" class="backup" readonly>${esc(store.exportJson(state))}</textarea></label><button class="btn small" data-action="copyBackup">Copy to clipboard</button></div>` : ''}
        ${pasteMode ? `<form data-form="pasteImport" style="margin-top:14px"><label class="field"><span>Paste backup text</span><textarea id="backup-in" name="text" class="backup" required></textarea></label><button class="btn primary small">Import</button></form>` : ''}
      </div>
      <p class="footer-note">Habit Lab${window.HABITLAB_VERSION ? ` ${esc(window.HABITLAB_VERSION)}` : ''} · general information based on published guidelines, not medical advice. <a href="#/learn">See the evidence</a>.</p>`;
  },
  actions: {
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
        for (const k of ['meals', 'encourage', 'checkin']) r[k] = !!data[k];
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
