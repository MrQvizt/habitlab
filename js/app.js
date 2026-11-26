// Habit Lab — app shell: routing, persistence and event delegation.
import * as store from './store.js';
import { icon, formData } from './ui/dom.js';
import { setWeekStart } from './engine/util.js';
import onboarding from './views/onboarding.js';
import { goalHint } from './views/onboarding.js';
import todayView from './views/today.js';
import meals from './views/meals.js';
import move from './views/move.js';
import habits from './views/habits.js';
import progress from './views/progress.js';
import checkin from './views/checkin.js';
import learn from './views/learn.js';
import settings from './views/settings.js';
import shopping from './views/shopping.js';
import rewards from './views/rewards.js';
import journeyView from './views/journey.js';
import wrapView from './views/wrap.js';
import wakeView from './views/wake.js';
import bodyView from './views/body.js';
import { organActions } from './views/body.js';
import { organById } from './engine/body.js';
import * as alarmNative from './alarm-native.js';
import { floatXp, confetti, chime, buzz, showCelebration, ringBanner } from './ui/celebrate.js';
import { newlyClosed, allClosed } from './views/dayrings.js';
import { BADGES } from './engine/game.js';
import * as notify from './notify.js';
import { closeSheet } from './ui/sheet.js';
import { sheetActions } from './views/sheets.js';
import { daySummary, readDay } from './views/day.js';

const VIEWS = { rewards, journey: journeyView, wrap: wrapView, wake: wakeView, body: bodyView, start: onboarding, today: todayView, meals, move, habits, progress, checkin, learn, settings, shopping };
// Screens without their own tab light up the tab they belong to.
const TAB_OF = { journey: 'progress', body: 'progress', rewards: 'progress', checkin: 'progress', learn: 'progress', wrap: 'progress', shopping: 'meals', wake: 'today' };
const NAV = [
  ['today', 'Today', 'today'],
  ['meals', 'Meals', 'meals'],
  ['move', 'Move', 'move'],
  ['habits', 'Habits', 'habits'],
  ['progress', 'Progress', 'progress'],
];

let state = store.load();
let saveFailing = false; // shown as a banner on every screen until saving works again
const main = document.getElementById('main');
const toastEl = document.querySelector('.toast');
let toastTimer = null;

const ctx = {
  get state() {
    return state;
  },
  set(next, { render = true, quiet = false } = {}) {
    const prevState = state;
    const before = state.profile ? store.game(state) : null;
    const after = next.profile ? store.game(next) : null;
    if (after?.newBadges.length) {
      next = { ...next, game: { ...next.game, badges: { ...next.game.badges } } };
      for (const id of after.newBadges) next.game.badges[id] = store.today();
    }
    state = next;
    setWeekStart(state.prefs?.weekStart || 0);
    if (before && after && !quiet) queueMicrotask(() => celebrate(before, after, state.game, prevState, next));
    scheduleSync();
    const saved = store.save(state);
    if (!saved && !saveFailing) ctx.toast('Couldn’t save — this device’s storage is full or blocked.');
    saveFailing = !saved;
    if (render) renderRoute();
  },
  update(fn, opts) {
    ctx.set(fn(structuredClone(state)) ?? state, opts);
  },
  go(hash) {
    closeSheet(true);
    if (location.hash === hash) renderRoute();
    else location.hash = hash;
  },
  /** Snackbar. opts.action = {label, run} adds a button (e.g. Undo). */
  toast(msg, opts = {}) {
    toastEl.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = msg;
    toastEl.append(span);
    if (opts.action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = opts.action.label;
      b.onclick = () => {
        toastEl.classList.remove('show');
        opts.action.run();
      };
      toastEl.append(b);
    }
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), opts.action ? 5000 : 3000);
  },
  /** Apply a change and offer Undo (restores the previous state exactly, without celebrations). */
  undoable(msg, fn) {
    const prev = structuredClone(state);
    ctx.update(fn);
    ctx.toast(msg, { action: { label: 'Undo', run: () => ctx.set(prev, { quiet: true }) } });
  },
  closeSheet: () => closeSheet(),
  rerender: () => renderRoute(),
  /** In-page replacement for confirm(): resolves true/false. */
  confirm(message, { ok = 'OK', danger = false } = {}) {
    return dialog({ message, ok, danger });
  },
  /** In-page replacement for prompt(): resolves the entered string, or null if cancelled. */
  ask(message, { value = '', type = 'number', ok = 'Save' } = {}) {
    return dialog({ message, ok, input: { value, type } });
  },
};

function dialog({ message, ok, danger = false, input = null }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-msg"><form>
      <p id="modal-msg"></p>
      ${input ? `<input id="modal-input" type="${input.type}" ${input.type === 'number' ? 'inputmode="numeric" min="0" max="5000"' : ''}>` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn ghost" data-x="cancel">Cancel</button><button class="btn ${danger ? 'danger-solid' : 'primary'}">${ok}</button></div></form></div>`;
    wrap.querySelector('#modal-msg').textContent = message;
    const field = wrap.querySelector('#modal-input');
    if (field) field.value = input.value;
    const prev = document.activeElement;
    const close = (val) => {
      wrap.remove();
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
      resolve(val);
    };
    const onKey = (e) => e.key === 'Escape' && close(input ? null : false);
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.dataset.x === 'cancel') close(input ? null : false);
    });
    wrap.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      close(input ? field.value : true);
    });
    document.body.appendChild(wrap);
    (field || wrap.querySelector('button.btn:not(.ghost)')).focus();
  });
}

/** Turn the difference between two reward summaries into feedback. */
function bodyUps(before, after) {
  const b = before.stats?.body?.levels || {};
  const a = after.stats?.body?.levels || {};
  return Object.keys(a).filter((id) => b[id] && a[id].level > b[id].level).map((id) => ({ id, ...a[id] }));
}

const RING_WORD = { eat: 'Eat', move: 'Move', habits: 'Habits' };

function celebrate(before, after, prefs, prevState, nextState) {
  const gained = after.xp - before.xp;
  const rings = prevState && nextState ? newlyClosed(prevState, nextState) : [];
  if (rings.length) {
    const all = allClosed(nextState);
    confetti(all ? 1.4 : 0.6);
    if (prefs.haptics) buzz(all ? [12, 40, 12, 40, 20] : [10, 30, 10]);
    ringBanner(all ? 'All three rings closed — perfect day!' : `${rings.map((r) => RING_WORD[r]).join(' + ')} ring closed!`, all ? 'var(--ring-move)' : `var(--ring-${rings[0]})`);
  }
  if (gained <= 0) {
    if (rings.length && prefs.sound) chime('quest');
    return;
  }
  const todayBefore = new Set((before.byDay[store.today()]?.awards || []).map((a) => a.key));
  const fresh = (after.byDay[store.today()]?.awards || []).filter((a) => !todayBefore.has(a.key));
  const lucky = fresh.some((a) => a.lucky);
  const perfect = fresh.some((a) => a.kind === 'perfect');
  const questsDoneBefore = before.quests.filter((q) => q.done).length;
  const questsDoneAfter = after.quests.filter((q) => q.done).length;
  const smallWin = fresh.some((a) => a.kind === 'habitSmall');
  floatXp(gained, { lucky, label: lucky ? 'lucky!' : perfect ? 'perfect day' : smallWin ? 'small win' : '' });
  if (prefs.haptics) buzz(lucky || perfect ? [12, 40, 12] : 12);
  let sound = lucky ? 'lucky' : smallWin ? 'quest' : 'tick';
  if (smallWin && !perfect) confetti(0.35);
  if (questsDoneAfter > questsDoneBefore) sound = 'quest';
  if (rings.length) sound = allClosed(nextState) ? 'badge' : 'quest';
  if (perfect) {
    confetti(1.2);
    sound = 'badge';
    toast('Perfect day! Every quest done — +25 XP bonus.');
  }
  const newBadges = after.newBadges.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);
  if (after.level > before.level) {
    sound = 'level';
    confetti(1.6);
    showCelebration({ kicker: `Level ${after.level}`, title: after.title, body: `You’ve earned ${after.xp.toLocaleString()} XP by showing up. ${(after.nextLevelAt - after.xp).toLocaleString()} XP to level ${after.level + 1}.`, iconName: 'star', ok: 'Keep going' });
  } else if (bodyUps(before, after).length) {
    const up = bodyUps(before, after)[0];
    const o = organById(up.id);
    sound = 'badge';
    confetti(1);
    showCelebration({ kicker: 'Body level up', title: `${o.emoji} ${o.name}: Level ${up.level}`, body: `${up.title}. Your consistency is paying off — keep this ring filling up week after week.`, iconName: 'star', ok: 'Nice!' });
  } else if (newBadges.length) {
    sound = 'badge';
    confetti(1);
    const b = newBadges[0];
    showCelebration({ kicker: 'Badge unlocked', title: b.name, body: `${b.how}. +${50 * newBadges.length} XP${newBadges.length > 1 ? ` (and ${newBadges.length - 1} more badge${newBadges.length > 2 ? 's' : ''})` : ''}.`, iconName: b.icon, ok: 'Nice!' });
  }
  if (prefs.sound) chime(sound);
}

function toast(msg) {
  ctx.toast(msg);
}

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] || 'today', params: parts.slice(1) };
}

function navHtml(active, kind) {
  if (kind !== 'side') active = TAB_OF[active] || active;
  const links = NAV.map(([id, label, ic]) => `<a href="#/${id}" class="${kind === 'side' ? 'nav ' : ''}${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
  if (kind === 'side') {
    const extra = [['journey', 'Journey', 'flag'], ['body', 'Your body', 'today'], ['rewards', 'Rewards', 'star'], ['checkin', 'Weekly check-in', 'calendar'], ['learn', 'The evidence', 'learn'], ['settings', 'Settings', 'settings']];
    return `<a class="brand" href="#/today"><span class="logo">HL</span>Habit Lab</a>${links}<div class="sep"></div>${extra.map(([id, label, ic]) => `<a href="#/${id}" class="nav ${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('')}<div class="spacer"></div>`;
  }
  return links;
}

function xpChip() {
  const g = store.game(state);
  if (!g) return '';
  const pct = Math.round(((g.xp - g.levelStart) / (g.nextLevelAt - g.levelStart)) * 100);
  return `<a class="xp-chip" href="#/rewards" aria-label="Level ${g.level}, ${g.xp} XP, ${g.streak}-day streak. Open rewards"><span class="lvl">Lv ${g.level}</span><span class="mini" aria-hidden="true"><span style="width:${pct}%"></span></span><span class="flame">${icon('flame')}${g.streak}</span></a>`;
}

let lastRoute = '';
function renderRoute() {
  let { name, params } = parseRoute();
  if (!state.profile && name !== 'start' && name !== 'learn') name = 'start';
  if (state.profile && name === 'start') name = 'today';
  const view = VIEWS[name] || todayView;
  // Make sure derived data (this week's plan, workout progress) exists before rendering.
  if (state.profile) {
    let s = store.ensureProgress(state);
    const { state: s2 } = store.ensurePlan(s);
    if (s2 !== state) {
      state = s2;
      store.save(state);
    }
  }
  const hasShell = !!state.profile;
  document.querySelector('.sidebar').innerHTML = hasShell ? navHtml(name, 'side') : '';
  document.querySelector('.bottomnav').innerHTML = hasShell ? navHtml(name, 'bottom') : '';
  document.querySelector('.bottomnav').style.display = hasShell ? '' : 'none';
  document.querySelector('.sidebar').style.display = hasShell ? '' : 'none';
  document.body.classList.toggle('no-nav', !hasShell);
  document.body.classList.toggle('wrap-open', (name === 'wrap' || name === 'wake') && hasShell);
  const top = hasShell
    ? `<div class="topbar no-print"><a class="brand" href="#/today" aria-label="Habit Lab home"><span class="logo">HL</span><span>Habit Lab</span></a><div class="row nowrap" style="gap:4px">${xpChip()}<a class="icon-btn" href="#/settings" aria-label="Settings">${icon('settings')}</a></div></div>`
    : '';
  const saveBanner = saveFailing && hasShell
    ? `<div class="notice warn" role="alert">${icon('alert')}<div class="grow"><strong>Changes aren’t being saved.</strong> This device’s storage is full or blocked, so anything you log now will be lost when you close the app. <a href="#/settings/data">Export a backup</a>, then free up some space.</div></div>`
    : '';
  main.innerHTML = top + saveBanner + view.render(state, params, ctx);
  view.after?.(main, ctx, params);
  const routeKey = `${name}/${params.join('/')}`;
  if (routeKey !== lastRoute) {
    window.scrollTo(0, 0);
    lastRoute = routeKey;
    document.title = `${(NAV.find((n) => n[0] === name) || [, name === 'start' ? 'Welcome' : name[0].toUpperCase() + name.slice(1)])[1]} · Habit Lab`;
  }
}

function currentView() {
  const { name } = parseRoute();
  return VIEWS[state.profile ? name : 'start'] || todayView;
}

function dispatch(kind, el, ev) {
  const name = el.dataset[kind];
  const view = currentView();
  const handler = view.actions?.[name] || GLOBAL[name];
  if (!handler) return false;
  handler(el, ev, ctx);
  return true;
}

const GLOBAL = {
  ...sheetActions,
  ...organActions,
  theme(el) {
    const t = el.dataset.value;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('habitlab.theme', t);
    } catch (e) {
      /* ignore */
    }
    ctx.rerender();
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || !(main.parentElement.contains(el) || document.querySelector('.bottomnav').contains(el) || el.closest('.sheet'))) return;
  if (dispatch('action', el, ev)) ev.preventDefault();
});
document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('form[data-form]');
  if (!form) return;
  ev.preventDefault();
  const view = currentView();
  const handler = view.actions?.[form.dataset.form] || GLOBAL[form.dataset.form];
  if (handler) handler(form, ev, ctx, formData(form));
});
// Client-side list filtering: <input data-filter="x"> filters [data-filter-target="x"] [data-filter-text].
// A search covers every item; with the box empty, items marked data-out (outside the current tab) stay hidden.
document.addEventListener('input', (ev) => {
  const key = ev.target.dataset?.filter;
  if (!key) return;
  const q = ev.target.value.trim().toLowerCase();
  for (const el of document.querySelectorAll(`[data-filter-target="${key}"] [data-filter-text]`)) el.hidden = q ? !el.dataset.filterText.includes(q) && !el.classList.contains('custom') : el.dataset.out === '1';
});
// Body Wrap: arrow keys move through the story, Escape closes it.
document.addEventListener('keydown', (ev) => {
  if (!document.body.classList.contains('wrap-open')) return;
  const sel = { ArrowRight: '.w-tap.right', ' ': '.w-tap.right', ArrowLeft: '.w-tap.left', Escape: '.w-close' }[ev.key];
  const el = sel && document.querySelector(sel);
  if (el) {
    ev.preventDefault();
    el.click();
  }
});
// Live goal suggestion in onboarding while height and weight change.
document.addEventListener('input', (ev) => {
  const form = ev.target.closest('form');
  const live = form?.querySelector('[data-live=goal]');
  if (!live || !['heightCm', 'heightFt', 'heightIn', 'weight'].includes(ev.target.name)) return;
  const u = live.dataset.units;
  const v = (n) => Number(form.querySelector(`[name=${n}]`)?.value || 0);
  const cm = u === 'imperial' ? (v('heightFt') * 12 + v('heightIn')) * 2.54 : v('heightCm');
  const kg = u === 'imperial' ? v('weight') * 0.45359237 : v('weight');
  live.innerHTML = goalHint(cm, kg, u);
});
// Live "Your day" preview while the time inputs change.
document.addEventListener('input', (ev) => {
  const form = ev.target.closest('form');
  const live = form?.querySelector('[data-live=day]');
  if (!live || !['wake', 'bed', 'firstMeal', 'lastMeal'].includes(ev.target.name)) return;
  const fd = Object.fromEntries(new FormData(form).entries());
  live.innerHTML = daySummary({ schedule: readDay(fd) });
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change]');
  if (el) dispatch('change', el, ev);
});

try {
  const t = localStorage.getItem('habitlab.theme');
  if (t && t !== 'auto') document.documentElement.setAttribute('data-theme', t);
} catch (e) {
  /* ignore */
}

// Keep scheduled reminders in step with the plan and today's progress (debounced).
let syncTimer = null;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncReminders, 800);
}
export function syncReminders() {
  if (!state.profile) return Promise.resolve(null);
  alarmNative.sync(state);
  const g = store.game(state);
  return notify.sync(state, {
    habitsOnly: store.habitsOnly(state),
    streak: g?.streak || 0,
    schedule: (date) => store.schedule(state, date).schedule[(new Date(date + 'T12:00').getDay() + 6) % 7].items,
  });
}
notify.listen();
alarmNative.listen((route) => ctx.go(route));
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && (renderRoute(), scheduleSync()));

let transitioning = false;
function navigate() {
  closeSheet(true);
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !reduce && !transitioning) {
    transitioning = true;
    const t = document.startViewTransition(renderRoute);
    // A quick second navigation skips the running transition; that's expected, not an error.
    for (const p of [t.ready, t.updateCallbackDone, t.finished]) p?.catch(() => {});
    t.finished.finally(() => (transitioning = false));
  } else renderRoute();
}
window.addEventListener('hashchange', navigate);
window.addEventListener('scroll', () => document.querySelector('.topbar')?.classList.toggle('scrolled', window.scrollY > 4), { passive: true });
renderRoute();
scheduleSync();
// Android app: recover from the native copy if the WebView's storage is empty or older.
store.nativeRestoreCandidate(state).then((restored) => {
  if (!restored) return;
  ctx.set(restored, { quiet: true });
  ctx.toast('Your saved progress was restored.');
});

// Flag when running inside a frame (e.g. an embedded preview): printing and downloads may be blocked there.
try {
  if (window.self !== window.top) document.documentElement.classList.add('framed');
} catch (e) {
  document.documentElement.classList.add('framed');
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !document.documentElement.classList.contains('framed') && notify.platform() !== 'native') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

export { ctx };
ctx.syncReminders = () => syncReminders();
ctx.syncAlarms = () => alarmNative.sync(state);
