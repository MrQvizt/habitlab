// If-then plans, approach-framed ("I'll do X") — plans that say what to do work better than
// plans to avoid something. Each situation offers three; you pick one or write your own.
export const SITUATIONS = {
  out: { emoji: '🍽️', label: 'Eating out', plans: ['If I eat out, I’ll choose a dish with protein and vegetables', 'If I eat out, I’ll start with a salad or soup and a glass of water', 'If the portion is big, I’ll ask for a box and take half home'] },
  late: { emoji: '🌙', label: 'Long or late day', plans: ['If I work late, I’ll eat my planned snack mid-afternoon', 'If I get home late, I’ll heat a meal from the freezer', 'If I’m hungry on the way home, I’ll have fruit or yogurt'] },
  social: { emoji: '🎉', label: 'Party or social', plans: ['If there’s food out, I’ll fill one small plate, then move away from the table', 'If I drink, I’ll have a glass of water between each drink', 'If someone offers seconds, I’ll say “I’m full, it was lovely”'] },
  travel: { emoji: '🧳', label: 'Travelling', plans: ['If I travel, I’ll pack water and a protein snack', 'If I buy food on the way, I’ll pick something with protein and salad', 'If I have to wait, I’ll walk around instead of sitting'] },
  stress: { emoji: '😮‍💨', label: 'Stressful day', plans: ['If I feel stressed, I’ll walk for five minutes before deciding to eat', 'If a craving hits, I’ll open Craving help and ride it out', 'If it’s a hard day, I’ll do the small version of my habit'] },
  tired: { emoji: '😴', label: 'Tired or short on sleep', plans: ['If I’m tired, I’ll go to bed 30 minutes earlier tonight', 'If I’m too tired to train, I’ll take a 10-minute walk instead', 'If I’m tired, I’ll keep my meals simple and on plan'] },
  none: { emoji: '✨', label: 'Nothing special', plans: ['After dinner, I’ll brush my teeth and make a cup of tea', 'When I get home, I’ll put my shoes on for a 10-minute walk', 'Before lunch, I’ll drink a glass of water'] },
};
