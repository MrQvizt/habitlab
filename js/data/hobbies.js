// Hobby catalogue for "activities you already do".
// MET values: 2024 Adult Compendium of Physical Activities (Herrmann et al., J Sport Health Sci 2024;
// https://pacompendium.com/adult-compendium/), code in brackets. Intensity follows the Compendium bands:
// light 1.6–2.9 METs → easy, moderate 3.0–5.9, vigorous ≥6.0. `est` marks activities with no
// Compendium entry, estimated from the closest similar activity. Minutes are typical session lengths.
// `strength`: commonly counts as muscle-strengthening activity.

const A = (name, cat, met, minutes, extra = {}) => ({ name, cat, met, minutes, strength: false, est: false, ...extra });

export const HOBBY_CATEGORIES = {
  outdoors: 'Outdoors & garden',
  water: 'Water',
  racket: 'Racket & ball',
  dance: 'Dance & mind-body',
  fitness: 'Fitness & combat',
  wheels: 'Wheels, snow & ice',
  everyday: 'Everyday life',
};

export const HOBBIES = [
  // Outdoors & garden
  A('Gardening', 'outdoors', 3.8, 45, { code: '08245' }),
  A('Heavy gardening / digging', 'outdoors', 7.3, 45, { code: '08052', strength: true }),
  A('Mowing the lawn', 'outdoors', 5.5, 30, { code: '08095' }),
  A('Walking with friends', 'outdoors', 3.5, 45, { est: true, note: 'Estimated from walking at an easy-moderate pace (~3 mph)' }),
  A('Dog walk', 'outdoors', 3.0, 30, { code: '17165' }),
  A('Nordic walking', 'outdoors', 5.3, 45, { code: '17304' }),
  A('Hiking', 'outdoors', 6.0, 90, { code: '17080' }),
  A('Fishing (standing)', 'outdoors', 3.5, 60, { code: '04040' }),
  A('Golf (walking, carrying clubs)', 'outdoors', 4.3, 120, { code: '15265' }),
  A('Horse riding', 'outdoors', 5.5, 60, { code: '15370' }),
  A('Frisbee', 'outdoors', 3.0, 30, { code: '15240' }),
  // Water
  A('Swimming (leisurely)', 'water', 6.0, 30, { code: '18310' }),
  A('Water aerobics', 'water', 5.5, 45, { code: '18355' }),
  A('Scuba diving', 'water', 7.0, 45, { code: '18200' }),
  A('Snorkelling', 'water', 5.0, 45, { code: '18210' }),
  A('Kayaking', 'water', 5.0, 60, { code: '18100' }),
  A('Canoeing / rowing for pleasure', 'water', 3.5, 60, { code: '18070' }),
  A('Stand-up paddleboarding', 'water', 6.5, 45, { code: '18224' }),
  A('Surfing', 'water', 3.0, 60, { code: '18220' }),
  A('Sailing', 'water', 3.3, 120, { code: '18140' }),
  // Racket & ball
  A('Squash', 'racket', 7.3, 45, { code: '15652' }),
  A('Tennis', 'racket', 6.8, 60, { code: '15675' }),
  A('Tennis (doubles)', 'racket', 4.5, 60, { code: '15685' }),
  A('Padel', 'racket', 6.0, 60, { est: true, note: 'No Compendium entry; estimated from paddleball and doubles tennis' }),
  A('Pickleball', 'racket', 4.5, 60, { est: true, note: 'No Compendium entry; estimated from doubles tennis and table tennis' }),
  A('Badminton', 'racket', 5.5, 45, { code: '15030' }),
  A('Racquetball', 'racket', 7.0, 45, { code: '15530' }),
  A('Table tennis', 'racket', 4.0, 45, { code: '15660' }),
  A('Football / soccer', 'racket', 7.0, 60, { code: '15610' }),
  A('Basketball', 'racket', 7.5, 45, { code: '15055' }),
  A('Volleyball', 'racket', 3.0, 60, { code: '15720' }),
  A('Bowling', 'racket', 3.0, 60, { code: '15090' }),
  // Dance & mind-body
  A('Social / contemporary dancing', 'dance', 3.8, 60, { code: '03070' }),
  A('Ballroom dancing', 'dance', 6.0, 60, { code: '03042' }),
  A('Zumba class', 'dance', 6.5, 45, { code: '02310' }),
  A('Low-impact aerobics', 'dance', 4.8, 45, { code: '02005' }),
  A('Yoga', 'dance', 2.3, 60, { code: '02150', strength: true }),
  A('Pilates', 'dance', 2.8, 45, { code: '02105', strength: true }),
  A('Tai chi / qi gong', 'dance', 3.3, 45, { code: '15670' }),
  // Fitness & combat
  A('Weights at the gym', 'fitness', 3.5, 45, { code: '02054', strength: true }),
  A('Circuit training class', 'fitness', 5.0, 45, { code: '02035', strength: true }),
  A('Spin class', 'fitness', 9.0, 45, { code: '01270' }),
  A('Jogging / running', 'fitness', 7.5, 30, { code: '12020' }),
  A('Boxing (bag work)', 'fitness', 5.8, 45, { code: '15110', strength: true }),
  A('Martial arts', 'fitness', 10.3, 60, { code: '15430', strength: true }),
  A('Climbing / bouldering', 'fitness', 8.8, 90, { code: '15534', strength: true }),
  // Wheels, snow & ice
  A('Cycling (leisure)', 'wheels', 4.0, 45, { code: '01010' }),
  A('Mountain biking', 'wheels', 8.5, 60, { code: '01009' }),
  A('Ice skating', 'wheels', 7.0, 45, { code: '19030' }),
  A('Downhill skiing / snowboarding', 'wheels', 6.3, 120, { code: '19160' }),
  A('Cross-country skiing', 'wheels', 8.5, 60, { code: '19090' }),
  // Everyday life
  A('House cleaning', 'everyday', 3.3, 30, { code: '05030' }),
  A('Playing with the kids', 'everyday', 3.5, 30, { code: '05175' }),
  A('DIY / home repair', 'everyday', 4.5, 60, { code: '06127' }),
];

/** Compendium intensity band → the app's intensity levels. */
export function intensityFromMet(met) {
  return met >= 6 ? 'vigorous' : met >= 3 ? 'moderate' : 'easy';
}

export function hobbyByName(name) {
  const n = String(name || '').trim().toLowerCase();
  return HOBBIES.find((h) => h.name.toLowerCase() === n) || null;
}
