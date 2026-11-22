// Safety screen. This app is general education and self-management support, not medical care.
// Some situations need a clinician to set targets; the app then switches to "habits only" mode.
import { bmi } from './calc.js';

export function screen(profile) {
  const flags = [];
  const b = bmi(profile.weightKg, profile.heightCm);
  if (profile.age < 18) flags.push({ level: 'block', text: 'This planner is for adults. Children and teens need growth-appropriate advice — please talk to a paediatrician or registered dietitian.' });
  if (profile.medical?.includes('pregnant')) flags.push({ level: 'block', text: 'During pregnancy or breastfeeding, calorie restriction should only be done with your midwife or doctor. The app will show habits and activity ideas, not a calorie deficit.' });
  if (profile.medical?.includes('eating_disorder')) flags.push({ level: 'block', text: 'With a current or past eating disorder, calorie targets and daily weighing can be harmful. Please work with your care team. The app will hide calorie numbers and focus on regular meals and wellbeing habits.' });
  if (b < 18.5) flags.push({ level: 'block', text: 'Your BMI is below 18.5. Weight loss is not recommended — please speak to a doctor.' });
  else if (b < 23 && profile.phase !== 'maintain') flags.push({ level: 'warn', text: 'Your BMI is already in the healthy range. Consider a maintenance or fitness goal rather than further loss.' });
  if (profile.medical?.includes('diabetes_meds')) flags.push({ level: 'warn', text: 'If you take insulin or sulfonylureas (e.g. gliclazide, glipizide), eating less and moving more can cause low blood sugar. Talk to your doctor before starting — doses often need adjusting.' });
  if (profile.medical?.includes('heart')) flags.push({ level: 'warn', text: 'With heart disease, chest pain, fainting or uncontrolled blood pressure, get medical clearance before starting new exercise. Start with the lowest levels and stop if you feel chest pain, dizziness or unusual breathlessness.' });
  if (profile.medical?.includes('glp1')) flags.push({ level: 'info', text: 'On GLP-1 or other weight-loss medicines, appetite may be very low. Prioritise protein and strength training to protect muscle, and don’t go below the calorie floor without your prescriber’s advice.' });
  if (profile.medical?.includes('kidney')) flags.push({ level: 'warn', text: 'With kidney disease, protein targets need to be set by your doctor or dietitian. Treat the protein number as a maximum, not a goal, until you check.' });
  if (profile.age >= 65) flags.push({ level: 'info', text: 'Over 65, protecting muscle and bone matters most: keep protein high, do the strength sessions, and aim for a gentle pace of loss.' });
  if (b >= 40) flags.push({ level: 'info', text: 'At a BMI of 40+, a doctor can offer more support — including specialist programmes, medicines or surgery — alongside these habits. Ask about it at your next appointment.' });
  const blocked = flags.some((f) => f.level === 'block');
  return { flags, blocked, bmi: b };
}

/** Red-flag symptoms the app always shows near workouts. */
export const STOP_SIGNS = [
  'Chest pain, pressure or tightness',
  'Feeling faint, dizzy or confused',
  'Breathlessness that doesn’t settle with rest',
  'Sharp joint pain (not muscle effort)',
];
