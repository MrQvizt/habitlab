// Good morning: the screen after "I'm up". The alarm's message, then a ten-second values
// reflection ("Today I'm doing this for…") — the kind of self-affirmation shown to engage the brain's
// self and reward systems and to make health messages land (Falk 2015, Cascio 2016).
import { esc, icon, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { VALUES, morningMessages, messageForDay } from '../data/affirmations.js';
import { takeMessage } from '../alarm-native.js';
import { XP } from '../engine/game.js';
import { confetti, chime, buzz, floatXp } from '../ui/celebrate.js';

let message = null;
let msgDate = null;
let chosen = null;

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
      chosen = null;
    }
    const affirm = state.affirm || {};
    const values = (affirm.values || []).filter((v) => VALUES[v]);
    const fav = (affirm.favs || []).includes(message);
    const done = state.wakes?.[today];
    return `<div class="wake-screen" role="dialog" aria-label="Good morning">
      <button class="w-close" data-action="wakeClose" aria-label="Close">${icon('x')}</button>
      <div class="wk-sun" aria-hidden="true"></div>
      <div class="wk-body">
        <div class="w-kicker">${esc(fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
        <h1 class="wk-hello">${greeting()}</h1>
        <p class="wk-msg">${esc(message)}</p>
        <button class="wk-heart ${fav ? 'on' : ''}" data-action="wakeFav" aria-pressed="${fav}">${fav ? '♥ Saved — you’ll see it more often' : '♡ This one helped'}</button>
        <div class="wk-reflect">
          <div class="w-kicker">Today I’m doing this for…</div>
          ${values.length
            ? `<div class="wk-values">${values.map((v) => `<button class="wk-value ${chosen === v ? 'on' : ''}" data-action="wakeValue" data-value="${v}">${esc(VALUES[v].label)}</button>`).join('')}<button class="wk-value ${chosen === 'me' ? 'on' : ''}" data-action="wakeValue" data-value="me">Me</button></div>`
            : `<div class="wk-values"><button class="wk-value ${chosen === 'me' ? 'on' : ''}" data-action="wakeValue" data-value="me">Me</button><a class="wk-value ghost" href="#/settings/alarms">Choose what matters to you →</a></div>`}
          ${chosen ? `<p class="wk-why">${esc(chosen === 'me' ? 'Good. You are reason enough.' : `Holding on to ${VALUES[chosen].phrase} today. Every good choice counts.`)}</p>` : ''}
        </div>
        ${done ? `<button class="w-btn" data-action="wakeStart">Start my day</button>` : `<button class="w-btn glow" data-action="wakeStart" ${chosen ? '' : 'disabled'}>${chosen ? `Start my day · +${XP.wake} XP` : 'Tap one to start your day'}</button>`}
      </div>
    </div>`;
  },
  actions: {
    wakeValue(el, ev, ctx) {
      chosen = el.dataset.value;
      if (ctx.state.game?.haptics !== false) buzz(10);
      ctx.rerender();
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
      if (!ctx.state.wakes?.[today]) {
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        floatXp(XP.wake, { label: 'Morning intention' });
        confetti(0.6);
        if (ctx.state.game?.sound !== false) chime('quest');
        ctx.update((st) => {
          st.wakes = { ...(st.wakes || {}), [today]: hhmm };
          return st;
        }, { render: false });
      }
      chosen = null;
      ctx.go('#/today');
    },
    wakeClose(el, ev, ctx) {
      ctx.go('#/today');
    },
  },
};
