# Habit Lab

An evidence-based, adaptive habit coach for adults with overweight or obesity who want to lose weight and keep it off.
It builds a **meal plan**, a **workout plan** and a small set of **habits**, and adjusts all three from a weekly check-in.

- **No build step, no server, no account.** Plain HTML, CSS and JavaScript modules. All data stays in the browser
  (`localStorage`), with export/import for backups. Works offline as a PWA once loaded.
- **Built from the research.** [`RESEARCH.md`](RESEARCH.md) is the evidence brief (86 cited sources). It ends with
  26 design rules, and the code implements them. The in-app **Learn** section explains each one in plain language.

## Run it

```bash
cd habit-lab
python3 -m http.server 8000     # any static server works
# open http://localhost:8000
```

ES modules need to be served over HTTP, so opening `index.html` from the file system won't work. To deploy, copy the
folder to any static host (GitHub Pages, Netlify, Cloudflare Pages). There are no dependencies.

**Single-file version:** `node tools/build.mjs` bundles everything into `dist/habit-lab.html`. That one file opens
straight from disk (double-click it), with no server needed. The bundler is a ~100-line script with no dependencies.

Click **Explore with demo data** on the welcome screen to see ten weeks of sample history, including a plateau.

## What it does

| Area | How it adapts |
| --- | --- |
| **Calories** | Mifflin–St Jeor × activity factor (1.4–1.85), minus a 350, 500 (default) or 750 kcal deficit. The deficit is capped at ≤1% of body weight and ≤1 kg per week, with floors of 1,200 kcal (women) and 1,500 kcal (men). Targets are recalculated for every 2 kg change in trend weight. |
| **Learned energy needs** | With ≥14 days of data and ≥80% of days fully logged, the app estimates `TDEE_obs = mean intake − Δtrend × 7700 / days`. It moves 30% toward that estimate each week, capped at ±150 kcal. |
| **Protein / fibre** | 1.4 g/kg (minimum 1.2) of body weight capped at BMI 30; at least 25 g fibre. |
| **Meal plan** | 60 recipes. Nutrition is computed from per-ingredient data, and portions are scaled so each day lands within 5% of target. The plan respects diet (omnivore, pescatarian, vegetarian, vegan), 8 allergens, disliked foods, cooking time, budget and variety. It also offers leftovers, swaps, favourites, a recipe browser and an aisle-grouped shopping list. |
| **Workouts** | Seven progression chains, from a chair sit-to-stand up to goblet squats. They are filtered by equipment (none, bands, dumbbells, gym) and by painful joints (knees, back, shoulders, wrists). Double progression is driven by per-exercise feedback ("too easy", "just right", "too hard", "it hurt"). Strength sessions fall on non-consecutive days. Cardio rises by about 10% a week (10–20 min) toward 150 and then 200–250 min a week. The step goal rises by 500 once it is met on 5 of 7 days, capped at 10,000 (8,000 at 60+). |
| **Habits** | 25 habits, each an "After I [cue], I will [habit]" plan with a tiny fallback version. Up to 3 are active at a time, shown against a 66-day horizon. Streaks are forgiving ("never miss twice"). Each habit has a 4-item automaticity check, and the app suggests the next habit based on your stated struggles. |
| **Weekly check-in** | Asks about adherence, hunger, energy, stress, sleep, alcohol and barriers. Responses: <br>• Too fast (>1%/week over 21 days): +150 kcal. <br>• Plateau (<0.25%/week with good adherence): choose −150 kcal, +30 activity minutes, more structure, or a 4-week maintenance phase. <br>• Low adherence: make the plan easier, never cut calories. <br>• Week 8 with under 2% lost: offer extra support. <br>• Goal reached: switch to maintenance with a ±2 kg band and a reset plan. <br>• Barriers: a problem-solving plan for each one picked. |
| **Safety** | Pregnancy, under-18s, BMI <18.5 and eating-disorder warning signs switch the app to **habits-only mode**, with no calorie numbers and no weighing. Warnings cover diabetes medication, heart and kidney disease, and GLP-1 medicines. Eating-disorder questions are asked again every 4 weeks. Stop signs are shown alongside workouts. |

## Code layout

```
js/engine/   pure logic (no DOM): calc, trend, meals, workouts, habits, adjust, safety
js/data/     foods (per-100 g nutrition), recipes, exercises, habits, learn cards
js/views/    one module per screen; render() returns HTML, actions handle events
js/store.js  state, persistence and derived values (targets, plans, schedules)
tests/       engine unit tests + Playwright walkthroughs
tools/       build.mjs: zero-dependency bundler → dist/habit-lab.html
```

## Tests

```bash
node --test tests/engine.test.mjs           # 25 engine tests, including simulated multi-week users
python3 -m http.server 8765 &               # then, with Playwright available:
node tests/e2e.cjs http://localhost:8765/   # onboarding → every page → session → check-in; no console errors, no overflow
node tests/demo.cjs http://localhost:8765/  # demo data → plateau check-in flow
node tests/e2e.cjs file://$PWD/dist/habit-lab.html   # same walkthrough against the single-file build
```

## Disclaimer

Habit Lab provides general information based on published guidelines. It is not medical advice and does not
replace care from a doctor or registered dietitian. Nutrition values are approximate.
