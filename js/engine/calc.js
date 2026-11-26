// Energy and macro targets.
// Every number here is traced to the evidence brief (RESEARCH.md, "Design rules for the app").
import { clamp, round } from './util.js';

// Physical activity level (PAL = TDEE / RMR), mapped from FAO/WHO/UNU 2004 categories (rule 2).
export const ACTIVITY_LEVELS = {
  sedentary: { factor: 1.4, label: 'Mostly sitting', hint: 'Desk job, little walking, under ~5,000 steps/day' },
  light: { factor: 1.55, label: 'Lightly active', hint: 'Some walking most days, ~5,000–7,500 steps/day' },
  moderate: { factor: 1.7, label: 'Active', hint: 'On your feet a lot, or exercise 3–5 days a week' },
  active: { factor: 1.85, label: 'Very active', hint: 'Physical job or hard training most days' },
};

// Daily deficit options (rule 3: AHA/ACC/TOS 500 or 750 kcal/day).
export const PACES = {
  gentle: { deficit: 350, label: 'Gentle', hint: 'Smallest change. Good if you have a lot on, or are over 65.' },
  steady: { deficit: 500, label: 'Steady (recommended)', hint: 'The standard guideline deficit: about 0.5 kg / 1 lb a week at first.' },
  brisk: { deficit: 750, label: 'Brisk', hint: 'The upper guideline option. Only if it feels manageable.' },
};

export const KCAL_PER_KG = 7700; // mixed-tissue energy density used for trend maths [derived from Hall 2011]
export const MAX_WEEKLY_LOSS_PCT = 1.0; // rule 3/8: ≤1% of body weight per week
export const MAX_WEEKLY_LOSS_KG = 1.0;
export const KCAL_FLOOR = { female: 1200, male: 1500 }; // rule 4
export const PROTEIN_G_PER_KG = 1.4; // rule 9: 1.2–1.6 g/kg of reference weight; aim mid-range
export const PROTEIN_MIN_G_PER_KG = 1.2;

/** Mifflin–St Jeor resting energy expenditure (kcal/day). */
export function mifflinStJeor({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(b) {
  if (b < 18.5) return 'Underweight';
  if (b < 25) return 'Healthy weight range';
  if (b < 30) return 'Overweight';
  if (b < 35) return 'Obesity class 1';
  if (b < 40) return 'Obesity class 2';
  return 'Obesity class 3';
}

/** Weight at a given BMI for this height. */
export function weightAtBmi(b, heightCm) {
  const m = heightCm / 100;
  return b * m * m;
}

/**
 * Reference weight for protein (rule 9, Weijs 2025): body weight capped at BMI 30,
 * because extra fat mass adds little to protein needs.
 */
export function proteinReferenceWeight(weightKg, heightCm) {
  return Math.min(weightKg, weightAtBmi(30, heightCm));
}

export function estimateTdee(profile, weightKg = profile.weightKg) {
  const rmr = mifflinStJeor({ ...profile, weightKg });
  const factor = ACTIVITY_LEVELS[profile.activity]?.factor ?? 1.2;
  return { rmr, tdee: rmr * factor, factor };
}

/**
 * Full daily target set.
 * @param profile {sex, age, heightCm, weightKg, activity, pace, phase}
 * @param opts {weightKg: trend weight, kcalAdjust: cumulative check-in nudges, tdeeOffset: learned
 *              correction (observed − formula TDEE), dietBreak: true during a planned maintenance week}
 */
export function dailyTargets(profile, opts = {}) {
  const weightKg = opts.weightKg ?? profile.weightKg;
  const { rmr, tdee: formulaTdee } = estimateTdee(profile, weightKg);
  const tdee = formulaTdee + (opts.tdeeOffset || 0);
  const floor = KCAL_FLOOR[profile.sex] ?? 1200;
  const maintenance = profile.phase === 'maintain' || !!opts.dietBreak;

  let deficit = 0;
  if (!maintenance) {
    deficit = PACES[profile.pace]?.deficit ?? 500;
    // Keep the projected rate within ≤1% body weight and ≤1 kg per week.
    const maxKgWeek = Math.min((weightKg * MAX_WEEKLY_LOSS_PCT) / 100, MAX_WEEKLY_LOSS_KG);
    deficit = Math.min(deficit, (maxKgWeek * KCAL_PER_KG) / 7);
  }

  let kcal = tdee - deficit + (opts.dietBreak ? 0 : opts.kcalAdjust || 0);
  const hitFloor = kcal < floor;
  kcal = round(Math.max(kcal, floor), 10);

  const refWeight = proteinReferenceWeight(weightKg, profile.heightCm);
  const perKg = profile.medical?.includes('kidney') ? 0.8 : PROTEIN_G_PER_KG;
  const proteinG = round(clamp(refWeight * perKg, 50, 220), 5);
  const proteinMinG = round(refWeight * Math.min(perKg, PROTEIN_MIN_G_PER_KG), 5);
  const fatG = round(Math.max((kcal * 0.28) / 9, 40), 5);
  const carbsG = round(Math.max((kcal - proteinG * 4 - fatG * 9) / 4, 80), 5);
  const fiberG = round(clamp((kcal / 1000) * 14, 25, 38), 1); // rule 10: ≥25 g, stretch ~30 g

  return {
    kcal,
    proteinG,
    proteinMinG,
    fatG,
    carbsG,
    fiberG,
    rmr: round(rmr),
    tdee: round(tdee),
    formulaTdee: round(formulaTdee),
    tdeeSource: opts.tdeeOffset ? 'learned' : 'formula',
    deficit: round(tdee - kcal),
    floor,
    hitFloor,
    maintenance,
    expectedWeeklyLossKg: maintenance ? 0 : Math.max(0, ((tdee - kcal) * 7) / KCAL_PER_KG),
    waterL: round(clamp(weightKg * 0.03, 2, 3.5), 0.1),
  };
}

/** Health milestones (rule 19). */
export const MILESTONE_INFO = {
  5: 'A 5% loss already improves blood sugar, blood pressure and blood fats.',
  7: 'A 7% loss was the Diabetes Prevention Program goal — it cut new cases of type 2 diabetes by 58%.',
  10: 'At 10%, the health benefits get larger still: blood sugar, blood pressure, sleep apnoea and joint load.',
  15: '15%+ brings the biggest improvements, including remission of type 2 diabetes for many people.',
};
export function milestones(startKg) {
  return [5, 7, 10, 15].map((pct) => ({ pct, weightKg: startKg * (1 - pct / 100), info: MILESTONE_INFO[pct] }));
}

/**
 * Week-by-week weight projection towards a goal: weights[0] = today, weights[n] = after n weeks.
 * Uses the plan's deficit but lets energy needs fall as weight drops (Hall 2011), with targets
 * recalculated every 2 kg (rule 7) — so the curve slows down, as real weight loss does.
 * `reached` is false if the plan would plateau first or it would take longer than 15 years.
 */
export function projectCurve(profile, goalKg, maxWeeks = 780) {
  let w = profile.weightKg;
  const weights = [w];
  if (!(goalKg < w)) return { weights, reached: true };
  let t = dailyTargets(profile, { weightKg: w });
  let lastCalc = w;
  while (w > goalKg && weights.length <= maxWeeks) {
    if (lastCalc - w >= 2) {
      t = dailyTargets(profile, { weightKg: w });
      lastCalc = w;
    }
    const { tdee } = estimateTdee(profile, w);
    const deficit = Math.max(0, tdee - t.kcal);
    if (deficit < 50) return { weights, reached: false }; // the plan alone would plateau before the goal
    w = Math.max(goalKg, w - (deficit * 7) / KCAL_PER_KG);
    weights.push(w);
  }
  return { weights, reached: w <= goalKg };
}

/** Weeks to goal (0 if already there, null if the plan would plateau or take over 15 years). */
export function projectWeeks(profile, goalKg) {
  const c = projectCurve(profile, goalKg);
  return c.reached ? c.weights.length - 1 : null;
}
