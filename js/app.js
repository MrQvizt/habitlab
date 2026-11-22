// Habit Lab — app shell: routing, persistence and event delegation.
import * as store from './store.js';
import { icon, formData } from './ui/dom.js';
import onboarding from './views/onboarding.js';
import todayView from './views/today.js';
import meals from './views/meals.js';
import move from './views/move.js';
import habits from './views/habits.js';
import progress from './views/progress.js';
import checkin from './views/checkin.js';
import learn from './views/learn.js';
import settings from './views/settings.js';
import shopping from './views/shopping.js';

const VIEWS = { start: onboarding, today: todayView, meals, move, habits, progress, checkin, learn, settings, shopping };
const NAV = [
  ['today', 'Today', 'today'],
  ['meals', 'Meals', 'meals'],
  ['move', 'Move', 'move'],
  ['habits', 'Habits', 'habits'],
  ['progress', 'Progress', 'progress'],
  ['learn', 'Learn', 'learn'],
];

let state = store.load();
const main = document.getElementById('main');
const toastEl = document.querySelector('.toast');
let toastTimer = null;

const ctx = {
  get state() {
    return state;
  },
  set(next, { render = true } = {}) {
    state = next;
    if (!store.save(state)) ctx.toast('Couldn’t save — your browser is blocking storage. Export your data in Settings to keep it.');
    if (render) renderRoute();
  },
  update(fn, opts) {
    ctx.set(fn(structuredClone(state)) ?? state, opts);
  },
  go(hash) {
    if (location.hash === hash) renderRoute();
    else location.hash = hash;
  },
  toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  },
  rerender: () => renderRoute(),
};

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] || 'today', params: parts.slice(1) };
}

function navHtml(active, kind) {
  const links = NAV.map(([id, label, ic]) => `<a href="#/${id}" class="${kind === 'side' ? 'nav ' : ''}${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
  if (kind === 'side') {
    return `<a class="brand" href="#/today"><span class="logo">HL</span>Habit Lab</a>${links}<div class="spacer"></div><a href="#/checkin" class="nav ${active === 'checkin' ? 'active' : ''}">${icon('calendar')}<span>Weekly check-in</span></a><a href="#/settings" class="nav ${active === 'settings' ? 'active' : ''}">${icon('settings')}<span>Settings</span></a>`;
  }
  return links;
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
  const top = hasShell
    ? `<div class="topbar no-print"><a class="brand" href="#/today"><span class="logo">HL</span>Habit Lab</a><div class="row nowrap"><a class="btn small" href="#/checkin">${icon('calendar')}Check-in</a><a class="icon-btn" href="#/settings" aria-label="Settings">${icon('settings')}</a></div></div>`
    : '';
  main.innerHTML = top + view.render(state, params, ctx);
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
  if (!el || !main.parentElement.contains(el) && !document.querySelector('.bottomnav').contains(el)) return;
  if (dispatch('action', el, ev)) ev.preventDefault();
});
document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('form[data-form]');
  if (!form) return;
  ev.preventDefault();
  const view = currentView();
  const handler = view.actions?.[form.dataset.form];
  if (handler) handler(form, ev, ctx, formData(form));
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

window.addEventListener('hashchange', renderRoute);
renderRoute();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

export { ctx };
