// Common foods and dishes per typical portion, for logging what you ate off the plan.
// Values are approximate, rounded averages from food composition tables (USDA FoodData Central,
// UK McCance & Widdowson, Swedish Livsmedelsverket) for a standard portion; real portions vary.
// [id, name, portion, kcal, protein g, carbs g, fat g, category]
const R = [
  // Meals & dishes
  ['spaghetti_bolognese', 'Spaghetti bolognese', 'plate', 650, 32, 78, 20, 'meal'],
  ['lasagne', 'Lasagne', 'portion', 600, 30, 45, 32, 'meal'],
  ['mac_cheese', 'Macaroni cheese', 'portion', 620, 24, 65, 28, 'meal'],
  ['carbonara', 'Pasta carbonara', 'plate', 750, 30, 80, 33, 'meal'],
  ['pesto_pasta', 'Pasta with pesto', 'plate', 620, 18, 80, 25, 'meal'],
  ['tomato_pasta', 'Pasta with tomato sauce', 'plate', 480, 15, 88, 8, 'meal'],
  ['chicken_curry', 'Chicken curry', 'portion (no rice)', 400, 32, 14, 24, 'meal'],
  ['tikka_masala', 'Chicken tikka masala', 'portion (no rice)', 480, 34, 16, 30, 'meal'],
  ['butter_chicken', 'Butter chicken', 'portion (no rice)', 500, 32, 14, 34, 'meal'],
  ['dal', 'Lentil dal', 'bowl', 300, 16, 42, 8, 'meal'],
  ['chili_con_carne', 'Chili con carne', 'bowl', 450, 32, 30, 22, 'meal'],
  ['beef_stew', 'Beef stew', 'bowl', 420, 34, 28, 18, 'meal'],
  ['meatballs', 'Meatballs (8)', '8 balls', 440, 26, 12, 32, 'meal'],
  ['meatballs_mash', 'Meatballs with mash and gravy', 'plate', 750, 34, 60, 40, 'meal'],
  ['shepherds_pie', 'Shepherd’s / cottage pie', 'portion', 520, 28, 45, 24, 'meal'],
  ['fish_pie', 'Fish pie', 'portion', 520, 32, 40, 25, 'meal'],
  ['roast_dinner', 'Roast dinner (meat, potatoes, veg, gravy)', 'plate', 800, 45, 70, 35, 'meal'],
  ['roast_chicken', 'Roast chicken (leg)', 'leg', 330, 30, 0, 23, 'meal'],
  ['chicken_breast_cooked', 'Chicken breast, grilled', '150 g', 250, 46, 0, 6, 'meal'],
  ['steak', 'Steak, sirloin', '200 g', 420, 52, 0, 23, 'meal'],
  ['pork_chop', 'Pork chop', '1 chop', 300, 34, 0, 18, 'meal'],
  ['salmon_fillet', 'Salmon fillet, baked', '140 g', 290, 30, 0, 18, 'meal'],
  ['white_fish', 'White fish, baked', '150 g', 150, 32, 0, 2, 'meal'],
  ['fish_fingers', 'Fish fingers (4)', '4 fingers', 220, 12, 20, 10, 'meal'],
  ['fish_and_chips', 'Fish and chips', 'portion', 1000, 40, 100, 50, 'meal'],
  ['sausages', 'Sausage (pork)', '1 sausage', 180, 8, 3, 15, 'meal'],
  ['sausages_2', 'Sausages (2)', '2 sausages', 360, 16, 6, 30, 'meal'],
  ['bratwurst', 'Bratwurst / grillkorv', '1 sausage', 280, 12, 2, 25, 'meal'],
  ['hot_dog', 'Hot dog in a bun', '1', 300, 11, 26, 17, 'meal'],
  ['sausage_and_mash', 'Sausage and mash', 'plate', 700, 24, 55, 42, 'meal'],
  ['falukorv', 'Fried falukorv slices', '150 g', 400, 15, 9, 34, 'meal'],
  ['pyttipanna', 'Pyttipanna (hash)', 'plate', 600, 22, 50, 34, 'meal'],
  ['stir_fry', 'Chicken stir-fry with noodles', 'plate', 600, 34, 70, 18, 'meal'],
  ['fried_rice', 'Egg fried rice', 'portion', 450, 12, 65, 15, 'meal'],
  ['pad_thai', 'Pad thai', 'plate', 650, 25, 80, 25, 'meal'],
  ['ramen', 'Ramen', 'bowl', 550, 25, 65, 20, 'meal'],
  ['sushi_8', 'Sushi (8 pieces)', '8 pieces', 350, 14, 60, 5, 'meal'],
  ['poke_bowl', 'Poke bowl', 'bowl', 600, 30, 70, 20, 'meal'],
  ['burrito', 'Burrito', '1', 700, 32, 80, 26, 'meal'],
  ['burrito_bowl', 'Burrito bowl', 'bowl', 650, 35, 70, 22, 'meal'],
  ['tacos_3', 'Tacos (3)', '3 tacos', 550, 27, 45, 28, 'meal'],
  ['quesadilla', 'Quesadilla', '1', 600, 28, 45, 34, 'meal'],
  ['nachos', 'Nachos with cheese', 'plate', 800, 22, 75, 45, 'meal'],
  ['omelette', 'Omelette (3 eggs, cheese)', '1', 380, 26, 2, 30, 'meal'],
  ['quiche', 'Quiche', 'slice', 420, 14, 25, 30, 'meal'],
  ['soup_veg', 'Vegetable soup', 'bowl', 150, 5, 22, 4, 'meal'],
  ['soup_cream', 'Creamy soup', 'bowl', 280, 6, 22, 18, 'meal'],
  ['pea_soup', 'Pea soup (ärtsoppa)', 'bowl', 300, 18, 35, 8, 'meal'],
  ['salad_chicken', 'Chicken salad', 'bowl', 400, 35, 12, 22, 'meal'],
  ['caesar_salad', 'Caesar salad', 'bowl', 480, 25, 18, 34, 'meal'],
  ['greek_salad', 'Greek salad', 'bowl', 300, 9, 12, 24, 'meal'],
  ['tuna_salad', 'Tuna salad', 'bowl', 350, 30, 12, 20, 'meal'],
  ['jacket_potato', 'Jacket potato with beans and cheese', '1', 550, 22, 80, 15, 'meal'],
  ['risotto', 'Risotto', 'plate', 600, 16, 80, 22, 'meal'],
  ['paella', 'Paella', 'plate', 600, 32, 70, 20, 'meal'],
  ['kebab_plate', 'Kebab plate with rice', 'plate', 900, 45, 80, 42, 'meal'],
  ['gyros_pita', 'Gyros / kebab in pita', '1', 650, 30, 55, 34, 'meal'],
  ['falafel_wrap', 'Falafel wrap', '1', 600, 18, 70, 28, 'meal'],
  ['pancakes_swedish', 'Pancakes with jam (3)', '3 pancakes', 450, 14, 60, 16, 'meal'],
  ['pizza_slice', 'Pizza (1 slice)', '1 slice', 280, 12, 33, 11, 'meal'],
  ['pizza_whole', 'Pizza (whole, 12")', 'whole', 1600, 70, 190, 60, 'meal'],
  ['kebab_pizza', 'Kebab pizza (whole)', 'whole', 1900, 85, 200, 85, 'meal'],
  // Fast food
  ['burger', 'Burger (single)', '1', 520, 28, 42, 26, 'fast'],
  ['cheeseburger', 'Cheeseburger', '1', 300, 15, 32, 13, 'fast'],
  ['double_burger', 'Double cheeseburger', '1', 450, 25, 34, 24, 'fast'],
  ['big_burger', 'Big burger (restaurant)', '1', 850, 45, 50, 50, 'fast'],
  ['chicken_burger', 'Chicken burger', '1', 500, 25, 50, 22, 'fast'],
  ['veggie_burger', 'Veggie burger', '1', 450, 18, 50, 20, 'fast'],
  ['nuggets_6', 'Chicken nuggets (6)', '6 pieces', 270, 15, 16, 16, 'fast'],
  ['nuggets_9', 'Chicken nuggets (9)', '9 pieces', 400, 22, 24, 24, 'fast'],
  ['fried_chicken', 'Fried chicken (2 pieces)', '2 pieces', 500, 36, 16, 32, 'fast'],
  ['wings_6', 'Chicken wings (6)', '6 wings', 480, 40, 4, 34, 'fast'],
  ['sub_6', 'Sub sandwich (6-inch)', '1', 400, 22, 46, 14, 'fast'],
  ['wrap_chicken', 'Chicken wrap', '1', 500, 28, 45, 22, 'fast'],
  ['club_sandwich', 'Club sandwich', '1', 600, 32, 45, 32, 'fast'],
  ['toastie', 'Ham and cheese toastie', '1', 420, 22, 35, 21, 'fast'],
  ['sandwich', 'Sandwich (shop-bought)', '1', 400, 20, 40, 17, 'fast'],
  ['baguette', 'Filled baguette', '1', 550, 25, 65, 20, 'fast'],
  ['sausage_roll', 'Sausage roll', '1', 330, 8, 25, 22, 'fast'],
  ['pasty', 'Pasty', '1', 600, 15, 55, 36, 'fast'],
  ['bagel_cream_cheese', 'Bagel with cream cheese', '1', 360, 12, 50, 12, 'fast'],
  // Breakfast
  ['porridge', 'Porridge with milk', 'bowl', 280, 11, 45, 7, 'breakfast'],
  ['overnight_oats', 'Overnight oats', 'jar', 350, 15, 50, 10, 'breakfast'],
  ['cereal_milk', 'Cereal with milk', 'bowl', 250, 8, 45, 4, 'breakfast'],
  ['granola_yogurt', 'Granola with yogurt', 'bowl', 400, 14, 50, 16, 'breakfast'],
  ['muesli', 'Muesli with milk', 'bowl', 330, 11, 52, 8, 'breakfast'],
  ['eggs_boiled_2', 'Boiled eggs (2)', '2 eggs', 140, 12, 1, 10, 'breakfast'],
  ['eggs_scrambled', 'Scrambled eggs (2) on toast', 'plate', 380, 18, 30, 20, 'breakfast'],
  ['eggs_fried', 'Fried egg', '1 egg', 90, 6, 0, 7, 'breakfast'],
  ['full_breakfast', 'Full cooked breakfast', 'plate', 900, 45, 50, 58, 'breakfast'],
  ['bacon_2', 'Bacon (2 rashers)', '2 rashers', 180, 12, 0, 14, 'breakfast'],
  ['pancakes_stack', 'Pancakes with syrup (stack)', '3 pancakes', 520, 12, 85, 15, 'breakfast'],
  ['waffle', 'Waffle', '1', 300, 6, 35, 15, 'breakfast'],
  ['avocado_toast', 'Avocado toast', '1 slice', 280, 7, 25, 17, 'breakfast'],
  ['smoothie_bowl', 'Smoothie bowl', 'bowl', 400, 10, 70, 9, 'breakfast'],
  ['croissant', 'Croissant', '1', 230, 5, 26, 12, 'breakfast'],
  ['pain_au_chocolat', 'Pain au chocolat', '1', 300, 5, 32, 17, 'breakfast'],
  // Bread & grains
  ['bread_slice', 'Bread (1 slice)', '1 slice', 90, 3, 16, 1, 'bread'],
  ['toast_butter', 'Toast with butter', '1 slice', 130, 3, 16, 6, 'bread'],
  ['crispbread', 'Crispbread (knäckebröd)', '1 slice', 40, 1, 7, 0, 'bread'],
  ['open_sandwich', 'Open sandwich (cheese / ham)', '1', 180, 9, 16, 8, 'bread'],
  ['bagel', 'Bagel, plain', '1', 250, 10, 48, 2, 'bread'],
  ['pita', 'Pita bread', '1', 170, 6, 34, 1, 'bread'],
  ['tortilla', 'Tortilla wrap', '1', 180, 5, 30, 4, 'bread'],
  ['naan', 'Naan bread', '1', 300, 9, 50, 7, 'bread'],
  ['rice_cooked', 'Rice, cooked', '1 cup (180 g)', 230, 4, 50, 1, 'bread'],
  ['pasta_cooked', 'Pasta, cooked', '1 cup (180 g)', 280, 10, 56, 2, 'bread'],
  ['couscous', 'Couscous, cooked', '1 cup', 180, 6, 36, 1, 'bread'],
  ['quinoa', 'Quinoa, cooked', '1 cup', 220, 8, 39, 4, 'bread'],
  ['potatoes_boiled', 'Boiled potatoes', '200 g', 170, 4, 38, 0, 'bread'],
  // Dairy & eggs
  ['yogurt_greek', 'Greek yogurt (natural)', '150 g', 150, 14, 6, 8, 'dairy'],
  ['yogurt_fruit', 'Fruit yogurt', '1 pot', 140, 5, 22, 3, 'dairy'],
  ['skyr', 'Skyr / quark', '150 g', 95, 16, 6, 0, 'dairy'],
  ['cottage_cheese', 'Cottage cheese', '150 g', 150, 18, 5, 6, 'dairy'],
  ['cheese_slice', 'Cheese (1 slice)', '1 slice', 70, 5, 0, 6, 'dairy'],
  ['cheese_chunk', 'Cheese (matchbox size)', '30 g', 120, 8, 0, 10, 'dairy'],
  ['milk_glass', 'Milk (glass)', '250 ml', 120, 8, 12, 4, 'dairy'],
  ['oat_milk', 'Oat drink (glass)', '250 ml', 120, 3, 17, 4, 'dairy'],
  ['egg', 'Egg', '1 egg', 75, 6, 0, 5, 'dairy'],
  // Fruit & veg
  ['apple', 'Apple', '1', 80, 0, 21, 0, 'fruit'],
  ['banana', 'Banana', '1', 105, 1, 27, 0, 'fruit'],
  ['orange', 'Orange', '1', 65, 1, 16, 0, 'fruit'],
  ['pear', 'Pear', '1', 100, 1, 27, 0, 'fruit'],
  ['grapes', 'Grapes (handful)', '100 g', 70, 1, 18, 0, 'fruit'],
  ['berries', 'Berries (bowl)', '150 g', 60, 1, 14, 0, 'fruit'],
  ['melon', 'Melon (slice)', '1 slice', 50, 1, 12, 0, 'fruit'],
  ['mango', 'Mango', '1', 200, 3, 50, 1, 'fruit'],
  ['dried_fruit', 'Dried fruit (handful)', '30 g', 90, 1, 22, 0, 'fruit'],
  ['avocado', 'Avocado (half)', '½', 160, 2, 9, 15, 'fruit'],
  ['carrot_sticks', 'Carrot sticks', '100 g', 40, 1, 10, 0, 'fruit'],
  ['raw_veg', 'Raw veggies (bowl)', 'bowl', 50, 2, 10, 0, 'fruit'],
  // Snacks & sweets
  ['crisps_small', 'Crisps (small bag)', '25 g', 130, 2, 13, 8, 'snack'],
  ['crisps_share', 'Crisps (sharing bag)', '150 g', 800, 9, 80, 50, 'snack'],
  ['popcorn', 'Popcorn (cinema, medium)', 'medium', 600, 8, 60, 35, 'snack'],
  ['nuts', 'Nuts (handful)', '30 g', 180, 6, 5, 16, 'snack'],
  ['peanut_butter', 'Peanut butter (1 tbsp)', '15 g', 95, 4, 3, 8, 'snack'],
  ['chocolate_bar', 'Chocolate bar', '45 g', 240, 3, 26, 14, 'snack'],
  ['chocolate_squares', 'Chocolate (2 squares)', '20 g', 110, 1, 12, 6, 'snack'],
  ['sweets', 'Sweets / candy (bag)', '100 g', 350, 3, 85, 0, 'snack'],
  ['lordagsgodis', 'Pick-and-mix (Saturday sweets)', '200 g', 750, 6, 170, 8, 'snack'],
  ['biscuit', 'Biscuit / cookie', '1', 70, 1, 9, 3, 'snack'],
  ['digestive_3', 'Biscuits (3)', '3', 210, 3, 28, 9, 'snack'],
  ['cake_slice', 'Cake (slice)', '1 slice', 350, 4, 45, 17, 'snack'],
  ['cinnamon_bun', 'Cinnamon bun (kanelbulle)', '1', 300, 5, 40, 13, 'snack'],
  ['muffin', 'Muffin', '1', 420, 6, 55, 20, 'snack'],
  ['donut', 'Doughnut', '1', 270, 4, 31, 15, 'snack'],
  ['brownie', 'Brownie', '1', 260, 3, 33, 13, 'snack'],
  ['ice_cream', 'Ice cream (2 scoops)', '2 scoops', 270, 5, 30, 14, 'snack'],
  ['ice_lolly', 'Ice lolly', '1', 80, 0, 20, 0, 'snack'],
  ['protein_bar', 'Protein bar', '1', 200, 20, 20, 7, 'snack'],
  ['cereal_bar', 'Cereal bar', '1', 120, 2, 20, 4, 'snack'],
  ['rice_cakes', 'Rice cakes (2)', '2', 70, 1, 15, 0, 'snack'],
  ['hummus_pitta', 'Hummus with pitta', 'portion', 300, 9, 35, 14, 'snack'],
  ['dip_chips', 'Chips and dip', 'bowl', 450, 5, 40, 30, 'snack'],
  // Drinks
  ['latte', 'Latte', 'medium', 190, 10, 17, 9, 'drink'],
  ['cappuccino', 'Cappuccino', 'medium', 130, 7, 11, 6, 'drink'],
  ['coffee_milk', 'Coffee with milk', 'mug', 30, 2, 3, 1, 'drink'],
  ['black_coffee', 'Black coffee / tea', 'mug', 5, 0, 0, 0, 'drink'],
  ['frappe', 'Iced blended coffee drink', 'large', 400, 6, 60, 15, 'drink'],
  ['hot_chocolate', 'Hot chocolate', 'mug', 220, 8, 30, 8, 'drink'],
  ['soda', 'Soft drink (can)', '330 ml', 140, 0, 35, 0, 'drink'],
  ['soda_zero', 'Diet / zero soft drink', '330 ml', 1, 0, 0, 0, 'drink'],
  ['juice', 'Orange juice (glass)', '250 ml', 110, 2, 26, 0, 'drink'],
  ['smoothie', 'Smoothie (bottle)', '250 ml', 150, 2, 34, 0, 'drink'],
  ['energy_drink', 'Energy drink (can)', '250 ml', 115, 0, 28, 0, 'drink'],
  ['protein_shake', 'Protein shake (with water)', '1 scoop', 120, 24, 3, 2, 'drink'],
  ['beer', 'Beer (pint / 500 ml)', '500 ml', 220, 2, 18, 0, 'drink'],
  ['beer_light', 'Light beer', '330 ml', 100, 1, 6, 0, 'drink'],
  ['wine_glass', 'Wine (glass)', '150 ml', 125, 0, 4, 0, 'drink'],
  ['cider', 'Cider', '500 ml', 230, 0, 25, 0, 'drink'],
  ['spirit_mixer', 'Spirit with mixer', '1', 160, 0, 15, 0, 'drink'],
  ['cocktail', 'Cocktail', '1', 250, 0, 25, 0, 'drink'],
];

// Sides: added to a main ("sausage + side salad") so unplanned meals are tracked better.
const S = [
  ['side_salad', 'Side salad (no dressing)', 25, 1, 4, 0],
  ['side_salad_dressing', 'Side salad with dressing', 120, 1, 5, 11],
  ['coleslaw', 'Coleslaw', 150, 1, 8, 13],
  ['veg_steamed', 'Steamed veggies', 50, 3, 8, 0],
  ['veg_roasted', 'Roasted veggies', 120, 2, 12, 7],
  ['peas', 'Peas', 70, 5, 10, 0],
  ['corn', 'Corn on the cob', 90, 3, 19, 1],
  ['beans_baked', 'Baked beans', 160, 9, 26, 1],
  ['fries_small', 'Fries (small)', 230, 3, 30, 11],
  ['fries_medium', 'Fries (medium)', 340, 4, 44, 16],
  ['fries_large', 'Fries (large)', 490, 6, 63, 23],
  ['sweet_potato_fries', 'Sweet potato fries', 300, 3, 40, 14],
  ['wedges', 'Potato wedges', 280, 5, 40, 11],
  ['mash', 'Mashed potato', 220, 4, 30, 9],
  ['boiled_potatoes', 'Boiled potatoes', 170, 4, 38, 0],
  ['roast_potatoes', 'Roast potatoes', 300, 5, 40, 13],
  ['rice', 'Rice', 230, 4, 50, 1],
  ['fried_rice_side', 'Fried rice', 300, 7, 45, 10],
  ['pasta_side', 'Pasta', 280, 10, 56, 2],
  ['noodles', 'Noodles', 300, 9, 50, 7],
  ['bread_roll', 'Bread roll', 150, 5, 28, 2],
  ['garlic_bread', 'Garlic bread (2 slices)', 220, 5, 26, 11],
  ['naan_side', 'Naan', 300, 9, 50, 7],
  ['onion_rings', 'Onion rings', 300, 4, 34, 17],
  ['mozzarella_sticks', 'Mozzarella sticks', 350, 15, 30, 19],
  ['gravy', 'Gravy', 50, 1, 5, 3],
  ['ketchup', 'Ketchup / sauce', 30, 0, 7, 0],
  ['mayo', 'Mayonnaise (1 tbsp)', 95, 0, 0, 10],
  ['bearnaise', 'Béarnaise sauce', 200, 1, 1, 22],
  ['cheese_sauce', 'Cheese sauce', 150, 6, 6, 11],
  ['dip', 'Dip (sour cream / garlic)', 120, 1, 2, 12],
  ['hummus', 'Hummus', 140, 4, 8, 10],
  ['guacamole', 'Guacamole', 120, 2, 6, 10],
  ['egg_side', 'Fried egg', 90, 6, 0, 7],
  ['cheese_side', 'Extra cheese', 110, 7, 0, 9],
  ['bacon_side', 'Bacon (2 rashers)', 180, 12, 0, 14],
  ['avocado_side', 'Avocado (half)', 160, 2, 9, 15],
  ['soup_side', 'Small soup', 120, 4, 15, 4],
  ['fruit_side', 'Fruit', 80, 1, 20, 0],
  ['soda_side', 'Soft drink', 140, 0, 35, 0],
  ['diet_soda_side', 'Diet soft drink', 1, 0, 0, 0],
  ['water_side', 'Water', 0, 0, 0, 0],
  ['beer_side', 'Beer', 220, 2, 18, 0],
  ['wine_side', 'Glass of wine', 125, 0, 4, 0],
  ['dessert_side', 'Dessert', 350, 5, 45, 16],
  ['ice_cream_side', 'Ice cream', 140, 2, 16, 7],
];

export const FOOD_CATS = { meal: 'Meals', fast: 'Fast food', breakfast: 'Breakfast', bread: 'Bread & grains', dairy: 'Dairy & eggs', fruit: 'Fruit & veg', snack: 'Snacks & sweets', drink: 'Drinks' };

export const FOOD_DB = R.map(([id, name, portion, kcal, p, c, f, cat]) => ({ id, name, portion, kcal, p, c, f, cat }));
export const SIDES = S.map(([id, name, kcal, p, c, f]) => ({ id, name, portion: 'side', kcal, p, c, f, cat: 'side', side: true }));

const BY_ID = new Map([...FOOD_DB, ...SIDES].map((x) => [x.id, x]));
export const foodById = (id) => BY_ID.get(id);

/** Search by words in any order ("chicken curry", "curry chick"); best matches first. */
export function searchFoods(q, limit = 30) {
  const words = String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = [];
  for (const x of FOOD_DB) {
    const name = x.name.toLowerCase();
    if (!words.every((w) => name.includes(w))) continue;
    scored.push([name.startsWith(words[0]) ? 0 : name.split(/\W+/).some((t) => t.startsWith(words[0])) ? 1 : 2, x]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length).slice(0, limit).map((s) => s[1]);
}

/** Total of picked items [{id, n}] (n = portions). */
export function totalOf(items = []) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const it of items) {
    const x = foodById(it.id);
    if (!x) continue;
    const n = Number(it.n) || 1;
    t.kcal += x.kcal * n;
    t.p += x.p * n;
    t.c += x.c * n;
    t.f += x.f * n;
  }
  return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) };
}

/** "Sausages (2) + Side salad" */
export function describe(items = []) {
  return items.map((it) => {
    const x = foodById(it.id);
    if (!x) return '';
    const n = Number(it.n) || 1;
    return n === 1 ? x.name : `${n}× ${x.name}`;
  }).filter(Boolean).join(' + ');
}
