// Onboarding wizard: about you → health check → food → movement → habits → your plan.
import { html, esc, chips, icon, toKg, weightNum, heightFromFtIn, fmtWeight } from '../ui/dom.js';
import { ACTIVITY_LEVELS, PACES, dailyTargets, bmi, weightAtBmi, projectWeeks } from '../engine/calc.js';
import { DIETS, ALLERGENS, FOODS } from '../data/foods.js';
import { CARDIO } from '../data/exercises.js';
import { HABITS } from '../data/habits.js';
import { suggestNext } from '../engine/habits.js';
import { screen } from '../engine/safety.js';
import { emptyState, importJson } from '../store.js';
import { isoDate, round, cmToIn } from '../engine/util.js';
import { demoState } from '../demo.js';

let draft = { step: 0, units: 'metric' };

const STEPS = ['Welcome', 'About you', 'Health check', 'Food', 'Movement', 'Habits', 'Your plan'];
const DAYS = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' };
const DISLIKE_OPTIONS = ['tofu', 'tempeh', 'salmon', 'cod', 'tuna_can', 'shrimp', 'egg', 'cottage_cheese', 'greek_yogurt', 'mushrooms', 'avocado', 'chickpeas', 'lentils', 'black_beans', 'quinoa', 'brown_rice', 'sweet_potato', 'broccoli', 'spinach', 'kimchi', 'peanut_butter', 'whey', 'beef_mince', 'pork_tenderloin'];
const STRUGGLES = {
  evening: 'Evening snacking',
  emotional: 'Eating when stressed or low',
  portions: 'Big portions',
  drinks: 'Sugary drinks or alcohol',
  time: 'No time to cook',
  sleep: 'Poor sleep',
  motivation: 'Staying consistent',
};

function stepper() {
  return `<div class="steps-wizard" aria-label="Step ${draft.step} of ${STEPS.length - 1}">${STEPS.slice(1).map((_, i) => `<span class="${i < draft.step ? 'on' : ''}"></span>`).join('')}</div>`;
}

function nav(final = false) {
  return `<div class="action-bar"><button type="button" class="btn ghost" data-action="back">${icon('back')}Back</button><button class="btn primary" type="submit">${final ? 'Start my plan' : 'Continue'}${final ? '' : icon('chevron')}</button></div>`;
}

function num(name, value, { min, max, step = 'any', unit = '', placeholder = '', required = true } = {}) {
  return `<div class="inline-inputs"><input type="number" inputmode="decimal" name="${name}" value="${esc(value ?? '')}" min="${min}" max="${max}" step="${step}" placeholder="${placeholder}" ${required ? 'required' : ''}>${unit ? `<span class="unit">${unit}</span>` : ''}</div>`;
}

function welcome() {
  return html`
  <div class="hero">
    <div class="row"><span class="logo">HL</span><strong>Habit Lab</strong></div>
    <h1 style="margin-top:14px">Lose weight by building habits that last</h1>
    <p class="muted-2">A meal plan, a workout plan and a small set of habits — built from the research on what actually works for people with obesity, and adjusted every week from your check-ins.</p>
    <div class="row"><button class="btn primary" data-action="next">Get started ${icon('chevron')}</button><button class="btn" data-action="demo">Explore with demo data</button></div>
  </div>
  <div class="grid three">
    <div class="card flat"><h3>${icon('meals')} Meals that fit you</h3><p class="muted">Recipes matched to your calories, protein, diet, allergies, time and budget — plus a shopping list.</p></div>
    <div class="card flat"><h3>${icon('move')} Workouts that progress</h3><p class="muted">Start where you are — even from a chair. Each exercise gets easier or harder based on your feedback.</p></div>
    <div class="card flat"><h3>${icon('habits')} One habit at a time</h3><p class="muted">Small “after I…, I will…” habits, tracked with a forgiving streak. Add the next once one sticks.</p></div>
  </div>
  <div class="card flat">
    <h3>Before you start</h3>
    <ul class="muted-2" style="padding-left:20px;margin:0">
      <li><strong>Private by design.</strong> Everything stays in this browser. No account, no server, nothing is sent anywhere.</li>
      <li><strong>Not medical care.</strong> This is a self-management tool based on published guidelines. If you have a medical condition or take medication, check with your doctor.</li>
      <li><strong>Built on evidence.</strong> See the <a href="#/learn">Learn</a> section for the research behind each feature.</li>
    </ul>
    <p style="margin-top:12px" class="muted">Moving from another device? <label class="btn small" style="display:inline-flex"><input type="file" accept="application/json,.json" data-change="importFile" hidden>Import a backup</label></p>
  </div>`;
}

function about() {
  const u = draft.units;
  const imperial = u === 'imperial';
  const hIn = draft.heightCm ? Math.round(cmToIn(draft.heightCm)) : null;
  return html`<header class="page-head" style="margin-bottom:6px"><div><div class="eyebrow">Step ${draft.step} of 6</div><h1>About you</h1></div></header><p class="muted">Used to estimate your energy needs. You can change any of this later.</p>
  <form data-form="step" class="card">
    <fieldset><legend>Units</legend><div class="segmented" role="radiogroup">
      <button type="button" class="${!imperial ? 'on' : ''}" data-action="units" data-value="metric">kg / cm</button>
      <button type="button" class="${imperial ? 'on' : ''}" data-action="units" data-value="imperial">lb / ft</button></div></fieldset>
    <fieldset><legend>Sex <span class="hint">The energy equation differs by sex. If you’re trans or non-binary, pick the one closest to your current hormones, or ask your clinician.</span></legend>
      ${chips('sex', { female: 'Female', male: 'Male' }, draft.sex || '', { multi: false })}</fieldset>
    <div class="grid two">
      <label class="field"><span>Age</span>${num('age', draft.age, { min: 12, max: 100, step: 1, unit: 'years' })}</label>
      <div class="field"><span class="field-label">Height</span>${imperial
        ? `<div class="inline-inputs">${num('heightFt', hIn ? Math.floor(hIn / 12) : '', { min: 3, max: 8, step: 1, unit: 'ft' })}${num('heightIn', hIn ? hIn % 12 : '', { min: 0, max: 11, step: 1, unit: 'in' })}</div>`
        : num('heightCm', draft.heightCm ? Math.round(draft.heightCm) : '', { min: 120, max: 230, step: 1, unit: 'cm' })}</div>
      <label class="field"><span>Current weight</span>${num('weight', draft.weightKg ? round(weightNum(draft.weightKg, u), 0.1) : '', { min: imperial ? 80 : 35, max: imperial ? 800 : 360, unit: imperial ? 'lb' : 'kg' })}</label>
      <label class="field"><span>Goal weight <span class="hint">Optional. A 5–10% loss already brings real health benefits — you can always set a new goal later.</span></span>${num('goal', draft.goalWeightKg ? round(weightNum(draft.goalWeightKg, u), 0.1) : '', { min: imperial ? 80 : 35, max: imperial ? 800 : 360, unit: imperial ? 'lb' : 'kg', required: false, placeholder: 'e.g. 10% lower' })}</label>
    </div>
    <fieldset><legend>How active is a normal day?</legend><div class="options">
      ${Object.entries(ACTIVITY_LEVELS).map(([k, a]) => `<label class="option"><input type="radio" name="activity" value="${k}" ${(draft.activity || 'sedentary') === k ? 'checked' : ''}><div><strong>${a.label}</strong><small class="muted">${a.hint}</small></div></label>`)}
    </div></fieldset>
    ${nav()}
  </form>`;
}

function health() {
  const med = new Set(draft.medical || []);
  return html`<header class="page-head" style="margin-bottom:6px"><div><div class="eyebrow">Step ${draft.step} of 6</div><h1>Health check</h1></div></header><p class="muted">A few questions so the plan stays safe for you. Answers stay on this device.</p>
  <form data-form="step" class="card">
    <fieldset><legend>Do any of these apply?</legend><div class="options">
      ${[
        ['pregnant', 'Pregnant, trying to conceive soon, or breastfeeding'],
        ['eating_disorder', 'Current or past eating disorder'],
        ['diabetes_meds', 'Diabetes treated with insulin or sulfonylureas (e.g. gliclazide)'],
        ['heart', 'Heart disease, chest pain on exertion, fainting, or uncontrolled blood pressure'],
        ['kidney', 'Chronic kidney disease'],
        ['glp1', 'Taking a weight-loss medicine (e.g. semaglutide, tirzepatide)'],
      ].map(([v, l]) => `<label class="option"><input type="checkbox" name="medical" value="${v}" ${med.has(v) ? 'checked' : ''}><div>${l}</div></label>`)}
    </div></fieldset>
    <fieldset><legend>In the last 3 months, have you…</legend><div class="options">
      ${[
        ['binge', 'often felt you couldn’t stop eating once you started, eating a very large amount?'],
        ['compensate', 'made yourself sick, used laxatives, or exercised hard to make up for eating?'],
        ['worth', 'felt that your weight or shape is the main thing that decides how you feel about yourself?'],
      ].map(([v, l]) => `<label class="option"><input type="checkbox" name="edFlags" value="${v}" ${(draft.edFlags || []).includes(v) ? 'checked' : ''}><div>…${l}</div></label>`)}
    </div><span class="hint">These are common and nothing to be ashamed of. If any apply, the app will focus on regular meals and wellbeing habits rather than calorie targets, and point you to support.</span></fieldset>
    <fieldset><legend>Any joints that hurt with exercise?</legend>
      ${chips('limitations', { knee: 'Knees', back: 'Lower back', shoulder: 'Shoulders', wrist: 'Wrists' }, draft.limitations || [])}
      <span class="hint">Exercises that load these joints will be swapped for gentler versions.</span></fieldset>
    ${nav()}
  </form>`;
}

function food() {
  return html`<header class="page-head" style="margin-bottom:6px"><div><div class="eyebrow">Step ${draft.step} of 6</div><h1>Food</h1></div></header><p class="muted">No diet is “best” — the one you can stick with is. Same calories, your choice of foods.</p>
  <form data-form="step" class="card">
    <fieldset><legend>What do you eat?</legend>${chips('diet', Object.fromEntries(Object.entries(DIETS).map(([k, d]) => [k, d.label])), draft.diet || 'omnivore', { multi: false })}</fieldset>
    <fieldset><legend>Allergies or intolerances</legend>${chips('allergies', ALLERGENS, draft.allergies || [])}</fieldset>
    <fieldset><legend>Foods you don’t like <span class="hint">Recipes containing these won’t be suggested.</span></legend>
      ${chips('dislikes', Object.fromEntries(DISLIKE_OPTIONS.map((id) => [id, FOODS[id].name.replace(/,.*$/, '').replace(/ \(.*\)$/, '')])), draft.dislikes || [])}</fieldset>
    <div class="grid two">
      <label class="field"><span>Meals a day</span><select name="mealsPerDay">
        ${[['', 'Let the app decide'], ['3', '3 meals'], ['4', '3 meals + 1 snack'], ['5', '3 meals + 2 snacks']].map(([v, l]) => `<option value="${v}" ${String(draft.mealsPerDay || '') === v ? 'selected' : ''}>${l}</option>`)}
      </select><span class="hint">Meal frequency doesn’t change weight loss — pick what suits your day.</span></label>
      <label class="field"><span>Weekday cooking time</span><select name="maxMinutesWeekday">
        ${[[15, 'Up to 15 min'], [30, 'Up to 30 min'], [45, 'Up to 45 min'], [60, 'An hour is fine']].map(([v, l]) => `<option value="${v}" ${Number(draft.maxMinutesWeekday || 30) === v ? 'selected' : ''}>${l}</option>`)}
      </select></label>
      <label class="field"><span>Budget</span><select name="budget">
        ${[['tight', 'Tight — cheapest options'], ['normal', 'Normal'], ['flexible', 'Flexible']].map(([v, l]) => `<option value="${v}" ${(draft.budget || 'normal') === v ? 'selected' : ''}>${l}</option>`)}
      </select></label>
      <label class="field"><span>Variety</span><select name="variety">
        ${[['low', 'Low — repeat meals, fewer decisions'], ['medium', 'Medium — leftovers for lunch'], ['high', 'High — lots of different meals']].map(([v, l]) => `<option value="${v}" ${(draft.variety || 'medium') === v ? 'selected' : ''}>${l}</option>`)}
      </select></label>
    </div>
    <label class="option"><input type="checkbox" name="noCookLunch" value="1" ${draft.noCookLunch ? 'checked' : ''}><div><strong>I need lunches I can make ahead or without a stove</strong><small class="muted">For work or school days.</small></div></label>
    ${nav()}
  </form>`;
}

function movement() {
  return html`<header class="page-head" style="margin-bottom:6px"><div><div class="eyebrow">Step ${draft.step} of 6</div><h1>Movement</h1></div></header><p class="muted">Start low, go slow. Some activity beats none, and the plan grows with you.</p>
  <form data-form="step" class="card">
    <fieldset><legend>Strength training experience</legend><div class="options">
      ${[['none', 'New to it', 'We’ll start with chair and wall exercises.'], ['some', 'Some experience', 'I’ve done bodyweight or gym work before.'], ['regular', 'I train regularly', 'Comfortable with squats, push-ups, weights.']].map(([v, l, h]) => `<label class="option"><input type="radio" name="experience" value="${v}" ${(draft.experience || 'none') === v ? 'checked' : ''}><div><strong>${l}</strong><small class="muted">${h}</small></div></label>`)}
    </div></fieldset>
    <fieldset><legend>Equipment you have <span class="hint">Nothing at all is fine.</span></legend>${chips('equipment', { bands: 'Resistance bands', dumbbells: 'Dumbbells', gym: 'Gym access' }, draft.equipment || [])}</fieldset>
    <fieldset><legend>Which days could you exercise?</legend>${chips('daysAvailable', DAYS, (draft.daysAvailable || [0, 2, 4]).map(String))}</fieldset>
    <div class="grid two">
      <label class="field"><span>Time per session</span><select name="sessionMinutes">
        ${[15, 20, 30, 45].map((m) => `<option value="${m}" ${Number(draft.sessionMinutes || 30) === m ? 'selected' : ''}>${m} minutes</option>`)}</select></label>
      <label class="field"><span>Current activity per week <span class="hint">Brisk walking, cycling, swimming… (minutes)</span></span>${num('baselineCardioMin', draft.baselineCardioMin ?? 30, { min: 0, max: 1500, step: 5, unit: 'min' })}</label>
      <label class="field"><span>Average daily steps <span class="hint">From your phone or watch. Leave blank if unsure.</span></span>${num('baselineSteps', draft.baselineSteps ?? '', { min: 0, max: 40000, step: 100, required: false, placeholder: 'e.g. 4000' })}</label>
    </div>
    <fieldset><legend>Cardio you’d enjoy (or tolerate)</legend>${chips('cardioPrefs', Object.fromEntries(Object.entries(CARDIO).map(([k, c]) => [k, c.label])), draft.cardioPrefs || ['walk'])}</fieldset>
    <p class="muted" style="font-size:.88rem">Already walk with friends, play a sport or dance? You can add those on the Move page — they count toward your week, so the app plans less on top.</p>
    ${nav()}
  </form>`;
}

function habitsStep() {
  const profile = { struggles: draft.struggles || [] };
  const suggested = suggestNext([], profile).slice(0, 4);
  const picked = draft.habitPicks || suggested.slice(0, 2);
  return html`<header class="page-head" style="margin-bottom:6px"><div><div class="eyebrow">Step ${draft.step} of 6</div><h1>Your first habits</h1></div></header><p class="muted">Habits take around 2 months to feel automatic (anywhere from 3 weeks to 8 months). Starting with one or two small ones works better than changing everything at once.</p>
  <form data-form="step" class="card">
    <fieldset><legend>What tends to get in the way?</legend>${chips('struggles', STRUGGLES, draft.struggles || [])}
      <div style="margin-top:8px"><button type="button" class="btn small" data-action="refreshHabits">Update suggestions</button></div></fieldset>
    <fieldset><legend>Pick 1–2 to start <span class="hint">Each is tied to something you already do, as an “After I…, I will…” plan.</span></legend><div class="options">
      ${[...new Set([...picked, ...suggested])].slice(0, 6).map((id) => {
        const h = HABITS.find((x) => x.id === id);
        return `<label class="option"><input type="checkbox" name="habitPicks" value="${id}" ${picked.includes(id) ? 'checked' : ''}><div><strong>${esc(h.title)}</strong><small class="muted">${esc(h.cue)} → ${esc(h.title.toLowerCase())}. ${esc(h.why)}</small></div></label>`;
      })}
    </div></fieldset>
    ${nav()}
  </form>`;
}

function planStep() {
  const p = profileFromDraft();
  const s = screen(p);
  const u = draft.units;
  const habitsOnly = s.blocked || (draft.edFlags || []).length > 0;
  const paceCards = Object.entries(PACES).map(([k, pace]) => {
    const t = dailyTargets({ ...p, pace: k });
    const weeks = p.goalWeightKg ? projectWeeks({ ...p, pace: k }, p.goalWeightKg) : null;
    return `<label class="option"><input type="radio" name="pace" value="${k}" ${(draft.pace || 'steady') === k ? 'checked' : ''}><div><div class="row between"><strong>${pace.label}</strong><strong>${t.kcal.toLocaleString()} kcal/day</strong></div>
      <small class="muted">${pace.hint} ≈ ${fmtWeight(t.expectedWeeklyLossKg, u, 2)}/week to start${weeks ? `; goal in roughly ${weeks} weeks${weeks > 52 ? ` (${(weeks / 52).toFixed(1)} years)` : ''}` : ''}.${t.hitFloor ? ' Held at the safe minimum.' : ''}</small></div></label>`;
  });
  const t = dailyTargets({ ...p, pace: draft.pace || 'steady' });
  return html`<header class="page-head" style="margin-bottom:6px"><div><div class="eyebrow">Step ${draft.step} of 6</div><h1>Your plan</h1></div></header>
  ${s.flags.map((f) => `<div class="notice ${f.level === 'block' ? 'block' : f.level === 'warn' ? 'warn' : 'info'}">${icon(f.level === 'info' ? 'info' : 'alert')}<div>${esc(f.text)}</div></div>`)}
  ${(draft.edFlags || []).length && !s.blocked ? `<div class="notice block">${icon('alert')}<div>Some of your answers suggest calorie counting may not be helpful right now. The app will hide calorie numbers and focus on regular meals, movement and wellbeing habits. Please consider talking to your doctor, or an eating-disorder charity such as Beat (UK) or ANAD (US).</div></div>` : ''}
  <form data-form="step" class="card">
    ${habitsOnly ? `<p>You’ll get balanced, regular meals, gentle movement and habit tracking — without calorie targets.</p><input type="hidden" name="pace" value="steady">` : `
    <fieldset><legend>Choose your pace</legend><div class="options">${paceCards}</div></fieldset>
    <div class="stats">
      <div class="stat"><span class="v">${t.rmr.toLocaleString()}</span><span class="l">resting energy (kcal)</span></div>
      <div class="stat"><span class="v">${t.tdee.toLocaleString()}</span><span class="l">estimated daily needs</span></div>
      <div class="stat"><span class="v">${t.proteinG} g</span><span class="l">protein target</span></div>
      <div class="stat"><span class="v">${t.fiberG} g</span><span class="l">fibre target</span></div>
    </div>
    <p class="muted" style="margin-top:12px">These are starting estimates (equations can be off by ±10% for any one person). After a few weeks of weigh-ins and meal ticks, your weekly check-in learns your real needs and adjusts.</p>`}
    ${nav(true)}
  </form>`;
}

function profileFromDraft() {
  return {
    units: draft.units,
    sex: draft.sex,
    age: Number(draft.age),
    heightCm: draft.heightCm,
    weightKg: draft.weightKg,
    goalWeightKg: draft.goalWeightKg || null,
    activity: draft.activity || 'sedentary',
    pace: draft.pace || 'steady',
    phase: 'lose',
    medical: draft.medical || [],
    limitations: draft.limitations || [],
    experience: draft.experience || 'none',
    equipment: draft.equipment || [],
    daysAvailable: (draft.daysAvailable || [0, 2, 4]).map(Number),
    sessionMinutes: Number(draft.sessionMinutes || 30),
    baselineCardioMin: Number(draft.baselineCardioMin || 0),
    baselineSteps: draft.baselineSteps ? Number(draft.baselineSteps) : null,
    cardioPrefs: draft.cardioPrefs?.length ? draft.cardioPrefs : ['walk'],
    struggles: draft.struggles || [],
  };
}

function absorb(data) {
  const u = draft.units;
  if ('age' in data) {
    draft.sex = data.sex;
    draft.age = Number(data.age);
    draft.heightCm = u === 'imperial' ? heightFromFtIn(data.heightFt, data.heightIn) : Number(data.heightCm);
    draft.weightKg = toKg(Number(data.weight), u);
    draft.goalWeightKg = data.goal ? toKg(Number(data.goal), u) : null;
    draft.activity = data.activity;
  }
  for (const k of ['medical', 'edFlags', 'limitations', 'allergies', 'dislikes', 'equipment', 'daysAvailable', 'cardioPrefs', 'struggles', 'habitPicks']) if (k in data) draft[k] = data[k];
  for (const k of ['diet', 'mealsPerDay', 'maxMinutesWeekday', 'budget', 'variety', 'experience', 'sessionMinutes', 'baselineCardioMin', 'baselineSteps', 'pace']) if (k in data) draft[k] = data[k];
  if (draft.step === 3) draft.noCookLunch = !!data.noCookLunch;
}

function validate() {
  if (draft.step === 1) {
    if (!draft.sex) return 'Please choose the sex used for the energy equation.';
    if (!(draft.heightCm > 100 && draft.heightCm < 250)) return 'Please check your height.';
    if (!(draft.weightKg > 30)) return 'Please check your weight.';
    if (draft.goalWeightKg) {
      const minGoal = weightAtBmi(18.5, draft.heightCm);
      if (draft.goalWeightKg < minGoal) {
        draft.goalWeightKg = Math.ceil(minGoal);
        return `That goal is below a healthy weight for your height. It has been set to ${fmtWeight(draft.goalWeightKg, draft.units)} — the lowest healthy weight — but you can choose a higher one.`;
      }
      if (draft.goalWeightKg >= draft.weightKg) draft.goalWeightKg = null;
    }
  }
  if (draft.step === 4 && !(draft.daysAvailable || []).length) return 'Pick at least one day — even 10 minutes counts.';
  if (draft.step === 5 && (draft.habitPicks || []).length > 3) return 'Pick at most 3 — fewer is better to start.';
  return null;
}

function finish(ctx) {
  const today = isoDate();
  const p = profileFromDraft();
  const s = screen(p);
  const profile = { ...p, startDate: today, startWeightKg: p.weightKg, habitsOnly: s.blocked || (draft.edFlags || []).length > 0, edFlags: draft.edFlags || [] };
  const state = emptyState();
  state.profile = profile;
  state.prefs = {
    ...state.prefs,
    diet: draft.diet || 'omnivore',
    allergies: draft.allergies || [],
    dislikes: draft.dislikes || [],
    mealsPerDay: draft.mealsPerDay ? Number(draft.mealsPerDay) : null,
    maxMinutesWeekday: Number(draft.maxMinutesWeekday || 30),
    maxMinutesWeekend: Math.max(45, Number(draft.maxMinutesWeekday || 30)),
    budget: draft.budget || 'normal',
    variety: draft.variety || 'medium',
    noCookLunch: !!draft.noCookLunch,
  };
  state.weights = [{ date: today, kg: round(p.weightKg, 0.01) }];
  state.calcWeightKg = p.weightKg;
  let picks = draft.habitPicks || [];
  if (profile.habitsOnly) picks = picks.filter((id) => id !== 'weigh_daily' && id !== 'log_meals');
  state.habits.active = picks.slice(0, 3).map((id) => ({ id, cue: HABITS.find((h) => h.id === id).cue, started: today, automaticity: null }));
  draft = { step: 0, units: 'metric' };
  ctx.set(state, { render: false });
  ctx.toast('Your plan is ready. Welcome to Habit Lab!');
  ctx.go('#/today');
}

export default {
  render() {
    const body = [welcome, about, health, food, movement, habitsStep, planStep][draft.step]();
    return `<div style="max-width:640px;margin:0 auto">${draft.step ? stepper() : ''}${body}<p class="footer-note">Habit Lab gives general information based on published guidelines. It isn’t a substitute for advice from your doctor.</p></div>`;
  },
  actions: {
    demo(el, ev, ctx) {
      ctx.set(demoState(), { render: false });
      ctx.toast('Demo loaded: 10 weeks of sample data. Reset it any time in Settings.');
      ctx.go('#/today');
    },
    next(el, ev, ctx) {
      draft.step = 1;
      ctx.rerender();
    },
    back(el, ev, ctx) {
      draft.step = Math.max(0, draft.step - 1);
      ctx.rerender();
    },
    units(el, ev, ctx) {
      const form = el.closest('form');
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.age !== undefined) {
        const tmp = { ...data };
        try {
          absorb({ ...tmp, sex: tmp.sex, activity: tmp.activity || draft.activity });
        } catch (e) {
          /* partial form */
        }
        if (!Number.isFinite(draft.heightCm)) draft.heightCm = null;
        if (!Number.isFinite(draft.weightKg) || !draft.weightKg) draft.weightKg = null;
      }
      draft.units = el.dataset.value;
      ctx.rerender();
    },
    refreshHabits(el, ev, ctx) {
      const form = el.closest('form');
      draft.struggles = new FormData(form).getAll('struggles');
      draft.habitPicks = null;
      ctx.rerender();
    },
    step(form, ev, ctx, data) {
      absorb(data);
      const err = validate();
      if (err) {
        ctx.toast(err);
        if (!err.startsWith('That goal')) return;
      }
      if (draft.step === 6) return finish(ctx);
      draft.step++;
      ctx.rerender();
    },
    importFile(el, ev, ctx) {
      const file = el.files?.[0];
      if (!file) return;
      file.text().then((text) => {
        try {
          ctx.set(importJson(text), { render: false, quiet: true });
          ctx.toast('Backup imported.');
          ctx.go('#/today');
        } catch (e) {
          ctx.toast(e.message || 'Couldn’t read that file.');
        }
      });
    },
  },
};
