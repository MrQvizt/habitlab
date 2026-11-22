// Habit library. Each habit is small, specific and has a suggested cue (implementation intention:
// "After I [cue], I will [behaviour]"). `tiny` is the version to fall back on during a hard day.
// `ev` points to an evidence card id in learn.js.

const H = (id, cat, title, tiny, cue, why, ev, extra = {}) => ({ id, cat, title, tiny, cue, why, ev, ...extra });

export const HABIT_CATEGORIES = {
  monitor: 'Self-monitoring',
  food: 'Eating',
  move: 'Movement',
  sleep: 'Sleep & stress',
  env: 'Environment',
  mind: 'Mindset',
};

export const HABITS = [
  H('weigh_daily', 'monitor', 'Weigh yourself each morning', 'Step on the scale and log the number — no judgement', 'After I use the bathroom in the morning', 'Daily weighing — looking at the trend, not single days — is linked with more weight loss.', 'self_monitoring', { starter: true }),
  H('log_meals', 'monitor', 'Tick off meals in the app', 'Log just one meal', 'After I finish eating', 'Food self-monitoring is the behaviour most consistently linked with weight loss in lifestyle programmes.', 'self_monitoring', { starter: true }),
  H('protein_first', 'food', 'Start each meal with the protein and veg', 'Eat a few bites of protein first', 'When I sit down to eat', 'Protein and fibre are the most filling parts of a meal and help preserve muscle while losing weight.', 'protein'),
  H('veg_half', 'food', 'Fill half your plate with vegetables', 'Add one handful of veg to one meal', 'When I plate up dinner', 'Low-energy-density foods let you eat satisfying volumes for fewer calories.', 'energy_density', { starter: true }),
  H('water_meals', 'food', 'Drink water instead of sugary drinks', 'Swap one sugary drink for water or a zero-calorie drink', 'When I feel like a soda or juice', 'Each daily sugary drink is linked with extra weight gain each year; liquid calories don’t fill you up.', 'liquid_calories', { starter: true }),
  H('plate_not_package', 'food', 'Eat from a plate, not the package', 'Put snacks in a bowl before eating', 'When I open a snack', 'Changing cues around you (stimulus control) is a core part of effective programmes.', 'stimulus_control'),
  H('slow_down', 'food', 'Put your fork down between bites', 'Take one pause halfway through the meal', 'When I start a meal', 'Slowing down gives you a moment to notice fullness and choose deliberately.', 'mindful_eating'),
  H('kitchen_closed', 'food', 'Close the kitchen after dinner', 'Brush teeth right after dinner', 'After I finish washing up', 'A clear “kitchen closed” cue makes evening grazing a decision rather than a habit.', 'stimulus_control'),
  H('planned_treat', 'food', 'Plan your treats', 'Decide one treat ahead of time and enjoy it seated', 'When I plan tomorrow’s meals', 'Planning treats keeps you in charge and stops one slip turning into “I’ve blown it”.', 'flexible_restraint'),
  H('breakfast_protein', 'food', 'Have 25 g+ protein at breakfast', 'Add a yogurt or egg to breakfast', 'When I make breakfast', 'Spreading protein across meals helps with fullness and muscle maintenance.', 'protein'),
  H('alcohol_limit', 'food', 'Keep alcohol to planned days', 'Alternate each drink with a glass of water', 'When I am offered a drink', 'Alcohol adds calories and loosens food choices; limiting it helps both weight and health.', 'alcohol'),
  H('walk_after_meal', 'move', '10-minute walk after a meal', 'Walk for 2 minutes after one meal', 'After I finish lunch', 'Short walks add up toward your weekly minutes and build the movement habit.', 'activity', { starter: true }),
  H('step_goal', 'move', 'Hit your daily step goal', 'Take one extra short walk', 'When I check my phone at 6 pm', 'Raising steps gradually adds activity without needing gym time.', 'activity'),
  H('stand_breaks', 'move', 'Stand up every hour', 'Stand and stretch once this afternoon', 'When a meeting or TV episode ends', 'Everyday movement (NEAT) differs hugely between people and is an easy place to add activity.', 'activity'),
  H('strength_sessions', 'move', 'Do your planned strength session', 'Do one set of each exercise', 'When I get home from work on session days', 'Resistance training helps keep muscle while losing weight.', 'strength'),
  H('clothes_ready', 'move', 'Lay out workout clothes the night before', 'Put your walking shoes by the door', 'After I brush my teeth at night', 'Reducing friction makes the planned behaviour the easy default.', 'stimulus_control'),
  H('sleep_window', 'sleep', 'Aim for 7+ hours in bed asleep', 'Start your bedtime routine 15 minutes earlier', 'When my phone’s wind-down alarm goes off', 'In a trial, people who slept about an hour longer ate ~270 kcal a day less without trying.', 'sleep', { starter: true }),
  H('screens_off', 'sleep', 'Screens off 30 minutes before bed', 'Put the phone on charge outside the bedroom', 'When I start my bedtime routine', 'Supports earlier, better-quality sleep.', 'sleep'),
  H('stress_reset', 'sleep', 'Two-minute stress reset', 'Three slow breaths (in 4, out 6)', 'When I notice I want to eat but am not hungry', 'Stress and emotional eating are common triggers; a short alternative response breaks the loop.', 'stress'),
  H('hunger_check', 'mind', 'Hunger check before eating', 'Rate hunger 1–10 before one snack', 'Before I open the fridge or cupboard', 'Distinguishing physical hunger from cravings or boredom helps you choose deliberately.', 'mindful_eating'),
  H('shopping_list', 'env', 'Shop from your list', 'Bring the app’s list once this week', 'Before I leave for the shop', 'What is in the house is what gets eaten. Planning shopping supports planned eating.', 'stimulus_control'),
  H('fruit_visible', 'env', 'Keep fruit on the counter, treats out of sight', 'Move one treat to a high cupboard', 'When I unpack groceries', 'Visibility and convenience shape what we eat more than willpower does.', 'stimulus_control'),
  H('batch_cook', 'env', 'Batch-cook twice a week', 'Cook a double portion of tonight’s dinner', 'On Sunday afternoon and Wednesday evening', 'Having planned food ready removes the decision at the moment you are tired and hungry.', 'planning'),
  H('self_compassion', 'mind', 'Treat slips like a friend would', 'Write one kind sentence to yourself after a slip', 'When I notice I went off plan', 'Self-compassion after a lapse reduces the “what-the-hell” effect that turns a slip into a relapse.', 'self_compassion'),
  H('weekly_review', 'mind', 'Do the weekly check-in', 'Open the check-in and answer one question', 'On Sunday evening after dinner', 'Reviewing progress and problem-solving barriers are core parts of successful programmes.', 'problem_solving', { starter: true }),
];

/** Short self-report automaticity index (adapted from the 4-item SRBAI). Each answered 1–5. */
export const AUTOMATICITY_ITEMS = [
  'I do it automatically',
  'I do it without having to consciously remember',
  'I do it without thinking',
  'I start doing it before I realise I’m doing it',
];
