# Habit Lab

An evidence-based, adaptive habit coach for adults with overweight or obesity who want to lose weight and keep it off.
It builds a **meal plan**, a **workout plan** and a small set of **habits**, and adjusts all three from a weekly check-in.

- **No server, no account, no tracking.** Plain HTML, CSS and JavaScript modules. All data stays on the device
  (`localStorage`, mirrored to native storage in the Android app), with export/import for backups. Works offline
  and installs as a PWA. The app makes no network requests.
- **Built from the research.** [`RESEARCH.md`](RESEARCH.md) is the evidence brief (86 cited sources). It ends with
  26 design rules, and the code implements them. The in-app **Learn** section explains each one in plain language.

## Run it

```bash
git clone https://github.com/MrQvizt/habitlab.git && cd habitlab
python3 -m http.server 8000     # any static server works
# open http://localhost:8000
```

ES modules need to be served over HTTP, so opening `index.html` from the file system won't work. To deploy, copy the
folder to any static host (GitHub Pages, Netlify, Cloudflare Pages). There are no dependencies.

**Single-file version:** `node tools/build.mjs` bundles everything into `dist/habit-lab.html`. That one file opens
straight from disk (double-click it), with no server needed. The bundler is a ~100-line script with no dependencies.

Click **Explore with demo data** on the welcome screen to see ten weeks of sample history, including a plateau.

## Android app

Install `habit-lab.apk` from the [latest release](https://github.com/MrQvizt/habitlab/releases/tag/latest). GitHub Actions builds it on every push to `main`.

1. Open the link on your phone and download the APK.
2. Open the file and allow installs from your browser when Android asks.
3. In the app, go to **Settings → Reminders & encouragement** and turn reminders on.

### Updating without losing progress

Download the new `habit-lab.apk` and open it. Android shows **Update** rather than Install, and all your data stays.
Several things guarantee this:

- **Same signing key:** every build is signed with `android/app/debug-shared.keystore`. Android only accepts an update signed with the key of the installed version.
- **Rising version code:** each build's version code is the number of git commits, so a newer build always counts as an upgrade.
- **Fixed app address:** the app's internal address is pinned (`https://localhost`, in `capacitor.config.json`). Saved data is tied to that address.
- **Native backup copy:** every save is also copied to Android's native app storage. If the web storage is ever empty or older, the app restores from that copy at startup. The native storage is also included in Android's automatic backup.
- **Old data upgrades:** older saved data is migrated to the current format when the app loads.
- **Manual backup:** **Settings → Your data → Export backup** saves a file you can import on any device.

Never uninstall to update: uninstalling erases the app's data. If an update is ever refused, export a backup first.

To build it yourself, you need Node 22, JDK 21 and the Android SDK (platform 35):

```bash
npm ci
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
npm run android:apk            # → android/app/build/outputs/apk/debug/app-debug.apk
```

The Android app is the same web app wrapped with [Capacitor](https://capacitorjs.com/). Reminders use native scheduled
notifications, so they arrive even when the app is closed. The shared debug key is `android/app/debug-shared.keystore`.
It is fine for sideloading, but publishing to the Play Store would need a private release key.

## Design

The app works like a native app:
- **Bottom sheets** hold details and actions. Close them by swiping down, tapping the background, pressing Escape or using the Android back button.
- **Undo snackbars** replace "are you sure?" dialogs for anything reversible.
- **Today** starts with a single "Next up" action.
- **Buttons are easy to reach:** touch targets are at least 44 px, and primary actions sit in sticky bars at the bottom of the screen.
- **Navigation** uses five tabs, with page transitions that respect reduced-motion settings.

Light and dark themes are designed separately. Text and icons meet WCAG AA contrast. `node tests/screens.cjs` takes a
screenshot tour for design review.

## Rewards and reminders

- **Rewards:** you earn XP for logging meals, doing habits, moving, weighing in and doing the weekly check-in.
  - A logged meal earns the same XP whatever you ate.
  - Nothing rewards eating less or a lower weight.
  - There are daily quests, with a "perfect day" bonus for completing them all.
  - Levels and 27 badges mark progress.
  - The streak counts days you log anything, and missing a single day doesn't break it.
  - Habits have small-win levels, for example: swapped one sugary drink → swapped about half → no sugary drinks today. Every level earns XP and keeps the streak.
  - Occasional lucky bonuses add variety.
  - Celebrations (confetti, chimes, a short vibration) respect your device's reduced-motion setting. Sound and vibration can be turned off.
- **Reminders:** specific nudges such as "Lunch: Greek salad with chicken" or "Strength session A".
  - The schedule: morning weigh-in, meal logging, movement, an afternoon encouragement, an evening streak saver and a weekly check-in.
  - Each reminder is skipped once you've done the thing, and all times are configurable.

## What it does

| Area | How it adapts |
| --- | --- |
| **Calories** | Mifflin–St Jeor × activity factor (1.4–1.85), minus a 350, 500 (default) or 750 kcal deficit. The deficit is capped at ≤1% of body weight and ≤1 kg per week, with floors of 1,200 kcal (women) and 1,500 kcal (men). Targets are recalculated for every 2 kg change in trend weight. |
| **Learned energy needs** | With ≥14 days of data and ≥80% of days fully logged, the app estimates `TDEE_obs = mean intake − Δtrend × 7700 / days`. It moves 30% toward that estimate each week, capped at ±150 kcal. |
| **Protein / fibre** | 1.4 g/kg (minimum 1.2) of body weight capped at BMI 30; at least 25 g fibre. |
| **Meal plan** | 78 recipes. Nutrition is computed from per-ingredient data, and portions are scaled so each day lands within 5% of target. The plan respects diet (omnivore, pescatarian, vegetarian, vegan), 8 allergens, disliked foods, cooking time, budget and variety. It also offers leftovers, swaps, favourites, a recipe browser and an aisle-grouped shopping list. |
| **Workouts** | Seven progression chains, from a chair sit-to-stand up to goblet squats. They are filtered by equipment (none, bands, dumbbells, gym) and by painful joints (knees, back, shoulders, wrists). Double progression is driven by per-exercise feedback ("too easy", "just right", "too hard", "it hurt"). Strength sessions fall on non-consecutive days. Cardio rises by about 10% a week (10–20 min) toward 150 and then 200–250 min a week. The step goal rises by 500 once it is met on 5 of 7 days, capped at 10,000 (8,000 at 60+). |
| **Habits** | 25 habits, each an "After I [cue], I will [habit]" plan with a tiny fallback version. Up to 3 are active at a time, shown against a 66-day horizon. Streaks are forgiving ("never miss twice"). Each habit has a 4-item automaticity check, and the app suggests the next habit based on your stated struggles. |
| **Weekly check-in** | Asks about adherence, hunger, energy, stress, sleep, alcohol and barriers. Responses: <br>• Too fast (>1%/week over 21 days): +150 kcal. <br>• Plateau (<0.25%/week with good adherence): choose −150 kcal, +30 activity minutes, more structure, or a 4-week maintenance phase. <br>• Low adherence: make the plan easier, never cut calories. <br>• Week 8 with under 2% lost: offer extra support. <br>• Goal reached: switch to maintenance with a ±2 kg band and a reset plan. <br>• Barriers: a problem-solving plan for each one picked. |
| **Safety** | Pregnancy, under-18s, BMI <18.5 and eating-disorder warning signs switch the app to **habits-only mode**, with no calorie numbers and no weighing. Warnings cover diabetes medication, heart and kidney disease, and GLP-1 medicines. Eating-disorder questions are asked again every 4 weeks. Stop signs are shown alongside workouts. |

## Code layout

```
js/engine/   pure logic (no DOM): calc, trend, meals, workouts, habits, adjust, safety, game (XP),
             journey, body (Body Wrap rings and levels), alarms, reminders, schedule
js/data/     foods, recipes, exercises, habits, hobbies (836, 2024 Compendium), learn cards,
             affirmations, melodies
js/views/    one module per screen; render() returns HTML, actions handle events
js/store.js  state, persistence, sanitising and derived values (targets, plans, schedules)
android/     Capacitor shell + native alarm clock (app/src/main/java/.../alarm)
tests/       unit tests (*.test.mjs) and browser suites (*.cjs)
tools/       build.mjs (bundler + security headers), serve.mjs, browser-tests.mjs, heavy-state.mjs
```

## Tests

```bash
npm test                      # 54 unit tests: engines, store, fuzzing, performance budgets, build/CSP check
npm run build && npm run test:browser   # 11 browser suites against the production build + headers
cd android && ./gradlew testDebugUnitTest   # native alarm scheduling (incl. daylight saving)
```

Browser suites need Playwright and axe-core: `npm install --no-save playwright@1.63.0 axe-core@4.10.2 && npx playwright install chromium`.

| Suite | What it proves |
| --- | --- |
| `e2e`, `demo`, `journey` | Onboarding → every screen → logging → check-in; demo plateau flow; new-user journey |
| `wrap`, `flow` | Body Wrap story, body-part sheets and levels; every screen within two taps; week start |
| `xss` | Script payloads in all 16 user/import-controlled fields never execute |
| `web` | Production security headers, CSP blocks injected script, installable, works offline, storage-full warning |
| `a11y` | axe-core WCAG 2.2 AA on 23 screens + a sheet, light and dark: 0 violations |
| `robust` | 22 screens × new and long-term user × 320–1440 px: no errors, NaN or sideways scrolling |
| `native`, `alarms` | The Android notification and alarm bridges, with mocked native plugins |

CI (`.github/workflows/android.yml`) runs all three layers on every push and pull request.
Release, deployment and rollback: see [`RELEASE.md`](RELEASE.md).

## Disclaimer

Habit Lab provides general information based on published guidelines. It is not medical advice and does not
replace care from a doctor or registered dietitian. Nutrition values are approximate.
