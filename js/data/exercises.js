// Exercise library organised as progression chains (easiest first).
// equip: none | bands | dumbbells | gym. avoid: joint issues for which the move is not offered.
// type 'reps' uses reps; 'time' uses seconds per set.

const X = (id, name, equip, how, extra = {}) => ({ id, name, equip, how, type: 'reps', avoid: [], perSide: false, ...extra });

export const CHAINS = {
  squat: {
    label: 'Legs: squat pattern',
    steps: [
      X('sit_to_stand', 'Chair sit-to-stand', 'none', 'Sit on a sturdy chair, feet hip-width. Lean forward slightly and stand up without using your hands if you can (hands on thighs is fine). Sit back down slowly.'),
      X('box_squat', 'Box squat to a low chair', 'none', 'Stand in front of a chair or bench. Push hips back and lightly tap the seat, then stand. Keep knees pointing over your toes.'),
      X('bw_squat', 'Bodyweight squat', 'none', 'Feet just wider than hips. Sit hips back and down as far as is comfortable, chest up, then drive up through your heels.'),
      X('goblet_squat', 'Goblet squat', 'dumbbells', 'Hold one dumbbell vertically against your chest. Squat down between your knees, elbows inside knees, then stand.'),
      X('leg_press', 'Leg press machine', 'gym', 'Feet hip-width on the platform. Lower until knees reach about 90°, then press without locking knees.'),
    ],
  },
  lunge: {
    label: 'Legs: single-leg',
    steps: [
      X('step_up_low', 'Low step-up', 'none', 'Use the bottom stair. Step up with one foot, bring the other to meet it, step down. Hold the rail.', { perSide: true }),
      X('split_squat_supported', 'Supported split squat', 'none', 'Stand in a long stride holding a chair or wall. Lower the back knee toward the floor, then rise.', { perSide: true, avoid: ['knee'] }),
      X('reverse_lunge', 'Reverse lunge', 'none', 'Step one foot back and lower until both knees are bent, then push back to standing.', { perSide: true, avoid: ['knee'] }),
      X('db_reverse_lunge', 'Dumbbell reverse lunge', 'dumbbells', 'As a reverse lunge, holding a dumbbell in each hand.', { perSide: true, avoid: ['knee'] }),
    ],
  },
  hinge: {
    label: 'Hips & back of legs',
    steps: [
      X('glute_bridge', 'Glute bridge', 'none', 'Lie on your back, knees bent, feet flat. Squeeze your glutes and lift hips until body is in a line from knees to shoulders. Lower slowly.'),
      X('bridge_march', 'Bridge with march', 'none', 'Hold a glute bridge and slowly lift one foot a few centimetres, then the other, keeping hips level.', { perSide: true }),
      X('band_pull_through', 'Band good-morning', 'bands', 'Stand on a band, loop over your neck/shoulders. Push hips back with a flat back, then stand tall squeezing glutes.', { avoid: ['back'] }),
      X('db_rdl', 'Dumbbell Romanian deadlift', 'dumbbells', 'Hold dumbbells in front of thighs. Soft knees, push hips back, slide weights down to mid-shin with a flat back, then stand.', { avoid: ['back'] }),
      X('db_hip_thrust', 'Dumbbell hip thrust', 'dumbbells', 'Upper back on a sofa or bench, dumbbell on hips. Drive hips up, pause, lower.'),
    ],
  },
  push: {
    label: 'Chest & arms: push',
    steps: [
      X('wall_pushup', 'Wall push-up', 'none', 'Hands on a wall at shoulder height, step back. Bend elbows to bring chest toward the wall, then press away. Body stays straight.'),
      X('counter_pushup', 'Kitchen-counter push-up', 'none', 'As a wall push-up, but with hands on a sturdy counter or table edge (lower angle = harder).'),
      X('incline_pushup', 'Low incline push-up', 'none', 'Hands on a sturdy chair seat, sofa arm or stair. Lower chest to the edge and press back up.', { avoid: ['shoulder'] }),
      X('pushup', 'Push-up', 'none', 'Hands under shoulders, body straight from head to heels (or knees). Lower chest toward the floor and press up.', { avoid: ['shoulder', 'wrist'] }),
      X('db_floor_press', 'Dumbbell floor press', 'dumbbells', 'Lie on your back, upper arms on the floor. Press dumbbells up over your chest and lower until elbows touch the floor.'),
      X('chest_press_machine', 'Chest press machine', 'gym', 'Adjust seat so handles are at mid-chest. Press forward, return slowly.'),
    ],
  },
  pull: {
    label: 'Back: pull',
    steps: [
      X('prone_ytw', 'Lying Y-T raise', 'none', 'Lie face down, arms overhead in a Y. Lift arms a few centimetres squeezing shoulder blades, then sweep to a T. Slow and controlled.', { avoid: ['shoulder'] }),
      X('towel_row', 'Isometric towel row', 'none', 'Loop a towel around a sturdy post or door handle (with the door locked open). Lean back slightly, pull elbows back and hold.', { type: 'time' }),
      X('band_row', 'Band row', 'bands', 'Anchor a band at chest height (or around your feet while seated). Pull elbows back, squeeze shoulder blades, return slowly.'),
      X('db_row', 'One-arm dumbbell row', 'dumbbells', 'One hand and knee on a bench or chair. Pull the dumbbell toward your hip, lower slowly.', { perSide: true }),
      X('lat_pulldown', 'Lat pulldown', 'gym', 'Grip the bar wider than shoulders. Pull to upper chest, leaning back slightly; return slowly.'),
      X('cable_row', 'Seated cable row', 'gym', 'Sit tall, pull the handle to your belly, squeeze shoulder blades, return slowly.'),
    ],
  },
  core: {
    label: 'Core',
    steps: [
      X('dead_bug', 'Dead bug', 'none', 'Lie on your back, arms up, knees bent at 90°. Press your lower back into the floor and slowly extend opposite arm and leg, then switch.', { perSide: true }),
      X('bird_dog', 'Bird dog', 'none', 'On hands and knees, extend opposite arm and leg until level with your body, pause, return. Keep hips square.', { perSide: true, avoid: ['wrist'] }),
      X('incline_plank', 'Incline plank', 'none', 'Forearms on a counter or sturdy table, walk feet back until body is straight. Hold, breathing normally.', { type: 'time' }),
      X('plank', 'Forearm plank (knees or toes)', 'none', 'Forearms on the floor, body straight from head to knees or heels. Hold.', { type: 'time', avoid: ['back'] }),
      X('side_plank', 'Side plank (knees)', 'none', 'Lie on your side, forearm under shoulder, knees bent. Lift hips into a straight line and hold.', { type: 'time', perSide: true, avoid: ['shoulder'] }),
    ],
  },
  carry: {
    label: 'Grip & posture',
    steps: [
      X('farmer_hold', 'Shopping-bag hold', 'none', 'Hold two full bags or water bottles at your sides, stand tall with shoulders back. Walk slowly if you can.', { type: 'time' }),
      X('suitcase_carry', 'Suitcase carry', 'dumbbells', 'Hold one heavy dumbbell at your side and walk tall without leaning. Switch hands.', { type: 'time', perSide: true }),
    ],
  },
};

export const CARDIO = {
  walk: { label: 'Brisk walking', joint: 'low', how: 'Walk at a pace where you can talk but not sing. Hills or a slight incline add challenge without impact.' },
  cycle: { label: 'Cycling / stationary bike', joint: 'very-low', how: 'Seat high enough that your knee is slightly bent at the bottom. Easy-to-moderate resistance.' },
  swim: { label: 'Swimming or water walking', joint: 'very-low', how: 'Water supports your weight — excellent if knees, hips or back are sore. Water walking counts.' },
  elliptical: { label: 'Elliptical / cross-trainer', joint: 'low', how: 'Smooth, no-impact. Keep an upright posture and light grip on the handles.' },
  seated: { label: 'Seated cardio (chair)', joint: 'very-low', how: 'Seated marching, arm punches and leg extensions to music. A great start if standing exercise is painful.' },
  dance: { label: 'Dance / follow-along video', joint: 'low', how: 'Any low-impact follow-along video. Choose “low impact” versions with no jumping.' },
};

export const WARMUP = [
  'March on the spot or walk around — 2 minutes',
  'Arm circles forward and back — 30 seconds',
  'Hip circles and gentle torso twists — 30 seconds',
  'Easy practice reps of the first exercise — 1 set of 5',
];

export const COOLDOWN = [
  'Slow walk — 2 minutes',
  'Calf stretch against a wall — 30 seconds each side',
  'Seated hamstring stretch — 30 seconds each side',
  'Chest stretch in a doorway — 30 seconds',
  'Three slow breaths: in for 4, out for 6',
];
