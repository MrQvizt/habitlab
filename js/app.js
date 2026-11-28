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
import calendarView from './views/calendar.js';
import { calendarActions } from './views/calendar.js';
import joinView from './views/join.js';
import planView from './views/plan.js';
import sosView from './views/sos.js';
import { resetSos } from './views/sos.js';
import { organActions } from './views/body.js';
import { setOwnHabits } from './engine/habits.js';
import accountView from './views/account.js';
import inboxView from './views/inbox.js';
import { resetInbox } from './views/inbox.js';
import { afterLogin } from './views/account.js';
import * as account from './account.js';
import { organById } from './engine/body.js';
import * as alarmNative from './alarm-native.js';
import { floatXp, confetti, chime, buzz, showCelebration, ringBanner } from './ui/celebrate.js';
import { newlyClosed, allClosed } from './views/dayrings.js';
import { setViewDate } from './viewdate.js';
import { reasonLine, addReason } from './data/affirmations.js';
import * as share from './share.js';
import { BADGES } from './engine/game.js';
import * as notify from './notify.js';
import { closeSheet } from './ui/sheet.js';
import { sheetActions } from './views/sheets.js';
import { daySummary, readDay } from './views/day.js';
import youView from './views/you.js';
import { openQuickLog } from './views/quicklog.js';
import { logPlannedActivity } from './views/move.js';

const VIEWS = { you: youView, inbox: inboxView, account: accountView, sos: sosView, plan: planView, calendar: calendarView, join: joinView, rewards, journey: journeyView, wrap: wrapView, wake: wakeView, body: bodyView, start: onboarding, today: todayView, meals, move, habits, progress, checkin, learn, settings, shopping };
// Screens without their own tab light up the tab they belong to.
// Five tabs: Today · Plan · (+) · Progress · You. Screens without their own tab light up the one they belong to.
const TAB_OF = {
  journey: 'progress', body: 'progress', checkin: 'progress', wrap: 'progress',
  calendar: 'planner', meals: 'planner', move: 'planner', shopping: 'planner',
  rewards: 'progress', learn: 'progress',
  habits: 'you', settings: 'you', account: 'you', inbox: 'you',
  wake: 'today', plan: 'today', sos: 'today',
};
const NAV = [
  ['today', 'Today', 'today'],
  ['planner', 'Plan', 'plan'],
  ['+', 'Log', 'plus'],
  ['progress', 'Progress', 'progress'],
  ['you', 'You', 'user'],
];
// Plan has three parts — the day's schedule, food and movement — one tap apart.
const PLAN_TABS = [['calendar', 'Schedule'], ['meals', 'Food'], ['move', 'Move']];
const PLAN_OF = { calendar: 'calendar', meals: 'meals', shopping: 'meals', move: 'move' };
const lastPlanTab = () => {
  try {
    const t = localStorage.getItem('habitlab.planTab');
    return PLAN_TABS.some(([id]) => id === t) ? t : 'calendar';
  } catch (e) {
    return 'calendar';
  }
};
function planTabs(name, params) {
  const on = PLAN_OF[name];
  if (!on || (name === 'move' && params[0] === 'session')) return '';
  try {
    localStorage.setItem('habitlab.planTab', on);
  } catch (e) {
    /* ignore */
  }
  return `<nav class="plan-tabs no-print" aria-label="Plan">${PLAN_TABS.map(([id, label]) => `<a href="#/${id}" class="${on === id ? 'on' : ''}" ${on === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
}

let state = store.load();
let saveFailing = false; // shown as a banner on every screen until saving works again
const main = document.getElementById('main');
const toastEl = document.querySelector('.toast');
let toastTimer = null;
let toastAt = 0;

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
    account.queue(ctx); // logged in: saved to your account a few seconds later
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
    toastAt = Date.now();
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
  const links = NAV.map(([id, label, ic]) => (id === '+'
    ? `<button type="button" class="${kind === 'side' ? 'nav nav-log' : 'tab-log'}" data-action="quickLog" aria-label="Log something">${icon(ic)}${kind === 'side' ? `<span>${label}</span>` : ''}</button>`
    : `<a href="#/${id}" class="${kind === 'side' ? 'nav ' : ''}${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`)).join('');
  if (kind === 'side') {
    const extra = [['journey', 'Journey', 'flag'], ['body', 'Your body', 'today'], ['habits', 'Habits', 'habits'], ['checkin', 'Weekly check-in', 'calendar'], ['learn', 'The evidence', 'learn'], ['settings', 'Settings', 'settings']];
    return `<a class="brand" href="#/today"><span class="logo">HL</span>Habit Lab</a>${links}<div class="sep"></div>${extra.map(([id, label, ic]) => `<a href="#/${id}" class="nav ${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('')}<div class="spacer"></div>`;
  }
  return links;
}

/** Inbox in the top bar, with a count of new messages. */
function inboxBtn() {
  const n = state.share?.id ? share.unreadCount(state) : 0;
  return `<a class="icon-btn inbox-btn" href="#/inbox" aria-label="Inbox${n ? `, ${n} new` : ''}">${icon('bell')}${n ? `<span class="inbox-badge" aria-hidden="true">${n > 9 ? '9+' : n}</span>` : ''}</a>`;
}
/** Alarms one tap away: shows the next one that will ring. */
function alarmBtn() {
  return `<a class="icon-btn" href="#/settings/alarms" aria-label="Alarms">${icon('alarm')}</a>`;
}

function xpChip() {
  const g = store.game(state);
  if (!g) return '';
  const pct = Math.round(((g.xp - g.levelStart) / (g.nextLevelAt - g.levelStart)) * 100);
  return `<a class="xp-chip" href="#/rewards" aria-label="Level ${g.level}, ${g.xp} XP, ${g.streak}-day streak. Open rewards"><span class="lvl">Lv ${g.level}</span><span class="mini" aria-hidden="true"><span style="width:${pct}%"></span></span><span class="flame">${icon('flame')}${g.streak}</span></a>`;
}

let lastRoute = '';
function renderRoute() {
  setOwnHabits(state.habits?.own); // your own habits, for every screen that looks habits up
  let { name, params } = parseRoute();
  if (!state.profile && name !== 'start' && name !== 'learn' && name !== 'join' && name !== 'account') name = 'start';
  if (state.profile && name === 'start') name = 'today';
  if (name === 'planner') {
    name = lastPlanTab();
    history.replaceState(null, '', `#/${name}`);
  }
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
  const hasShell = !!state.profile && name !== 'join';
  document.querySelector('.sidebar').innerHTML = hasShell ? navHtml(name, 'side') : '';
  document.querySelector('.bottomnav').innerHTML = hasShell ? navHtml(name, 'bottom') : '';
  document.querySelector('.bottomnav').style.display = hasShell ? '' : 'none';
  document.querySelector('.sidebar').style.display = hasShell ? '' : 'none';
  document.body.classList.toggle('no-nav', !hasShell);
  document.body.classList.toggle('wrap-open', (name === 'wrap' || name === 'wake') && hasShell);
  const top = hasShell
    ? `<div class="topbar no-print"><a class="brand" href="#/today" aria-label="Habit Lab home"><span class="logo">HL</span><span>Habit Lab</span></a><div class="row nowrap" style="gap:4px">${xpChip()}${alarmBtn()}${inboxBtn()}</div></div>`
    : '';
  const saveBanner = saveFailing && hasShell
    ? `<div class="notice warn" role="alert">${icon('alert')}<div class="grow"><strong>Changes aren’t being saved.</strong> This device’s storage is full or blocked, so anything you log now will be lost when you close the app. <a href="#/settings/data">Export a backup</a>, then free up some space.</div></div>`
    : '';
  if (name !== 'today') setViewDate(null); // past-day editing belongs to Today only
  main.innerHTML = top + (hasShell ? planTabs(name, params) : '') + saveBanner + view.render(state, params, ctx);
  restoreFilter();
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
  return VIEWS[state.profile || name === 'join' || name === 'account' ? name : 'start'] || todayView;
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
  ...calendarActions,
  ...organActions,
  activityDone(el, ev, ctx) {
    logPlannedActivity(ctx, el.dataset.id);
  },
  quickLog(el, ev, ctx) {
    openQuickLog(ctx);
  },
  quickGo(el, ev, ctx) {
    ctx.go(el.dataset.href);
  },
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
let lastFilter = null; // { key, value, hash }: a search you're typing survives the screen redrawing
function applyFilter(key, value) {
  const words = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().split(/\s+/).filter(Boolean);
  for (const el of document.querySelectorAll(`[data-filter-target="${key}"] [data-filter-text]`)) el.hidden = words.length ? !words.every((w) => el.dataset.filterText.includes(w)) && !el.classList.contains('custom') : el.dataset.out === '1';
}
/** After a redraw on the same screen, put back the search you were typing. */
function restoreFilter() {
  if (!lastFilter || lastFilter.hash !== location.hash) return;
  const input = document.querySelector(`input[data-filter="${lastFilter.key}"]`);
  if (!input || input.value) return;
  input.value = lastFilter.value;
  applyFilter(lastFilter.key, lastFilter.value);
  if (lastFilter.focused) input.focus({ preventScroll: true });
}
document.addEventListener('input', (ev) => {
  const key = ev.target.dataset?.filter;
  if (!key) return;
  lastFilter = { key, value: ev.target.value, hash: location.hash, focused: true };
  applyFilter(key, ev.target.value);
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
    schedule: (date) => store.dayItems(state, date),
  });
}
notify.listen();
alarmNative.listen((route) => ctx.go(route), (w) => {
  // "Start my day" on the lock screen: record the morning (once a day) and the message you liked.
  ctx.update((st) => {
    if (!st.wakes?.[w.date]) st.wakes = { ...(st.wakes || {}), [w.date]: w.at };
    st.reasons = { date: w.date, values: w.values.slice(0, 20), other: w.other || '' };
    // Reasons typed on the lock screen join your list, so they're a choice next time.
    for (const r of w.added) st.affirm = addReason(st.affirm || {}, r);
    if (w.message) {
      const favs = new Set(st.affirm?.favs || []);
      if (w.fav) favs.add(w.message);
      else favs.delete(w.message);
      st.affirm = { ...(st.affirm || {}), favs: [...favs].slice(-30) };
    }
    return st;
  }, { render: false });
  ctx.toast(`Good morning. ${reasonLine(w.values, w.other) || 'Have a good day.'}`);
});
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && (renderRoute(), scheduleSync()));

let transitioning = false;
function navigate(ev) {
  // Opening the craving SOS from anywhere else starts it from the beginning.
  if (ev?.oldURL != null && !/#\/sos(\/|$)/.test(ev.oldURL) && /^#\/sos(\/|$)/.test(location.hash)) resetSos();
  if (ev?.oldURL != null && /#\/inbox(\/|$)/.test(ev.oldURL) && !/^#\/inbox(\/|$)/.test(location.hash)) resetInbox();
  closeSheet(true);
  // A message belongs to the screen it was about: an old one goes when you move on (Undo, and anything said about leaving, stay).
  if (!toastEl.querySelector('button') && Date.now() - toastAt > 800) toastEl.classList.remove('show');
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
// A link from an account email (confirm your address / new password) carries a login in the address.
const fromEmail = account.takeTokensFromUrl();
renderRoute();
scheduleSync();
account.onChange(() => parseRoute().name === 'account' && !document.querySelector('.sheet-wrap.open') && renderRoute());
if (fromEmail?.error) ctx.toast(fromEmail.error);
else if (fromEmail?.type === 'recovery') ctx.toast('Choose a new password');
else if (fromEmail) {
  // On a phone the email link opens the browser, not the app: with nothing here yet, say where to go next.
  if (state.profile) {
    ctx.toast('Email confirmed — you’re logged in.');
    afterLogin(ctx);
  } else {
    account.markConfirmed();
    ctx.go('#/account');
  }
} else account.start(ctx);
// Shared calendar: background notifications on the phone, and a quick in-app check every minute.
share.watch(state);
setInterval(() => document.visibilityState === 'visible' && state.share?.id && share.refresh(ctx), 60000);
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
