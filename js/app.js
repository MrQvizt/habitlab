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

// Flag when running inside a frame (e.g. an embedded preview): printing and downloads may be blocked there.
try {
  if (window.self !== window.top) document.documentElement.classList.add('framed');
} catch (e) {
  document.documentElement.classList.add('framed');
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !document.documentElement.classList.contains('framed')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

export { ctx };
