// "Build it": meals you put together at a counter — a burrito or bowl, a sub, a burger meal, pizza
// slices, a salad bowl. Each part is a typical counter portion (rounded averages from published
// restaurant nutrition and food tables); real portions vary, and close enough is good enough.
// [id, name, kcal, protein g, carbs g, fat g, fibre g]
// `steps`: what tapping a part cycles through (1 = normal, 1.5 = extra, 2+ = how many).

const P = (id, name, kcal, p, c, f, fib = 0) => ({ id, name, kcal, p, c, f, fib });
const NORMAL = [0, 1, 1.5];
const COUNT = [0, 1, 2, 3, 4, 6, 8];

export const TEMPLATES = [
  {
    id: 'burrito', name: 'Burrito, bowl or tacos', emoji: '🌯', tags: 'burrito bowl taco tacos wrap mexican chipotle tex mex grill',
    groups: [
      { id: 'base', name: 'Base', one: true, parts: [P('tortilla', 'Burrito (large flour tortilla)', 320, 8, 50, 9, 3), P('bowl', 'Bowl', 0, 0, 0, 0), P('salad', 'Salad bowl', 5, 0, 1, 0, 1), P('soft_tacos', '3 soft tacos', 250, 6, 39, 7, 2), P('crispy_tacos', '3 crispy corn tacos', 200, 3, 27, 9, 3)] },
      { id: 'protein', name: 'Protein', parts: [P('chicken', 'Chicken', 180, 32, 0, 7), P('steak', 'Steak', 150, 21, 1, 6, 1), P('carnitas', 'Pulled pork', 210, 23, 0, 12), P('barbacoa', 'Shredded beef', 170, 24, 2, 7, 1), P('tofu', 'Spiced tofu', 150, 8, 9, 10, 3), P('fajita', 'Grilled veggies', 20, 1, 5, 0, 1)] },
      { id: 'rice', name: 'Rice', parts: [P('white_rice', 'White rice', 210, 4, 40, 4, 1), P('brown_rice', 'Brown rice', 210, 4, 36, 6, 2)] },
      { id: 'beans', name: 'Beans', parts: [P('black_beans', 'Black beans', 130, 8, 22, 1.5, 7), P('pinto', 'Pinto beans', 130, 8, 21, 1.5, 8)] },
      { id: 'salsa', name: 'Veg & salsa', parts: [P('lettuce', 'Lettuce', 5, 0, 1, 0, 1), P('tomato_salsa', 'Tomato salsa', 25, 0, 4, 0, 1), P('corn_salsa', 'Corn salsa', 80, 3, 16, 1.5, 3), P('green_salsa', 'Green chili salsa', 15, 0, 4, 0), P('red_salsa', 'Red chili salsa', 30, 0, 4, 0, 1)] },
      { id: 'extras', name: 'Extras', parts: [P('cheese', 'Cheese', 110, 6, 1, 8), P('sour_cream', 'Sour cream', 110, 2, 2, 9), P('guac', 'Guacamole', 230, 2, 8, 22, 6), P('queso', 'Queso (cheese sauce)', 120, 5, 4, 9)] },
      { id: 'sauce', name: 'Sauce', parts: [P('chipotle_sauce', 'Chipotle mayo sauce', 100, 0, 1, 11), P('hot_sauce', 'Hot sauce', 5, 0, 1, 0), P('ranch', 'Ranch', 140, 1, 1, 15), P('vinaigrette', 'Vinaigrette', 220, 0, 12, 18)] },
      { id: 'side', name: 'On the side', parts: [P('chips', 'Tortilla chips', 540, 7, 73, 25, 7), P('soda', 'Soda (regular)', 210, 0, 55, 0), P('diet_soda', 'Diet soda', 0, 0, 0, 0)] },
    ],
  },
  {
    id: 'sub', name: 'Sandwich or sub', emoji: '🥪', tags: 'sandwich sub subway baguette wrap roll toastie panini deli',
    groups: [
      { id: 'bread', name: 'Bread', one: true, parts: [P('sub6', '6-inch sub roll', 200, 8, 38, 2, 2), P('sub12', 'Footlong sub roll', 400, 16, 76, 4, 4), P('wrap', 'Wrap', 300, 8, 50, 7, 2), P('baguette', 'Half baguette', 350, 12, 70, 2, 3), P('slices', '2 slices of bread', 160, 6, 30, 2, 3), P('crisp', '2 crispbreads', 70, 2, 14, 0, 4)] },
      { id: 'filling', name: 'Filling', parts: [P('ham', 'Ham', 60, 9, 1, 2), P('turkey', 'Turkey', 60, 10, 1, 1), P('chicken', 'Chicken', 120, 20, 1, 3), P('tuna_mayo', 'Tuna mayo', 200, 12, 0, 16), P('meatballs', 'Meatballs in sauce', 280, 14, 14, 18, 2), P('egg_mayo', 'Egg mayo', 180, 7, 1, 16), P('falafel', 'Falafel', 250, 8, 24, 14, 6), P('bacon', 'Bacon', 130, 9, 0, 10), P('salami', 'Salami', 120, 6, 0, 10)] },
      { id: 'cheese', name: 'Cheese', parts: [P('cheese', 'Cheese slice', 80, 5, 0, 6), P('mozzarella', 'Mozzarella', 90, 6, 1, 7)] },
      { id: 'veg', name: 'Veg', parts: [P('salad', 'Salad & veg', 15, 1, 3, 0, 1), P('avocado', 'Avocado', 80, 1, 4, 7, 3)] },
      { id: 'sauce', name: 'Sauce', parts: [P('mayo', 'Mayo', 100, 0, 0, 11), P('light_mayo', 'Light mayo', 50, 0, 1, 5), P('mustard', 'Mustard', 5, 0, 0, 0), P('sweet_onion', 'Sweet onion sauce', 40, 0, 9, 0), P('chipotle_sauce', 'Chipotle sauce', 90, 0, 1, 10), P('pesto', 'Pesto', 80, 1, 1, 8), P('butter', 'Butter', 70, 0, 0, 8)] },
      { id: 'side', name: 'On the side', parts: [P('crisps', 'Bag of crisps', 160, 2, 15, 10, 1), P('cookie', 'Cookie', 220, 2, 30, 10, 1), P('soda', 'Soda (regular)', 210, 0, 55, 0), P('diet_soda', 'Diet soda', 0, 0, 0, 0)] },
    ],
  },
  {
    id: 'burger', name: 'Burger meal', emoji: '🍔', tags: 'burger hamburger cheeseburger mcdonalds burger king max fries meal',
    groups: [
      { id: 'bun', name: 'Bun', one: true, parts: [P('bun', 'Burger bun', 150, 5, 27, 2, 1), P('brioche', 'Brioche bun', 200, 6, 32, 6, 1), P('lettuce_wrap', 'Lettuce wrap', 5, 0, 1, 0, 1)] },
      { id: 'patty', name: 'Patty', parts: [P('beef', 'Beef patty', 250, 20, 0, 18), P('double', 'Double beef', 500, 40, 0, 36), P('crispy_chicken', 'Crispy chicken', 300, 20, 20, 15, 1), P('grilled_chicken', 'Grilled chicken', 160, 28, 0, 5), P('veggie', 'Veggie patty', 200, 10, 20, 9, 4)] },
      { id: 'toppings', name: 'Toppings', parts: [P('cheese', 'Cheese', 80, 5, 0, 6), P('bacon', 'Bacon', 90, 6, 0, 7), P('salad', 'Lettuce, tomato, onion', 10, 0, 2, 0, 1), P('fried_onion', 'Fried onions', 60, 1, 5, 4)] },
      { id: 'sauce', name: 'Sauce', parts: [P('ketchup', 'Ketchup', 20, 0, 5, 0), P('mayo', 'Mayo', 100, 0, 0, 11), P('burger_sauce', 'Burger sauce', 90, 0, 3, 9), P('bbq', 'BBQ sauce', 35, 0, 8, 0)] },
      { id: 'side', name: 'Side', parts: [P('fries_s', 'Small fries', 230, 3, 30, 11, 3), P('fries_m', 'Medium fries', 330, 4, 43, 16, 4), P('fries_l', 'Large fries', 480, 6, 63, 23, 6), P('side_salad', 'Side salad', 20, 1, 3, 0, 2), P('onion_rings', 'Onion rings', 300, 4, 35, 16, 2)] },
      { id: 'drink', name: 'Drink', parts: [P('soda', 'Soda (medium)', 210, 0, 55, 0), P('diet_soda', 'Diet soda', 0, 0, 0, 0), P('shake', 'Milkshake (medium)', 550, 12, 80, 18), P('water', 'Water', 0, 0, 0, 0)] },
    ],
  },
  {
    id: 'pizza', name: 'Pizza', emoji: '🍕', tags: 'pizza slice slices pizzeria dominos',
    groups: [
      { id: 'slices', name: 'Slices (of a 30 cm pizza) — tap again for more', steps: COUNT, parts: [P('margherita', 'Margherita', 200, 9, 25, 7, 1), P('pepperoni', 'Pepperoni', 250, 11, 25, 12, 1), P('ham', 'Ham & mushroom', 210, 11, 25, 7, 1), P('veggie', 'Vegetable', 190, 8, 26, 6, 2), P('meat', 'Meat feast', 290, 13, 25, 15, 1), P('kebab', 'Kebab pizza', 300, 15, 26, 15, 1), P('hawaiian', 'Hawaiian', 220, 11, 27, 7, 1)] },
      { id: 'extras', name: 'Extras', parts: [P('garlic_dip', 'Garlic dip', 150, 0, 2, 16), P('pizza_salad', 'Cabbage salad', 40, 1, 5, 2, 2), P('side_salad', 'Side salad', 20, 1, 3, 0, 2), P('soda', 'Soda (regular)', 210, 0, 55, 0), P('beer', 'Beer', 220, 2, 18, 0)] },
    ],
  },
  {
    id: 'salad', name: 'Salad bowl', emoji: '🥗', tags: 'salad bowl poke buddha grain salad bar',
    groups: [
      { id: 'base', name: 'Base', one: true, parts: [P('leaves', 'Mixed leaves', 15, 1, 2, 0, 2), P('grains', 'Leaves + grains', 180, 6, 30, 3, 4), P('pasta', 'Pasta salad base', 250, 8, 45, 4, 3), P('rice', 'Sushi rice', 240, 4, 53, 0, 1)] },
      { id: 'protein', name: 'Protein', parts: [P('chicken', 'Grilled chicken', 165, 31, 0, 4), P('tuna', 'Tuna', 120, 26, 0, 1), P('salmon', 'Salmon', 230, 22, 0, 15), P('egg', '2 eggs', 140, 12, 1, 10), P('feta', 'Feta', 130, 7, 2, 11), P('halloumi', 'Halloumi', 160, 11, 1, 13), P('chickpeas', 'Chickpeas', 130, 7, 20, 2, 6), P('tofu', 'Tofu', 120, 12, 3, 7, 1)] },
      { id: 'toppings', name: 'Toppings', parts: [P('avocado', 'Half avocado', 120, 1.5, 6, 11, 5), P('croutons', 'Croutons', 70, 2, 10, 3, 1), P('seeds', 'Nuts & seeds', 100, 3, 3, 9, 2), P('olives', 'Olives', 40, 0, 1, 4, 1), P('corn', 'Sweetcorn', 40, 1, 8, 0.5, 1), P('beetroot', 'Beetroot', 20, 1, 4, 0, 1), P('cheese', 'Cheese', 110, 7, 0, 9), P('edamame', 'Edamame', 60, 6, 5, 3, 3)] },
      { id: 'dressing', name: 'Dressing', parts: [P('vinaigrette', 'Vinaigrette', 120, 0, 3, 12), P('caesar', 'Caesar', 150, 1, 1, 16), P('ranch', 'Ranch', 140, 1, 1, 15), P('balsamic', 'Balsamic', 30, 0, 6, 0), P('oil', 'Olive oil drizzle', 90, 0, 0, 10), P('yogurt', 'Yogurt dressing', 40, 2, 3, 2), P('soy', 'Soy & sesame', 60, 1, 4, 4)] },
    ],
  },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id);
export const stepsOf = (g) => g.steps || NORMAL;

/** Templates that match a search ("chipotle" → burrito bar, "subway" → sandwich). */
export function matchTemplates(q) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return [];
  return TEMPLATES.filter((t) => words.some((w) => `${t.name} ${t.tags}`.toLowerCase().includes(w)));
}

/** What you built, as one food: name, total and how much of each part. */
export function buildFood(tpl, picks) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
  const names = [];
  let base = '';
  for (const g of tpl.groups) {
    for (const part of g.parts) {
      const q = Number(picks[`${g.id}.${part.id}`]) || 0;
      if (!q) continue;
      for (const k of Object.keys(t)) t[k] += part[k] * q;
      if (g.one) base = part.name.replace(/\s*\(.*\)$/, '');
      else names.push(q === 1.5 ? `extra ${part.name.toLowerCase()}` : q > 1 && g.steps ? `${q}× ${part.name.toLowerCase()}` : part.name.toLowerCase());
    }
  }
  const name = `${base || tpl.name}${names.length ? ` with ${names.join(', ')}` : ''}`.slice(0, 110);
  const round = (x) => Math.round(x);
  return { name, portion: '1', kcal: round(t.kcal), p: round(t.p), c: round(t.c), f: round(t.f), fib: round(t.fib), built: tpl.id };
}
