// Habits: compact active list (tap to manage in a sheet), 4-week history, and the habit library.
import { esc, icon } from '../ui/dom.js';
import { habitGrid } from '../ui/charts.js';
import * as store from '../store.js';
import { HABITS, HABIT_CATEGORIES, AUTOMATICITY_ITEMS } from '../data/habits.js';
import { habitById, streak, completionRate, isEstablished, suggestNext, MAX_ACTIVE } from '../engine/habits.js';
import { daysBetween } from '../engine/util.js';
import { openSheet, closeSheet, updateSheet } from '../ui/sheet.js';
import { toggleHabit } from './sheets.js';

let filter = 'all';

function manageSheet(state, id, mode = '') {
  const a = state.habits.active.find((x) => x.id === id);
  const h = habitById(id);
  if (!a || !h) return '';
  const date = store.today();
  const days = daysBetween(a.started, date) + 1;
  const st = streak(state.habits.log, id, date);
  const rate = completionRate(state.habits.log, id, date, 7, a.started);
  const established = isEstablished(a, state.habits.log, date);
  if (mode === 'rate') {
    return `<div class="sheet-head"><div><div class="over">How automatic is it?</div><h2>${esc(h.title)}</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
      <form data-form="automaticity" data-id="${id}">
        <p class="muted" style="margin-top:0">This habit is something…</p>
        ${AUTOMATICITY_ITEMS.map((q, i) => `<fieldset style="margin-bottom:12px"><legend style="font-weight:600;color:var(--ink)">${esc(q)}</legend><div class="segmented" role="radiogroup">${[1, 2, 3, 4, 5].map((v) => `<label style="min-width:44px;justify-content:center;display:inline-flex;align-items:center;min-height:38px;cursor:pointer;border-radius:999px;font-weight:600"><input type="radio" name="q${i}" value="${v}" required style="position:absolute;opacity:0"><span>${v}</span></label>`).join('')}</div></fieldset>`).join('')}
        <p class="muted" style="font-size:var(--text-xs)">1 = strongly disagree · 5 = strongly agree</p>
        <button class="btn primary large block">Save</button>
      </form>`;
  }
  return `<div class="sheet-head"><div><div class="over">Habit · day ${days} of ~66</div><h2>${esc(h.title)}</h2></div><button class="icon-btn" data-action="sheetClose" aria-label="Close">${icon('x')}</button></div>
    <div class="hero-pills" style="margin-bottom:12px"><span class="pill-stat streak">${icon('flame')}${st}-day streak</span><span class="pill-stat">${Math.round(rate * 100)}% last 7 days</span>${a.automaticity != null ? `<span class="pill-stat">automatic ${a.automaticity.toFixed(1)}/5</span>` : ''}${established ? '<span class="pill-stat" style="background:var(--accent-soft);color:var(--accent)">sticking</span>' : ''}</div>
    <div class="meter" aria-label="Days toward 66"><span style="width:${Math.min(100, (days / 66) * 100).toFixed(1)}%"></span></div>
    <p class="muted" style="font-size:var(--text-sm)">Habits take about 66 days to feel automatic on average (anywhere from 3 weeks to 8 months).</p>
    <form data-form="cue" data-id="${id}" style="margin-top:14px">
      <label class="field"><span>Your plan: after I…</span><input type="text" name="cue" value="${esc(a.cue)}" maxlength="160"></label>
      <p class="muted" style="margin:-6px 0 10px;font-size:var(--text-sm)">…I will ${esc(h.title.toLowerCase())}. The more specific the moment, the better it works.</p>
      <button class="btn tonal small">Save plan</button>
    </form>
    <div class="card flat" style="margin:16px 0 0"><strong>Hard day?</strong> ${esc(h.tiny)}.<p class="muted" style="margin:6px 0 0;font-size:var(--text-sm)">${esc(h.why)} <a href="#/learn/${esc(h.ev)}">Why this works</a></p></div>
    <div class="actions-grid">
      <button class="btn" data-action="rate" data-id="${id}">How automatic is it?</button>
      ${established ? `<button class="btn primary" data-action="retire" data-id="${id}">Graduate it</button>` : `<button class="btn" data-action="remove" data-id="${id}">Stop tracking</button>`}
      ${established ? `<button class="btn ghost danger full" data-action="remove" data-id="${id}">Stop tracking</button>` : ''}
    </div>`;
}

export default {
  render(state) {
    const date = store.today();
    const active = store.visibleHabits(state);
    const activeIds = state.habits.active.map((a) => a.id);
    const allEstablished = active.every((a) => isEstablished(a, state.habits.log, date));
    const full = state.habits.active.length >= MAX_ACTIVE;
    const suggested = suggestNext(activeIds.concat(state.habits.retired.map((r) => r.id)), state.profile).slice(0, 3);
    const hideNumbers = store.habitsOnly(state);
    const retiredIds = state.habits.retired.map((r) => r.id);
    const library = HABITS.filter((h) => (filter === 'all' || h.cat === filter) && !activeIds.includes(h.id) && !retiredIds.includes(h.id) && !(hideNumbers && (h.id === 'weigh_daily' || h.id === 'log_meals')));
    const names = Object.fromEntries(HABITS.map((h) => [h.id, h.title]));
    const log = state.habits.log[date] || {};
    const rows = active.map((a) => {
      const h = habitById(a.id);
      const on = !!log[a.id];
      const days = daysBetween(a.started, date) + 1;
      const st = streak(state.habits.log, a.id, date);
      return `<li><div class="lrow ${on ? 'done' : ''}">
        <button class="check ${on ? 'on' : ''}" data-action="toggle" data-id="${a.id}" aria-pressed="${on}" aria-label="${esc(h.title)} done today">${icon('check')}</button>
        <button class="body row-btn" data-action="manage" data-id="${a.id}"><div class="title"><span>${esc(h.title)}</span></div><div class="sub">After ${esc(a.cue.replace(/^after\s+/i, ''))}</div>
          ${days > 66 ? `<span class="sub" style="display:block;color:var(--accent);font-weight:650;margin-top:4px">Habit formed ✓ · ${st}-day streak</span>` : `<span class="meter" style="display:block;height:5px;margin:8px 0 2px"><span style="width:${Math.min(100, (days / 66) * 100).toFixed(1)}%"></span></span><span class="sub" style="display:block;font-size:var(--text-xs)">Day ${days} of ~66 · ${st}-day streak</span>`}</button></div></li>`;
    }).join('');
    const libRows = library.map((h) => `<li><div class="lrow"><span class="body"><span class="title" style="display:block">${esc(h.title)}${suggested.includes(h.id) ? ' <span class="tag" style="background:var(--accent-soft);color:var(--accent);vertical-align:2px">suggested</span>' : ''}</span><span class="sub" style="display:block">${esc(h.cue)} · <a href="#/learn/${esc(h.ev)}">evidence</a></span></span>
      <button class="btn small ${full ? '' : 'tonal'}" data-action="add" data-id="${h.id}" ${full ? 'disabled' : ''} aria-label="Add ${esc(h.title)}">${icon('plus')}Add</button></div></li>`).join('');
    const libraryBlock = () => `<div class="scroll-x" style="margin-bottom:10px">${[['all', 'All'], ...Object.entries(HABIT_CATEGORIES)].map(([k, l]) => `<button type="button" class="qchip ${filter === k ? 'done' : ''}" style="padding-left:12px" data-action="filter" data-value="${k}" aria-pressed="${filter === k}">${esc(l)}</button>`).join('')}</div>
      <div class="card tight" style="${full ? 'box-shadow:none;margin:0' : ''}"><ul class="rows">${libRows || '<li class="empty-state">Nothing else in this category.</li>'}</ul></div>`;
    return `<header class="page-head"><div><div class="eyebrow">${state.habits.active.length} of ${MAX_ACTIVE} active</div><h1>Habits</h1></div></header>
      <p class="muted" style="margin:-8px 0 14px">Small actions tied to something you already do. One missed day doesn’t matter — just don’t miss twice.</p>
      ${active.length ? `<div class="card tight"><ul class="rows">${rows}</ul></div>` : `<div class="card empty-state">${icon('habits')}<strong>No active habits</strong>Pick one small habit from the library below.</div>`}
      ${active.length ? `<div class="section-head"><h2>Last 4 weeks</h2></div><div class="card">${habitGrid(active.map((a) => a.id), state.habits.log, date, 28, names)}</div>` : ''}
      ${full ? `<details class="card" style="margin-top:22px"><summary class="row nowrap" style="cursor:pointer;list-style:none"><span class="slot-ico">${icon('plus')}</span><span class="grow"><strong>Browse habits (${library.length})</strong><span style="display:block;font-size:var(--text-sm);color:var(--ink-3)">All 3 slots are in use — graduate or stop one to add another</span></span>${icon('chevron')}</summary><div style="margin-top:12px">${libraryBlock()}</div></details>`
        : `<div class="section-head"><h2>Add a habit</h2><span class="meta">${active.length && !allEstablished ? 'Add one when the current ones feel easy' : 'Start with one or two'}</span></div>${libraryBlock()}`}
      ${state.habits.retired.length ? `<div class="section-head"><h2>Graduated</h2><span class="meta">part of your routine now</span></div><div class="card tight"><ul class="rows">${state.habits.retired.map((r) => `<li><div class="lrow"><span class="check on" aria-hidden="true">${icon('check')}</span><span class="body"><span class="title" style="display:block">${esc(names[r.id])}</span><span class="sub" style="display:block">Automatic since ${esc(r.date)}</span></span></div></li>`).join('')}</ul></div>` : ''}`;
  },
  actions: {
    toggle(el, ev, ctx) {
      toggleHabit(ctx, el.dataset.id);
    },
    manage(el, ev, ctx) {
      openSheet(manageSheet(ctx.state, el.dataset.id), { label: 'Manage habit' });
    },
    cue(form, ev, ctx, data) {
      const id = form.dataset.id;
      ctx.update((st) => {
        const a = st.habits.active.find((x) => x.id === id);
        if (a) a.cue = data.cue.trim() || habitById(id).cue;
        return st;
      });
      updateSheet(manageSheet(ctx.state, id));
      ctx.toast('Plan saved');
    },
    rate(el, ev, ctx) {
      updateSheet(manageSheet(ctx.state, el.dataset.id, 'rate'));
    },
    automaticity(form, ev, ctx, data) {
      const id = form.dataset.id;
      const vals = [0, 1, 2, 3].map((i) => Number(data[`q${i}`]));
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      ctx.update((st) => {
        const a = st.habits.active.find((x) => x.id === id);
        if (a) a.automaticity = avg;
        return st;
      });
      updateSheet(manageSheet(ctx.state, id));
      ctx.toast(avg >= 4 ? 'It’s sticking — you could add another habit.' : 'Keep repeating it in the same moment; it gets easier.');
    },
    retire(el, ev, ctx) {
      const id = el.dataset.id;
      closeSheet();
      ctx.undoable('Graduated! Pick your next habit.', (st) => {
        st.habits.active = st.habits.active.filter((a) => a.id !== id);
        st.habits.retired = [...st.habits.retired, { id, date: store.today() }];
        return st;
      });
    },
    remove(el, ev, ctx) {
      const id = el.dataset.id;
      closeSheet();
      ctx.undoable('Stopped tracking — history kept', (st) => {
        st.habits.active = st.habits.active.filter((a) => a.id !== id);
        return st;
      });
    },
    add(el, ev, ctx) {
      const id = el.dataset.id;
      ctx.undoable(`Added: ${habitById(id).title}`, (st) => {
        if (st.habits.active.length >= MAX_ACTIVE || st.habits.active.some((a) => a.id === id)) return st;
        st.habits.active.push({ id, cue: habitById(id).cue, started: store.today(), automaticity: null });
        return st;
      });
    },
    filter(el, ev, ctx) {
      filter = el.dataset.value;
      ctx.rerender();
    },
  },
};
