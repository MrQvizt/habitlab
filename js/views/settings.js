// Settings: profile, food, movement, units/theme, data export/import/reset.
import { html, esc, icon, chips, fmtWeight, weightNum, toKg, heightFromFtIn, fmtHeight } from '../ui/dom.js';
import * as store from '../store.js';
import { ACTIVITY_LEVELS, PACES, weightAtBmi } from '../engine/calc.js';
import { DIETS, ALLERGENS, FOODS } from '../data/foods.js';
import { CARDIO } from '../data/exercises.js';
import { initialProgress, availableSteps } from '../engine/workouts.js';
import { round, cmToIn } from '../engine/util.js';

const DAYS = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' };
const DISLIKES = Object.fromEntries(Object.entries(FOODS).map(([k, f]) => [k, f.name.replace(/,.*$/, '').replace(/ \(.*\)$/, '')]));

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
    return html`<h1>Settings</h1>
      ${hide ? '' : `<div class="card"><h2>Your numbers</h2><div class="stats">
        <div class="stat"><span class="v">${t.kcal.toLocaleString()}</span><span class="l">kcal/day target</span></div>
        <div class="stat"><span class="v">${t.tdee.toLocaleString()}</span><span class="l">estimated needs (${t.tdeeSource === 'learned' ? 'learned' : 'formula'})</span></div>
        <div class="stat"><span class="v">${t.proteinG} g</span><span class="l">protein (min ${t.proteinMinG} g)</span></div>
        <div class="stat"><span class="v">${t.fiberG} g</span><span class="l">fibre</span></div></div>
        <p class="muted" style="font-size:.86rem;margin-top:10px">Resting energy ${t.rmr} kcal × activity factor ${ACTIVITY_LEVELS[p.activity].factor}${state.tdeeOffset ? ` ${state.tdeeOffset > 0 ? '+' : '−'} ${Math.abs(state.tdeeOffset)} kcal learned from your data` : ''} − ${t.maintenance ? '0 (maintenance)' : `${PACES[p.pace]?.deficit ?? 500} kcal deficit`}${state.kcalAdjust ? ` ${state.kcalAdjust > 0 ? '+' : '−'} ${Math.abs(state.kcalAdjust)} from check-ins` : ''}${t.hitFloor ? `, held at the ${t.floor} kcal minimum` : ''}.</p></div>`}

      <form data-form="profile" class="card"><h2>About you</h2>
        <div class="grid two">
          <label class="field"><span>Units</span><select name="units"><option value="metric" ${u === 'metric' ? 'selected' : ''}>kg / cm</option><option value="imperial" ${u === 'imperial' ? 'selected' : ''}>lb / ft</option></select></label>
          <label class="field"><span>Age</span><input type="number" name="age" value="${p.age}" min="18" max="100" required></label>
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
          <label class="field"><span>Baseline daily steps</span><input type="number" name="baselineSteps" value="${p.baselineSteps ?? ''}" min="0" max="40000" step="100"></label>
        </div>
        <div class="row"><button class="btn primary">Save</button><button type="button" class="btn ghost danger" data-action="resetProgress">Reset exercise levels</button></div>
      </form>

      <div class="card"><h2>Appearance</h2><div class="segmented">${[['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" class="${theme === k ? 'on' : ''}" data-action="theme" data-value="${k}">${l}</button>`).join('')}</div></div>

      <div class="card"><h2>Your data</h2>
        <p class="muted">Everything is stored only in this browser on this device. Nothing is uploaded. Export a backup to move to another device or keep a copy.</p>
        <div class="row"><button class="btn" data-action="export">Export backup</button>
          <label class="btn">Import backup<input type="file" accept="application/json,.json" data-change="importFile" hidden></label>
          <button class="btn danger" data-action="reset">${icon('trash')}Delete everything</button></div>
      </div>
      <p class="footer-note">Habit Lab · general information based on published guidelines, not medical advice. <a href="#/learn">See the evidence</a>.</p>`;
  },
  actions: {
    profile(form, ev, ctx, data) {
      ctx.update((st) => {
        const p = st.profile;
        const oldU = p.units;
        p.units = data.units;
        p.age = Number(data.age) || p.age;
        if (oldU === 'imperial' && data.heightFt) p.heightCm = heightFromFtIn(data.heightFt, data.heightIn);
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
    resetProgress(el, ev, ctx) {
      if (!confirm('Reset all exercise levels to the start?')) return;
      ctx.update((st) => {
        st.workouts.progress = initialProgress(st.profile);
        return st;
      });
    },
    export(el, ev, ctx) {
      const blob = new Blob([store.exportJson(ctx.state)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `habit-lab-backup-${store.today()}.json`;
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
      file.text().then((text) => {
        try {
          if (!confirm('Replace all current data with this backup?')) return;
          ctx.set(store.importJson(text));
          ctx.toast('Backup imported.');
        } catch (e) {
          ctx.toast(e.message || 'Couldn’t read that file.');
        }
      });
    },
    reset(el, ev, ctx) {
      if (!confirm('Delete all your Habit Lab data from this browser? This can’t be undone. Consider exporting a backup first.')) return;
      store.clearAll();
      ctx.set(store.emptyState(), { render: false });
      store.clearAll();
      ctx.go('#/start');
    },
  },
};
void fmtWeight;
void esc;
