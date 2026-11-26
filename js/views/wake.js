// Good morning: the screen after "I'm up". The alarm's message, then a ten-second values
// reflection ("Today I'm doing this for…") — the kind of self-affirmation shown to engage the brain's
// self and reward systems and to make health messages land (Falk 2015, Cascio 2016).
import { esc, icon, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { valueInfo, morningMessages, messageForDay, reasonLine, addReason } from '../data/affirmations.js';
import { REASONS } from '../data/reasons.js';
import { takeMessage } from '../alarm-native.js';
import { XP } from '../engine/game.js';
import { confetti, chime, buzz, floatXp } from '../ui/celebrate.js';

let message = null;
let msgDate = null;
let chosen = new Set();
let other = '';
let otherOpen = false;

// Typing your own reason updates the line and the Start button in place (a re-render would drop the keyboard).
document.addEventListener('input', (ev) => {
  if (!ev.target.matches?.('[data-wake-other]')) return;
  other = ev.target.value;
  refreshReason(document);
});

function ready() {
  return chosen.size > 0 || other.trim().length > 0;
}

function refreshReason(root) {
  const why = root.querySelector('.wk-why');
  if (why) {
    why.textContent = reasonLine([...chosen], other);
    why.hidden = !why.textContent;
  }
  const btn = root.querySelector('.w-btn[data-fresh]');
  if (btn) {
    btn.disabled = !ready();
    btn.textContent = ready() ? `Start my day · +${XP.wake} XP` : 'Tap one or more to start your day';
  }
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default {
  render(state) {
    const today = store.today();
    const handed = takeMessage();
    if (handed) message = handed;
    if (!message || msgDate !== today) {
      message = handed || messageForDay(morningMessages(state.affirm || {}));
      msgDate = today;
      chosen = new Set();
      other = '';
      otherOpen = false;
    }
    const affirm = state.affirm || {};
    const values = (affirm.values || []).filter((v) => valueInfo(v));
    const fav = (affirm.favs || []).includes(message);
    const done = state.wakes?.[today];
    return `<div class="wake-screen" role="dialog" aria-label="Good morning">
      <button class="w-close" data-action="wakeClose" aria-label="Close">${icon('x')}</button>
      <div class="wk-sun" aria-hidden="true"></div>
      <div class="wk-body">
        <div class="w-kicker">${esc(fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
        <h1 class="wk-hello">${greeting()}</h1>
        <p class="wk-msg">${esc(message)}</p>
        <button class="wk-heart ${fav ? 'on' : ''}" data-action="wakeFav" aria-pressed="${fav}">${fav ? '♥ Saved — you’ll see it more often' : '♡ This one boosted me'}</button>
        <div class="wk-reflect">
          <div class="w-kicker">Today I’m doing this for… <span class="wk-hint">pick any</span></div>
          <div class="wk-values">${values.map((v) => `<button class="wk-value ${chosen.has(v) ? 'on' : ''}" data-action="wakeValue" data-value="${esc(v)}" aria-pressed="${chosen.has(v)}">${esc(valueInfo(v).label)}</button>`).join('')}<button class="wk-value ${chosen.has('me') ? 'on' : ''}" data-action="wakeValue" data-value="me" aria-pressed="${chosen.has('me')}">Me</button>${otherOpen ? '' : `<button class="wk-value ghost" data-action="wakeOther">＋ Something else</button>`}</div>
          ${otherOpen ? `<form class="wk-add" data-form="wakeAdd"><input class="wk-other" name="reason" data-wake-other maxlength="40" placeholder="A word — e.g. Freedom" aria-label="Something else I’m doing this for" value="${esc(other)}" enterkeyhint="done"><button class="wk-add-btn">Add</button></form><p class="wk-note">Saved to your reasons, so it’s here next time.</p>` : ''}
          <a class="wk-link" href="#/settings/alarms/reasons">Browse ${REASONS.length} reasons or add your own →</a>
          <p class="wk-why" ${reasonLine([...chosen], other) ? '' : 'hidden'}>${esc(reasonLine([...chosen], other))}</p>
        </div>
        ${done ? `<button class="w-btn" data-action="wakeStart">Start my day</button>` : `<button class="w-btn glow" data-action="wakeStart" data-fresh ${ready() ? '' : 'disabled'}>${ready() ? `Start my day · +${XP.wake} XP` : 'Tap one or more to start your day'}</button>`}
      </div>
    </div>`;
  },
  actions: {
    wakeValue(el, ev, ctx) {
      const v = el.dataset.value;
      if (chosen.has(v)) chosen.delete(v);
      else chosen.add(v);
      if (ctx.state.game?.haptics !== false) buzz(10);
      ctx.rerender();
    },
    wakeAdd(form, ev, ctx, data) {
      const v = String(data.reason || '').trim();
      if (!v) return;
      ctx.update((st) => {
        st.affirm = addReason(st.affirm || {}, v);
        return st;
      }, { quiet: true, render: false });
      const lv = v.toLowerCase().replace(/\s+/g, ' ');
      chosen.add((ctx.state.affirm.values || []).find((x) => x.toLowerCase() === lv || valueInfo(x)?.label.toLowerCase() === lv) || v);
      other = '';
      otherOpen = false;
      ctx.syncAlarms?.();
      ctx.rerender();
    },
    wakeOther(el, ev, ctx) {
      otherOpen = true;
      ctx.rerender();
      document.querySelector('[data-wake-other]')?.focus();
    },
    wakeFav(el, ev, ctx) {
      const m = message;
      ctx.update((st) => {
        const favs = new Set(st.affirm?.favs || []);
        if (favs.has(m)) favs.delete(m);
        else favs.add(m);
        st.affirm = { ...(st.affirm || {}), favs: [...favs].slice(-30) };
        return st;
      }, { quiet: true });
      ctx.syncAlarms?.();
    },
    wakeStart(el, ev, ctx) {
      const today = store.today();
      if (other.trim()) {
        const v = other.trim();
        ctx.update((st) => {
          st.affirm = addReason(st.affirm || {}, v);
          return st;
        }, { quiet: true, render: false });
      }
      if (!ctx.state.wakes?.[today]) {
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        floatXp(XP.wake, { label: 'Morning intention' });
        confetti(0.6);
        if (ctx.state.game?.sound !== false) chime('quest');
        ctx.update((st) => {
          st.wakes = { ...(st.wakes || {}), [today]: hhmm };
          st.reasons = { date: today, values: [...chosen].slice(0, 20), other: other.trim().slice(0, 40) };
          return st;
        }, { render: false });
      }
      chosen = new Set();
      other = '';
      otherOpen = false;
      ctx.go('#/today');
    },
    wakeClose(el, ev, ctx) {
      ctx.go('#/today');
    },
  },
};
