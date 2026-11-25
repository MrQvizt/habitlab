// Rewards: level, XP, streak, badges and recent XP — plus sound/haptic settings.
import { html, esc, icon, fmtDate, progressBar } from '../ui/dom.js';
import { ring, barChart } from '../ui/charts.js';
import * as store from '../store.js';
import { BADGES, XP, levelTitle } from '../engine/game.js';
import { addDays, weekStart } from '../engine/util.js';
import { ORGANS, lastWeekStart } from '../engine/body.js';
import { ring as bodyRing } from './wrap.js';

function bodyMedals(state, g, date) {
  const lv = g.stats.body.levels;
  const hide = store.habitsOnly(state);
  const organs = ORGANS.filter((o) => !(hide && o.id === 'knees'));
  const total = organs.reduce((a, o) => a + (lv[o.id]?.level || 1), 0);
  const last = lastWeekStart(state, date);
  return `<div class="section-head"><h2>Body levels</h2><a href="#/body">Body level ${total} →</a></div>
    <div class="card"><div class="medal-wall">${organs.map((o) => `<button type="button" data-action="openOrgan" data-organ="${o.id}" class="body-medal" style="--mc:${o.color};--oc:${o.color}">
        <div class="bm-disc">${bodyRing(lv[o.id].into / lv[o.id].need, o.color, { size: 64, stroke: 6, label: o.emoji })}</div>
        <strong>${esc(o.name)}</strong><em>Level ${lv[o.id].level}</em><small>${esc(lv[o.id].title)}${lv[o.id].streak >= 2 ? ` · 🔥${lv[o.id].streak}` : ''}</small></button>`).join('')}</div>
    <p class="muted" style="font-size:var(--text-sm);margin:12px 0 0">Body parts level up with every week their ring fills — steady weeks count most. ${last && !state.wraps?.[last] ? `<a href="#/wrap/${last}">Last week’s Body Wrap is waiting (+30 XP)</a>` : ''}</p></div>`;
}

export default {
  render(state) {
    const date = store.today();
    const g = store.game(state);
    const hide = store.habitsOnly(state);
    const into = g.xp - g.levelStart;
    const need = g.nextLevelAt - g.levelStart;
    const badgeList = BADGES.filter((b) => !(hide && b.weight));
    const earned = new Set(g.badges);
    const wk = weekStart(date);
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(wk, -7 * (7 - i))).map((w) => {
      let x = 0;
      for (let d = 0; d < 7; d++) x += g.byDay[addDays(w, d)]?.xp || 0;
      return { label: `${Number(w.slice(8))}/${Number(w.slice(5, 7))}`, value: x };
    });
    const recentDays = Object.keys(g.byDay).sort().reverse().slice(0, 5);
    const sortedBadges = [...badgeList.filter((b) => earned.has(b.id)), ...badgeList.filter((b) => !earned.has(b.id))];
    const badgeCard = (b) => {
      const on = earned.has(b.id);
      const when = state.game.badges[b.id];
      return `<div class="badge-card ${on ? '' : 'locked'}" title="${esc(b.how)}"><div class="medal ${on ? '' : 'locked'}">${icon(b.icon)}</div><strong>${esc(b.name)}</strong><small>${on ? (when ? `Earned ${esc(fmtDate(when, { day: 'numeric', month: 'short' }))}` : 'Earned') : esc(b.how)}</small></div>`;
    };
    return html`<header class="page-head"><div><div class="eyebrow">Level ${g.level} · ${esc(g.title)}</div><h1>Rewards</h1></div></header>
      <p class="muted">Points for showing up — logging, moving, habits and check-ins. You never earn points for eating less or for the number on the scale: consistency is what changes weight in the long run.</p>
      <div class="card"><div class="level-hero">
        ${ring(into, need, { size: 128, label: `Lv ${g.level}`, sub: `${into.toLocaleString()}/${need.toLocaleString()} XP` })}
        <div class="grow" style="min-width:200px">
          <div class="kicker" style="text-transform:uppercase;letter-spacing:.08em;font-size:.75rem;font-weight:800;color:var(--gold)">Level ${g.level}</div>
          <h2 style="font-size:1.5rem;margin:2px 0 6px">${esc(g.title)}</h2>
          <p class="muted" style="margin:0 0 10px">${(g.nextLevelAt - g.xp).toLocaleString()} XP to level ${g.level + 1} · ${esc(levelTitle(g.level + 1))}</p>
          <div class="stats" style="grid-template-columns:repeat(3,1fr)">
            <div class="stat"><span class="v">${g.xp.toLocaleString()}</span><span class="l">total XP</span></div>
            <div class="stat"><span class="v" style="color:var(--warm)">${g.streak}</span><span class="l">day streak (best ${g.bestStreak})</span></div>
            <div class="stat"><span class="v">${g.todayXp}</span><span class="l">XP today</span></div>
          </div>
        </div></div></div>

      <div class="card"><div class="card-head"><h2>Today’s quests</h2><span class="muted" style="font-size:.86rem">All done = perfect day, +${XP.perfectDay} XP</span></div>${questsHtml(g)}</div>

      ${bodyMedals(state, g, date)}
      <div class="section-head"><h2>Badges</h2><span class="meta">${badgeList.filter((b) => earned.has(b.id)).length} of ${badgeList.length} earned</span></div>
      <div class="card">
        <div class="badges">${sortedBadges.slice(0, 6).map(badgeCard).join('')}</div>
        <details style="margin-top:12px"><summary class="btn small ghost" style="list-style:none">See all ${badgeList.length} badges</summary><div class="badges" style="margin-top:10px">${sortedBadges.slice(6).map(badgeCard).join('')}</div></details>
      </div>

      <div class="grid two">
        <div class="card"><h2>XP per week</h2>${barChart(weeks, { unit: ' XP', width: window.innerWidth < 600 ? 360 : 640, height: 190 })}</div>
        <div class="card"><h2>Recent</h2>${recentDays.length ? recentDays.map((d, i) => `<details ${i === 0 ? 'open' : ''} style="border-top:${i ? '1px solid var(--line)' : '0'};padding:8px 0"><summary class="row between nowrap" style="cursor:pointer;list-style:none"><strong style="font-size:var(--text-md)">${esc(fmtDate(d))}</strong><span class="xp" style="font-weight:750;color:var(--accent)">+${g.byDay[d].xp} XP</span></summary><ul class="list feed" style="margin-top:4px">${summarise(g.byDay[d].awards).map((a) => `<li><span>${esc(a.label)}</span><span class="xp ${a.lucky ? 'lucky' : ''}">+${a.xp}</span></li>`).join('')}</ul></details>`).join('') : '<p class="muted">Tick off a meal or a habit to earn your first XP.</p>'}</div>
      </div>

      <details class="card"><summary class="row nowrap" style="cursor:pointer;list-style:none"><strong class="grow">How to earn XP</strong>${icon('chevron')}</summary><div style="margin-top:10px">
        <table class="simple"><tr><th>Action</th><th class="right">XP</th></tr>
        ${[
          ['Log a meal you ate (planned or something else — same XP)', XP.meal],
          ['Log a skipped meal', XP.mealSkip],
          ['Log every meal in a day', XP.fullDay],
          ['Do a habit', XP.habit],
          ['Strength session', XP.strength],
          ['Cardio session', `${XP.cardioBase}–${XP.cardioMax}`],
          ['Reach your step goal', XP.steps],
          ...(hide ? [] : [['Weigh in', XP.weighIn]]),
          ['Weekly check-in', XP.checkin],
          ['Open last week’s Body Wrap', XP.wrap],
          ['Perfect day (all quests)', XP.perfectDay],
          ['Each badge', XP.badge],
          ['Lucky bonus (random, about 1 in 6 ticks)', XP.lucky],
        ].map(([a, x]) => `<tr><td>${esc(a)}</td><td class="right">+${x}</td></tr>`).join('')}</table>
        <p class="muted" style="font-size:.85rem;margin-top:8px">Your streak counts days you log anything. Missing one day doesn’t break it — missing two does. <a href="#/learn/gamification">Why points help</a></p></div></details>

`;
  },
  actions: {
    pref(el, ev, ctx) {
      ctx.update((st) => {
        st.game = { ...st.game, [el.dataset.key]: el.checked };
        return st;
      }, { quiet: true });
    },
  },
};

/** Collapse repeated award kinds into one line each (e.g. "Habit done ×3"). */
function summarise(awards) {
  const out = [];
  const seen = {};
  for (const a of awards) {
    const k = a.lucky ? 'lucky' : a.label;
    if (seen[k]) {
      seen[k].xp += a.xp;
      seen[k].n++;
    } else out.push((seen[k] = { ...a, n: 1 }));
  }
  return out.map((a) => ({ ...a, label: a.n > 1 ? `${a.label} ×${a.n}` : a.label }));
}

export function questsHtml(g) {
  const done = g.quests.filter((q) => q.done).length;
  return `<div class="quests">${g.quests.map((q) => {
    const pct = q.total ? q.progress / q.total : 0;
    const r = 13;
    const c = 2 * Math.PI * r;
    return `<a class="quest ${q.done ? 'done' : ''}" href="${q.href}"><svg class="qring" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="${r}" class="ring-bg" style="stroke-width:5"/><circle cx="17" cy="17" r="${r}" class="ring-fg" style="stroke-width:5" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 17 17)"/>${q.done ? '<path d="M11 17l4 4 8-8" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>
      <span><span class="ql">${esc(q.label)}</span><br><span class="qp">${q.done ? 'Done' : `${q.progress}/${q.total}`}</span></span></a>`;
  }).join('')}</div>${done === g.quests.length ? `<div class="perfect-banner">${icon('star')} Perfect day — every quest complete!</div>` : `<div class="muted" style="font-size:.84rem;margin-top:8px">${done} of ${g.quests.length} quests done</div>${progressBar(done, g.quests.length, { label: 'Quests', tone: 'warm' })}`}`;
}
