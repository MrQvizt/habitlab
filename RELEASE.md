# Release, deployment and rollback

Habit Lab ships as two artefacts built from the same code:

| Artefact | Built by | Delivered via |
| --- | --- | --- |
| **Web app** (`www/`: one HTML file + manifest + service worker) | `npm run build` | Vercel (preview per push; production from `main`) |
| **Android app** (`habit-lab.apk`, Capacitor) | `npm run android:apk` | GitHub Actions artefact; "latest" GitHub release from `main` |

There is no server and no database: every user's data lives on their own device.

## Quality gates (all must pass)

```bash
npm ci
npm test                                   # 56 unit tests (engines, store, fuzzing, performance budgets, CSP hash)
npm install --no-save playwright@1.63.0 axe-core@4.10.2 && npx playwright install chromium
npm run build && npm run test:browser      # 11 browser suites against the production build and headers
cd android && ./gradlew testDebugUnitTest  # native alarm scheduling
```

CI runs the same gates on every push and pull request (`.github/workflows/android.yml`: jobs `browser-tests` and `build`).

`tests/build.test.mjs` fails if `vercel.json` is stale. The Content-Security-Policy contains the hash of the app's inline
script; a stale hash would make browsers block the app. **After any code change, run `npm run build` and commit
`vercel.json` and `dist/`.**

## Deploying

### Web
1. Push to a branch → Vercel builds a **preview** (`habitlab-git-<branch>-bpluz.vercel.app`). Check it.
2. Merge the pull request into `main` → Vercel deploys **production**. Merging is the release decision.
3. Verify: open the site, check the browser console is clean, and confirm the response headers include
   `Content-Security-Policy` (`curl -sI <url> | grep -i content-security`).

### Android
1. Merge into `main` → CI builds and publishes `habit-lab.apk` to the `latest` GitHub release.
2. Install by opening the APK on the phone. Updates install over the previous version and keep all data, because:
   every build is signed with the same key (`android/app/debug-shared.keystore`), and `versionCode` is the number of
   minutes from 2025-01-01 to the commit (always increasing, also across squash merges).
3. Verify on a device: **Settings → Alarms & wake-up → Test in 5 s**, lock the phone, and check the wake screen
   appears and the melody plays; then check a chime alarm, and that alarms survive a reboot.

**Play Store:** not ready as-is. It needs a private release key (never commit it), `assembleRelease`, a privacy policy
and the Play declarations for `USE_EXACT_ALARM` and `USE_FULL_SCREEN_INTENT` (allowed for alarm-clock apps).

## Rolling back

### Web
- **Fastest:** in Vercel → Deployments, choose the last good production deployment → **Promote to Production**
  (instant, no rebuild).
- **In git:** `git revert <bad commit>` on `main` and push; Vercel redeploys.
- Users' data is unaffected (it's on their devices). The service worker is network-first, so the rolled-back
  version loads on the next online visit.

### Android
Android does not install an **older** `versionCode` over a newer one, and uninstalling erases the app's data. So:
- **Roll forward instead:** `git revert <bad commit>` and push to `main`. The revert is a new commit, so the new APK
  has a higher `versionCode` and installs over the bad one, keeping data.
- If someone must uninstall: first **Settings → Your data → Export**, then reinstall and import.

## Monitoring

Habit Lab collects **no telemetry and no crash reports** by design: health data never leaves the device. Signals:
- CI status on every push (all test layers).
- Vercel deployment status and build logs.
- Users can export their data (Settings → Your data) to share when reporting a problem.

If remote crash reporting is ever wanted, it must be opt-in, strip all health data, and the CSP `connect-src` must be
widened to that one endpoint.

## Production readiness

| Requirement | Evidence | Status |
| --- | --- | --- |
| Core functionality works | 11 browser suites cover every screen and journey; 56 unit tests | ✅ |
| Critical journeys tested | Onboarding, logging, check-in, journey, Body Wrap, alarms, week start | ✅ |
| No known critical security issues | `xss` suite (16 fields), strict CSP verified in `web`, fuzzed import, private alarm receiver | ✅ |
| Build succeeds | `npm run build`, `assembleDebug`, CI | ✅ |
| Accessibility evaluated | axe-core WCAG 2.2 AA: 0 violations on 48 screen checks | ✅ |
| Devices and sizes | 320–1440 px, light and dark, new and long-term users (`robust`) | ✅ |
| Performance | Two-year dataset, 4× CPU throttle: meal tap 188 ms, habit tap 126 ms (`perf.test.mjs` budgets) | ✅ |
| Error handling and recovery | Storage-full banner, import validation, fuzzed corrupt data, offline mode | ✅ |
| Data integrity | Sanitiser on every load and import; history kept across plan rebuilds and week-start changes | ✅ |
| Native alarm on real devices | Verified by the owner on one phone: rings through silent mode; wake screen opens from the notification. Full-screen takeover while unlocked needs “Display over other apps” (added, not yet re-verified) | ⚠️ |
| Play Store release | Needs release key, privacy policy and declarations (above) | ❌ not started |

**Verdict:** the web app and the sideloaded Android app are ready for use. Before a wider Android rollout, verify the
alarm on at least one physical device per major Android version (12, 13, 14, 15) and on a Samsung (aggressive
battery management).

## Known risks and limitations

- **Native alarm not device-tested.** Scheduling maths is unit-tested (incl. daylight saving) and the JS bridge is
  tested with a mock, but ringing over the lock screen, full-screen intents and boot rescheduling were not run on
  real hardware. On Android 14+, "full-screen alarms" may need allowing in system settings (the app detects this and
  shows a button).
- **Unlocked phone:** Android shows a ringing alarm as a notification while the phone is in use; the wake screen
  only takes over directly if the user allows “Display over other apps” (prompted in Settings → Alarms). Locked
  phones use the full-screen intent.
- **Battery optimisation** on some phones (Samsung, Xiaomi, Huawei) can delay alarms; the app links to the setting.
- **Shared debug signing key** is committed so every build can update the last. Anyone with the repo can sign an APK
  that installs over the app; acceptable for sideloading among trusted users, not for public distribution.
- **Android backups are on** (`allowBackup`): data can follow the user to a new phone via their Google backup
  (encrypted). That is a deliberate trade-off for keeping progress; turn it off if health data must never leave the
  device.
- **The CSP applies to the web build only.** Inside the Android app, Capacitor injects its own bridge script, so the
  page-level policy isn't used there; script injection is still prevented by escaping (verified by `xss`).
- **Research content is general information,** not medical advice; sources are cited in-app and in `RESEARCH.md`.
