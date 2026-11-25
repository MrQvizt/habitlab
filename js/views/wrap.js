// Body Wrap: a short, story-style weekly recap. Each card is one body part thanking you for
// what you did, with one research fact. Tap right/left (or use the arrow keys) to move through it.
// Opening last week's wrap to the end earns XP once (derived from state.wraps in game.js).
import { esc, icon, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { weekBody, lastWeekStart } from '../engine/body.js';
import { S as SOURCES } from '../data/learn.js';
import { weekStart, addDays } from '../engine/util.js';
import { confetti, chime, buzz, floatXp } from '../ui/celebrate.js';
import { XP } from '../engine/game.js';

let idx = 0;
let lastWs = null;

/** SVG ring (Apple-style), filled to pct (can exceed 1: a second lap shows as a brighter overlay). */
export function ring(pct, color, { size = 64, stroke = 8, label = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(pct, 1));
  return `<svg class="bring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-opacity="0.22" stroke-width="${stroke}"/>
    <circle class="bring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}" data-off="${(c * (1 - p)).toFixed(2)}" data-full="${c.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${label ? `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${size * 0.36}">${label}</text>` : ''}</svg>`;
}

function weekFor(state, params, today) {
  const p = params[0];
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return weekStart(p);
  return weekStart(today);
}

function cards(state, w, today) {
  const lv = store.game(state)?.stats?.body?.levels || {};
  const p = state.profile;
  const partial = w.partial;
  const range = `${fmtDate(w.ws, { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(w.ws, 6), { day: 'numeric', month: 'short' })}`;
  const out = [];
  const n = w.earned.length;
  out.push({ kind: 'intro', c1: '#1c1c1e', c2: '#3a3a3c', html: `
    <div class="w-kicker">${partial ? 'This week so far' : 'Your Body Wrap'} · ${esc(range)}</div>
    <h1 class="w-title">${n ? `Your body sent you <span class="w-grad">${n} thank-you note${n === 1 ? '' : 's'}</span>` : 'Your body is ready for its first thank-you'}</h1>
    <div class="w-rings">${w.organs.map((o) => `<button type="button" class="w-mini" data-action="openOrgan" data-organ="${o.id}" aria-label="${esc(o.name)}">${ring(o.pct, o.color, { size: 42, stroke: 5.5, label: o.emoji })}</button>`).join('')}</div>
    <p class="w-small">${w.closed} of ${w.organs.length} rings closed${partial ? ' so far' : ''}. Tap to open →</p>` });
  for (const o of w.earned) {
    const src = SOURCES[o.src];
    out.push({ kind: 'organ', c1: o.color, c2: o.color2, html: `
      <div class="w-emoji">${o.emoji}</div>
      <div class="w-kicker">${esc(o.name)}${lv[o.id] ? ` · Level ${lv[o.id].level} ${esc(lv[o.id].title)}` : ''}</div>
      <h1 class="w-title">${esc(o.head)}</h1>
      <div class="w-big"><button type="button" class="w-ringwrap" data-action="openOrgan" data-organ="${o.id}" aria-label="What your ${esc(o.name.toLowerCase())} needs">${ring(o.pct, '#fff', { size: 92, stroke: 11 })}</button><span><b data-count="${esc(o.big)}">${esc(o.big)}</b><small>${esc(o.sub)}</small></span></div>
      <p class="w-fact">${esc(o.fact)}</p>
      <button type="button" class="w-more" data-action="openOrgan" data-organ="${o.id}">What does my ${esc(o.name.toLowerCase())} need? →</button>
      ${src ? `<a class="w-src" href="${esc(src[1])}" target="_blank" rel="noopener noreferrer">${esc(src[0])}</a>` : ''}` });
  }
  if (w.nudge) {
    out.push({ kind: 'nudge', c1: '#2c2c2e', c2: w.nudge.color, html: `
      <div class="w-emoji">${w.nudge.emoji}</div>
      <div class="w-kicker">${partial ? 'Still time this week' : 'Next week'}</div>
      <h1 class="w-title">Your ${esc(w.nudge.name.toLowerCase())} would love a little more</h1>
      <p class="w-fact">${esc(w.nudge.tip)}</p>` });
  }
  // Only last week's wrap is collectable (matches the Today card and the Monday notification); older ones are for looking back.
  const claimed = !partial && (state.wraps?.[w.ws] || w.ws !== lastWeekStart(state, today));
  out.push({ kind: 'end', c1: '#000', c2: '#1c1c1e', html: `
    <div class="w-kicker">${partial ? 'So far' : 'Week wrapped'}</div>
    <h1 class="w-title">${w.closed === w.organs.length ? 'Every ring closed. Legendary.' : n >= 4 ? 'What a week for your body.' : n ? 'Every thank-you counts.' : 'A fresh week, a fresh start.'}</h1>
    <div class="w-grid">${w.organs.map((o) => `<button type="button" class="w-cell ${o.closed ? 'closed' : ''}" data-action="openOrgan" data-organ="${o.id}">${ring(o.pct, o.color, { size: 58, stroke: 7, label: o.emoji })}<span>${esc(o.name)}</span><b>${Math.round(o.pct * 100)}%</b>${lv[o.id] ? `<em>Lv ${lv[o.id].level}</em>` : ''}</button>`).join('')}</div>
    <p class="w-small">Tap a body part to see what it needs.</p>
    <p class="w-small">You might not feel all of this yet — but it’s happening inside, week after week.</p>
    ${partial ? '<p class="w-small"><strong>Come back Monday</strong> for the full wrap and its XP.</p>' : claimed ? `<button class="w-btn" data-action="wrapClose">Done</button>` : `<button class="w-btn glow" data-action="wrapClaim">Collect +${XP.wrap} XP</button>`}` });
  return out;
}

export default {
  render(state, params) {
    const today = store.today();
    const ws = weekFor(state, params, today);
    if (ws !== lastWs) {
      idx = 0;
      lastWs = ws;
    }
    const w = weekBody(state, ws, { asOf: ws === weekStart(today) ? today : addDays(ws, 6), habitsOnly: store.habitsOnly(state) });
    const cs = cards(state, w, today);
    idx = Math.min(idx, cs.length - 1);
    const c = cs[idx];
    return `<div class="wrap-story" role="dialog" aria-label="Body Wrap" style="--c1:${c.c1};--c2:${c.c2}">
      <div class="w-bars">${cs.map((_, i) => `<span class="${i < idx ? 'done' : i === idx ? 'on' : ''}"></span>`).join('')}</div>
      <button class="w-close" data-action="wrapClose" aria-label="Close">${icon('x')}</button>
      <div class="w-card w-${c.kind}" data-i="${idx}">${c.html}</div>
      ${idx > 0 ? '<button class="w-tap left" data-action="wrapPrev" aria-label="Previous"></button>' : ''}
      ${idx < cs.length - 1 ? '<button class="w-tap right" data-action="wrapNext" aria-label="Next"></button>' : ''}
    </div>`;
  },
  after(root) {
    // Rings sweep in, numbers count up.
    const fg = root.querySelectorAll('.wrap-story .bring-fg');
    fg.forEach((el) => el.setAttribute('stroke-dashoffset', el.dataset.full));
    requestAnimationFrame(() => requestAnimationFrame(() => fg.forEach((el) => el.setAttribute('stroke-dashoffset', el.dataset.off))));
    for (const el of root.querySelectorAll('[data-count]')) {
      const m = el.dataset.count.match(/^([^\d]*)([\d,.]+)(.*)$/);
      if (!m) continue;
      const target = Number(m[2].replace(/,/g, ''));
      const dec = (m[2].split('.')[1] || '').length;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 700);
        const v = target * (1 - Math.pow(1 - k, 3));
        el.textContent = `${m[1]}${dec ? v.toFixed(dec) : Math.round(v).toLocaleString()}${m[3]}`;
        if (k < 1 && el.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    if (root.querySelector('.w-end .w-cell.closed') && idx > 0) setTimeout(() => confetti(0.6), 250);
  },
  actions: {
    wrapNext(el, ev, ctx) {
      idx++;
      if (ctx.state.game?.sound !== false) chime('tick');
      if (ctx.state.game?.haptics !== false) buzz(10);
      ctx.rerender();
    },
    wrapPrev(el, ev, ctx) {
      idx = Math.max(0, idx - 1);
      ctx.rerender();
    },
    wrapClose(el, ev, ctx) {
      idx = 0;
      ctx.go('#/today');
    },
    wrapClaim(el, ev, ctx) {
      const ws = lastWs;
      floatXp(XP.wrap, { label: 'Week wrapped' });
      confetti(1.2);
      if (ctx.state.game?.sound !== false) chime('level');
      if (ctx.state.game?.haptics !== false) buzz(30);
      ctx.update((st) => {
        st.wraps = { ...(st.wraps || {}), [ws]: store.today() };
        return st;
      });
    },
  },
};

/** Today: a gift card when last week's wrap is waiting. */
export function wrapReadyCard(state, today) {
  const ws = lastWeekStart(state, today);
  if (!ws || state.wraps?.[ws]) return '';
  const w = weekBody(state, ws, { habitsOnly: store.habitsOnly(state) });
  const n = w.earned.length;
  return `<a class="wrap-ready" href="#/wrap/${ws}">
    <span class="gift">🎁</span><span class="grow"><b>Your Body Wrap is ready</b><span>${n ? `${n} thank-you note${n === 1 ? '' : 's'} from your body` : 'See what last week did for you'} · +${XP.wrap} XP</span></span>${icon('chevron')}</a>`;
}

/** Today: live rings for this week, one per body part. */
export function bodyRingsCard(state, today) {
  const ws = weekStart(today);
  const w = weekBody(state, ws, { asOf: today, habitsOnly: store.habitsOnly(state) });
  const lv = store.game(state)?.stats?.body?.levels || {};
  return `<div class="section-head"><h2>Your body this week</h2><a href="#/body">Levels →</a></div>
    <div class="card body-rings" style="grid-template-columns:repeat(${w.organs.length},1fr)">${w.organs.map((o) => `<button type="button" class="br" data-action="openOrgan" data-organ="${o.id}" aria-label="${esc(o.name)}: ${Math.round(o.pct * 100)}% this week">${ring(o.pct, o.color, { size: 44, stroke: 5.5, label: o.emoji })}<small>${esc(o.name)}</small>${lv[o.id] ? `<b>Lv ${lv[o.id].level}</b>` : ''}</button>`).join('')}
      <a class="br-foot" href="#/wrap/${ws}">${w.closed}/${w.organs.length} rings closed · see this week’s wrap →</a></div>`;
}

