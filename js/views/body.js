// Your body: one card per body part — this week's ring, its long-term level and what it needs.
// Tap any ring (here, on Today or in the Body Wrap) to open the body-part sheet.
import { esc, icon, fmtDate } from '../ui/dom.js';
import * as store from '../store.js';
import { openSheet } from '../ui/sheet.js';
import { ORGAN_GUIDE, organById, weekBody, lastWeekStart } from '../engine/body.js';
import { S as SOURCES } from '../data/learn.js';
import { weekStart } from '../engine/util.js';

const fmtDateShort = (iso) => fmtDate(iso, { day: 'numeric', month: 'short' });
import { ring } from './wrap.js';

function data(state) {
  const today = store.today();
  const hide = store.habitsOnly(state);
  const w = weekBody(state, weekStart(today), { asOf: today, habitsOnly: hide });
  const g = store.game(state);
  return { today, hide, w, levels: g.stats.body.levels };
}

const pctLabel = (p) => `${Math.round(p * 100)}%`;

function history(lv, color) {
  const h = lv.history;
  return `<div class="bh-bars" aria-label="Last ${h.length} weeks">${h.map((x, i) => `<span title="Week of ${esc(fmtDateShort(x.ws))}: ${pctLabel(x.pct)}" style="height:${Math.max(6, Math.min(100, x.pct * 100))}%;background:${color};opacity:${i === h.length - 1 ? 1 : 0.55}"></span>`).join('')}</div>`;
}

export function organSheetHtml(state, id) {
  const { w, levels, hide } = data(state);
  const o = w.organs.find((x) => x.id === id) || { ...organById(id), pct: 0, big: '', sub: '' };
  const lv = levels[id];
  const guide = ORGAN_GUIDE[id];
  const src = SOURCES[o.src];
  const rows = guide.rows(w.stats).filter(([label]) => !(hide && /Steps/.test(label)));
  return `<div class="sheet-head organ-head" style="--oc:${o.color}"><div class="row nowrap" style="gap:14px">${ring(o.pct, o.color, { size: 64, stroke: 7, label: o.emoji })}
      <div><div class="over">${esc(o.name)} · this week ${pctLabel(o.pct)}</div><h2>Level ${lv.level} · ${esc(lv.title)}</h2></div></div>
      <button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <div class="lvl-meter" style="--oc:${o.color}"><span style="width:${Math.min(100, (lv.into / lv.need) * 100).toFixed(1)}%"></span></div>
    <div class="row between" style="font-size:var(--text-sm);margin:6px 0 2px"><span><strong>${lv.into}</strong> / ${lv.need} points to Level ${lv.level + 1}</span><span>${lv.streak >= 2 ? `🔥 ${lv.streak}-week streak` : lv.best >= 2 ? `Best streak ${lv.best} weeks` : ''}</span></div>
    <p class="muted" style="font-size:var(--text-xs);margin:0 0 12px">+${lv.thisWeekPts} points so far this week. Points come from how full the ring gets each week, plus a bonus for weeks in a row at half-full or more.</p>
    ${lv.history.length > 1 ? `<div class="al-kicker">Last ${lv.history.length} weeks</div>${history(lv, o.color)}` : ''}
    <h3 style="margin:16px 0 4px">What your ${esc(o.name.toLowerCase())} needs</h3>
    <p style="margin:0 0 10px">${esc(guide.needs)}</p>
    <div class="organ-rows">${rows.map(([label, value, target, unit]) => `<div class="organ-row"><div class="row between"><span>${esc(label)}</span><strong>${Number(value).toLocaleString()}${unit ? ` ${unit}` : ''} <span class="muted" style="font-weight:500">/ ${Number(target).toLocaleString()}</span></strong></div>
      <div class="lvl-meter thin" style="--oc:${o.color}"><span style="width:${Math.min(100, target ? (value / target) * 100 : 0).toFixed(1)}%"></span></div></div>`).join('')}</div>
    <h3 style="margin:16px 0 4px">How to help it</h3>
    <ul class="organ-tips">${guide.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <div class="organ-actions">${guide.actions.map(([label, href], i) => `<a class="btn ${i === 0 ? 'primary' : 'tonal'}" href="${href}">${esc(label)}</a>`).join('')}</div>
    <p class="organ-fact">${esc(o.fact)}${src ? ` <a href="${esc(src[1])}" target="_blank" rel="noopener noreferrer">${esc(src[0])}</a>` : ''}</p>`;
}

export const organActions = {
  openOrgan(el, ev, ctx) {
    ev?.preventDefault?.();
    const id = el.dataset.organ;
    if (!organById(id)) return;
    openSheet(organSheetHtml(ctx.state, id), { label: organById(id).name });
  },
};

export default {
  render(state) {
    const { w, levels, today } = data(state);
    const total = w.organs.reduce((a, o) => a + levels[o.id].level, 0);
    const last = lastWeekStart(state, today);
    return `<a class="btn ghost small" href="#/progress">${icon('back')}Progress</a>
      <header class="page-head"><div><div class="eyebrow">Body level ${total}</div><h1>Your body</h1></div></header>
      <p class="muted" style="margin-top:-6px">The rings show this week. Levels grow with every week you keep showing up — tap a body part to see what it needs.</p>
      <div class="body-grid">${w.organs.map((o) => {
        const lv = levels[o.id];
        return `<button type="button" class="body-tile" data-action="openOrgan" data-organ="${o.id}" style="--oc:${o.color}">
          ${ring(o.pct, o.color, { size: 58, stroke: 7, label: o.emoji })}
          <span class="bt-main"><span class="bt-name">${esc(o.name)}</span><span class="bt-lvl">Lv ${lv.level} · ${esc(lv.title)}</span>
          <span class="lvl-meter thin" style="--oc:${o.color}"><span style="width:${Math.min(100, (lv.into / lv.need) * 100).toFixed(1)}%"></span></span>
          <span class="bt-meta">${pctLabel(o.pct)} this week${lv.streak >= 2 ? ` · 🔥${lv.streak}` : ''}</span></span></button>`;
      }).join('')}</div>
      <div class="row" style="gap:8px;margin-top:4px"><a class="btn tonal" href="#/wrap/${weekStart(today)}">This week so far</a>${last ? `<a class="btn ghost" href="#/wrap/${last}">Last week’s wrap</a>` : ''}<a class="btn ghost" href="#/learn/body_wrap">The evidence</a></div>
      <details class="card" style="margin-top:14px"><summary class="row nowrap" style="cursor:pointer;list-style:none"><strong class="grow">How body levels work</strong>${icon('chevron')}</summary>
        <p style="font-size:var(--text-sm)">Each week a body part earns up to 100 points for how full its ring gets — so a steady week beats one huge week. Weeks in a row at half-full or more add a consistency bonus (+10 per week in the streak, up to +50). Level 2 takes 100 points, level 3 300, level 4 600, level 5 1,000, and so on: early levels come fast, later ones reward months of habits.</p>
        <p class="muted" style="font-size:var(--text-xs)">Levels are encouragement based on what you log. They’re not a medical measure of your organs.</p></details>`;
  },
  actions: organActions,
};

