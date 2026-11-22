// Habits: active habits with if-then cues, 66-day horizon, forgiving streaks, automaticity check, library.
import { html, esc, icon, progressBar } from '../ui/dom.js';
import { habitGrid } from '../ui/charts.js';
import * as store from '../store.js';
import { HABITS, HABIT_CATEGORIES, AUTOMATICITY_ITEMS } from '../data/habits.js';
import { habitById, streak, completionRate, isEstablished, suggestNext, MAX_ACTIVE } from '../engine/habits.js';
import { daysBetween } from '../engine/util.js';

let filter = 'all';
let rating = null; // habit id being rated

function activeCard(state, a, date) {
  const h = habitById(a.id);
  const days = daysBetween(a.started, date) + 1;
  const st = streak(state.habits.log, a.id, date);
  const rate = completionRate(state.habits.log, a.id, date, 7, a.started);
  const established = isEstablished(a, state.habits.log, date);
  const on = !!state.habits.log[date]?.[a.id];
  return `<div class="card"><div class="habit-item">
      <button class="check ${on ? 'on' : ''}" data-action="toggle" data-id="${a.id}" aria-pressed="${on}" aria-label="Done today">${icon('check')}</button>
      <div class="grow"><h3 style="margin:0">${esc(h.title)}</h3>
        <form data-form="cue" class="row" style="margin:8px 0" data-id="${a.id}">
          <span class="muted" style="font-size:.9rem">My plan:</span>
          <input type="text" name="cue" value="${esc(a.cue)}" aria-label="Cue" style="flex:1;min-width:160px">
          <span class="muted" style="font-size:.9rem">→ ${esc(h.title.toLowerCase())}</span>
          <button class="btn small">Save</button>
        </form>
        <p style="font-size:.88rem" class="muted">Minimum version for hard days: <strong>${esc(h.tiny)}</strong>. ${esc(h.why)} <a href="#/learn/${esc(h.ev)}">Why this works</a></p>
        <div class="macro"><span>Day ${days}</span>${progressBar(Math.min(days, 66), 66, { label: 'Days toward 66' })}<span class="muted">of ~66</span></div>
        <div class="row" style="font-size:.88rem;margin-top:6px"><span class="tag ${st >= 3 ? 'green' : ''}">${icon('flame', 'tiny')} ${st}-day streak</span><span class="tag">${Math.round(rate * 100)}% last 7 days</span>${a.automaticity != null ? `<span class="tag">automatic: ${a.automaticity.toFixed(1)}/5</span>` : ''}${established ? '<span class="tag green">sticking</span>' : ''}</div>
        ${rating === a.id ? automaticityForm(a) : `<div class="row" style="margin-top:10px"><button class="btn small" data-action="rate" data-id="${a.id}">How automatic is it?</button>${established ? `<button class="btn small" data-action="retire" data-id="${a.id}">It’s automatic — graduate it</button>` : ''}<button class="btn small ghost danger" data-action="remove" data-id="${a.id}">Stop tracking</button></div>`}
      </div></div></div>`;
}

function automaticityForm(a) {
  return `<form data-form="automaticity" data-id="${a.id}" class="card flat" style="margin-top:10px;background:var(--surface-2)"><p style="font-size:.9rem"><strong>${esc(habitById(a.id).title)}</strong> is something…</p>
    ${AUTOMATICITY_ITEMS.map((q, i) => `<fieldset style="margin-bottom:8px"><legend style="font-weight:400;font-size:.9rem">${esc(q)}</legend><div class="segmented">${[1, 2, 3, 4, 5].map((v) => `<label style="padding:4px 8px;cursor:pointer"><input type="radio" name="q${i}" value="${v}" required ${v === 3 ? '' : ''}> ${v}</label>`).join('')}</div></fieldset>`).join('')}
    <p class="muted" style="font-size:.8rem">1 = strongly disagree, 5 = strongly agree</p>
    <div class="row"><button class="btn small primary">Save</button><button type="button" class="btn small ghost" data-action="cancelRate">Cancel</button></div></form>`;
}

export default {
  render(state) {
    const date = store.today();
    const active = state.habits.active;
    const activeIds = active.map((a) => a.id);
    const allEstablished = active.every((a) => isEstablished(a, state.habits.log, date));
    const full = active.length >= MAX_ACTIVE;
    const suggested = suggestNext(activeIds.concat(state.habits.retired.map((r) => r.id)), state.profile);
    const hideNumbers = store.habitsOnly(state);
    const library = HABITS.filter((h) => (filter === 'all' || h.cat === filter) && !activeIds.includes(h.id) && !(hideNumbers && (h.id === 'weigh_daily' || h.id === 'log_meals')));
    const names = Object.fromEntries(HABITS.map((h) => [h.id, h.title]));
    return html`<h1>Habits</h1>
      <p class="muted">Small actions, tied to something you already do, repeated until they’re automatic. One missed day doesn’t matter — just don’t miss twice.</p>
      ${active.map((a) => activeCard(state, a, date))}
      ${active.length ? `<div class="card"><h2>Last 4 weeks</h2>${habitGrid(activeIds, state.habits.log, date, 28, names)}</div>` : ''}
      <div class="card">
        <div class="card-head"><h2>Add a habit</h2><span class="muted" style="font-size:.86rem">${active.length}/${MAX_ACTIVE} active</span></div>
        ${active.length && !allEstablished ? `<div class="notice info">${icon('info')}<div>Tip: wait until your current habits feel easy (about 80% of days for 3 weeks, or rated automatic) before adding another. Adding too many at once is the most common way habits fail.</div></div>` : ''}
        ${full ? `<div class="notice warn">${icon('alert')}<div>You have ${MAX_ACTIVE} active habits. Graduate or stop one before adding more.</div></div>` : ''}
        ${suggested.length ? `<p style="font-size:.9rem"><strong>Suggested next for you:</strong> ${suggested.slice(0, 3).map((id) => esc(names[id])).join(' · ')}</p>` : ''}
        <div class="segmented" style="margin-bottom:12px">${[['all', 'All'], ...Object.entries(HABIT_CATEGORIES)].map(([k, l]) => `<button type="button" class="${filter === k ? 'on' : ''}" data-action="filter" data-value="${k}">${esc(l)}</button>`).join('')}</div>
        <details ${full ? '' : 'open'}><summary style="cursor:pointer;font-weight:600;margin-bottom:8px">${full ? 'Browse the habit library' : 'Habit library'} (${library.length})</summary>
        <ul class="list">${library.map((h) => `<li class="row between nowrap"><div class="grow"><strong>${esc(h.title)}</strong>${suggested.slice(0, 3).includes(h.id) ? ' <span class="tag green">suggested</span>' : ''}<div class="muted" style="font-size:.86rem">${esc(h.cue)} → ${esc(h.title.toLowerCase())}. ${esc(h.why)} <a href="#/learn/${esc(h.ev)}">Evidence</a></div></div><button class="btn small" data-action="add" data-id="${h.id}" ${full ? 'disabled' : ''}>${icon('plus')}Add</button></li>`).join('')}</ul></details>
      </div>
      ${state.habits.retired.length ? `<div class="card flat"><h2>Graduated habits</h2><p class="muted" style="font-size:.9rem">These became part of your routine. Keep them going without tracking.</p><ul class="list">${state.habits.retired.map((r) => `<li>${esc(names[r.id])} <span class="muted" style="font-size:.85rem">— automatic since ${esc(r.date)}</span></li>`).join('')}</ul></div>` : ''}`;
  },
  actions: {
    toggle(el, ev, ctx) {
      const date = store.today();
      const id = el.dataset.id;
      ctx.update((st) => {
        const day = { ...(st.habits.log[date] || {}) };
        day[id] ? delete day[id] : (day[id] = true);
        st.habits.log[date] = day;
        return st;
      });
    },
    cue(form, ev, ctx, data) {
      const id = form.dataset.id;
      ctx.update((st) => {
        const a = st.habits.active.find((x) => x.id === id);
        if (a) a.cue = data.cue.trim() || habitById(id).cue;
        return st;
      });
      ctx.toast('Plan saved. The more specific the cue, the better it works.');
    },
    rate(el, ev, ctx) {
      rating = el.dataset.id;
      ctx.rerender();
    },
    cancelRate(el, ev, ctx) {
      rating = null;
      ctx.rerender();
    },
    automaticity(form, ev, ctx, data) {
      const id = form.dataset.id;
      const vals = [0, 1, 2, 3].map((i) => Number(data[`q${i}`]));
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      rating = null;
      ctx.update((st) => {
        const a = st.habits.active.find((x) => x.id === id);
        if (a) a.automaticity = avg;
        return st;
      });
      ctx.toast(avg >= 4 ? 'That habit is sticking — you could add another.' : 'Keep repeating it in the same situation; it gets easier.');
    },
    retire(el, ev, ctx) {
      const id = el.dataset.id;
      ctx.update((st) => {
        st.habits.active = st.habits.active.filter((a) => a.id !== id);
        st.habits.retired = [...st.habits.retired, { id, date: store.today() }];
        return st;
      });
      ctx.toast('Graduated! Time to pick your next habit.');
    },
    async remove(el, ev, ctx) {
      if (!(await ctx.confirm('Stop tracking this habit? Your history is kept.', { ok: 'Stop tracking' }))) return;
      const id = el.dataset.id;
      ctx.update((st) => {
        st.habits.active = st.habits.active.filter((a) => a.id !== id);
        return st;
      });
    },
    add(el, ev, ctx) {
      const id = el.dataset.id;
      ctx.update((st) => {
        if (st.habits.active.length >= MAX_ACTIVE || st.habits.active.some((a) => a.id === id)) return st;
        st.habits.active.push({ id, cue: habitById(id).cue, started: store.today(), automaticity: null });
        return st;
      });
      ctx.toast('Added. Edit the cue so it matches your day.');
    },
    filter(el, ev, ctx) {
      filter = el.dataset.value;
      ctx.rerender();
    },
  },
};
