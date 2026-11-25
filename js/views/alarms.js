// Settings → Alarms & wake-up: a clock-app style page. Changes apply immediately.
import { esc, icon } from '../ui/dom.js';
import { alarmsOf, alarmTimes, mealSlots, STYLES, fmtTime } from '../engine/alarms.js';
import { daySchedule, mealTimes } from '../engine/schedule.js';
import { VALUES, MESSAGE_SETS, DEFAULT_SETS, MAX_VALUES, valueInfo, morningMessages, messageForDay } from '../data/affirmations.js';
import * as alarmNative from '../alarm-native.js';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const sw = (path, on, label) => `<label class="switch"><input type="checkbox" data-change="alarmSet" data-path="${path}" ${on ? 'checked' : ''} aria-label="${esc(label)}"><span></span></label>`;
const styleSeg = (path, cur) => `<div class="segmented small">${Object.entries(STYLES).map(([k, s]) => `<button type="button" class="${cur === k ? 'on' : ''}" data-action="alarmStyle" data-path="${path}" data-value="${k}" title="${esc(s.hint)}">${s.label}</button>`).join('')}</div>`;

export function alarmsSummary(state) {
  const a = alarmsOf(state);
  const t = alarmTimes(state);
  const on = [a.wake.on && `wake ${fmtTime(t.wake)}`, a.wind.on && 'wind-down', a.bed.on && 'bedtime', a.meals.on && 'meals'].filter(Boolean);
  return on.length ? on.join(' · ') : 'Off';
}

export function alarmsPage(state) {
  const a = alarmsOf(state);
  const t = alarmTimes(state);
  const d = daySchedule(state.profile);
  const native = alarmNative.available();
  const affirm = state.affirm || {};
  const sets = affirm.sets || DEFAULT_SETS;
  const msgs = morningMessages(affirm);
  const tomorrow = new Date(Date.now() + 86400000);
  const slots = mealSlots(state, a.meals.snacks);
  const mt = mealTimes(state.profile, slots);
  const card = (inner, cls = '') => `<div class="card alarm-card ${cls}">${inner}</div>`;
  return `
    ${native ? '<div id="alarm-status"></div>' : `<div class="notice info">${icon('info')}<div>Alarms ring in the <strong>Android app</strong>, even when it’s closed or the phone is on silent. In a browser you can set them up here, and they’ll start once you open the app on your phone.</div></div>`}
    ${card(`<div class="row between nowrap"><div class="grow"><div class="al-kicker">Wake up</div>
        <input class="al-time" type="time" value="${fmtTime(t.wake)}" data-change="alarmTime" aria-label="Wake-up time"></div>${sw('wake.on', a.wake.on, 'Wake-up alarm')}</div>
      <div class="al-days" role="group" aria-label="Days">${DAYS.map((l, i) => `<button type="button" class="al-day ${a.wake.days.includes(i) ? 'on' : ''}" data-action="alarmDay" data-day="${i}" aria-pressed="${a.wake.days.includes(i)}" aria-label="${DAY_NAMES[i]}">${l}</button>`).join('')}</div>
      <div class="row between" style="margin-top:12px">${styleSeg('wake.style', a.wake.style)}${native && a.wake.on ? `<button class="btn small tonal" data-action="alarmTest" data-id="wake">Test in 5 s</button>` : ''}</div>
      <p class="al-note">A soft melody that grows louder over a minute, a sunrise screen that slowly brightens, and a kind message to start the day. ${a.wake.days.length === 7 ? 'Same time every day — a regular wake time helps your body clock.' : 'Tip: the same time every day, weekends too, keeps your body clock steady.'}</p>`, a.wake.on ? 'on' : '')}
    ${card(`<div class="row between nowrap"><div class="grow"><div class="al-kicker">Wind down</div><div class="al-time small">${fmtTime(t.wind)}</div></div>${sw('wind.on', a.wind.on, 'Wind-down reminder')}</div>
      <div class="row between" style="margin-top:8px"><label class="row nowrap" style="gap:8px;font-size:var(--text-sm)"><select data-change="alarmBefore" aria-label="Minutes before bed">${[30, 45, 60, 90].map((m) => `<option value="${m}" ${a.wind.before === m ? 'selected' : ''}>${m} min</option>`).join('')}</select> before bed</label>${styleSeg('wind.style', a.wind.style)}</div>
      <p class="al-note">Time to dim the lights and put screens away: bright screens before bed delay sleep and leave you groggier the next morning.</p>`, a.wind.on ? 'on' : '')}
    ${card(`<div class="row between nowrap"><div class="grow"><div class="al-kicker">Bedtime</div><div class="al-time small">${fmtTime(d.bed)}</div></div>${sw('bed.on', a.bed.on, 'Bedtime alarm')}</div>
      <div class="row between" style="margin-top:8px"><a href="#/settings/day" style="font-size:var(--text-sm)">Change your sleep window</a>${styleSeg('bed.style', a.bed.style)}</div>
      <p class="al-note">About ${(d.sleepMinutes / 60).toFixed(1)} hours until your alarm. People who slept longer ate less the next day.</p>`, a.bed.on ? 'on' : '')}
    ${card(`<div class="row between nowrap"><div class="grow"><div class="al-kicker">Meals</div><div class="al-meals">${slots.filter((s) => mt[s] != null).map((s) => `<span>${fmtTime(mt[s])}</span>`).join('')}</div></div>${sw('meals.on', a.meals.on, 'Meal alarms')}</div>
      <div class="row between" style="margin-top:8px"><label class="row nowrap" style="gap:8px;font-size:var(--text-sm)"><input type="checkbox" data-change="alarmSet" data-path="meals.snacks" ${a.meals.snacks ? 'checked' : ''}> Snacks too</label>${styleSeg('meals.style', a.meals.style)}</div>
      <p class="al-note">From your day schedule, so meals come at regular times.</p>`, a.meals.on ? 'on' : '')}
    <p class="muted" style="font-size:var(--text-sm)">Times come from <a href="#/settings/day">Your day</a>. Quiet nudges to log meals and keep your streak are in <a href="#/settings/reminders">Reminders</a>.</p>
    <div class="card"><label class="row between nowrap" style="font-size:var(--text-sm)"><span>Snooze length</span><select data-change="alarmSnooze">${[5, 9, 10, 15].map((m) => `<option value="${m}" ${a.snooze === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label></div>

    <div class="section-head"><h2>Morning messages</h2><a href="#/learn/morning_mind">Why it works</a></div>
    <div class="card morning-card">
      <div class="al-kicker">Tomorrow you’ll wake up to</div>
      <p class="morning-preview">“${esc(messageForDay(msgs, tomorrow))}”</p>
      <a class="btn small ghost" href="#/wake">See the good-morning screen</a>
    </div>
    <div class="card">
      <h3 style="margin-top:0">What matters most to you?</h3>
      <p class="muted" style="font-size:var(--text-sm);margin-top:-4px">Pick up to ${MAX_VALUES}, or add your own. Reflecting on your own values is the form of self-affirmation shown in brain scans to engage reward and self-related areas — and to help people become more active.</p>
      <div class="chips">${Object.entries(VALUES).map(([k, v]) => `<label class="chip"><input type="checkbox" data-change="affirmValue" value="${k}" ${(affirm.values || []).includes(k) ? 'checked' : ''}><span>${esc(v.label)}</span></label>`).join('')}${(affirm.values || []).filter((v) => !VALUES[v]).map((v) => `<label class="chip own"><input type="checkbox" data-change="affirmValue" value="${esc(v)}" checked><span>${esc(valueInfo(v).label)}</span></label>`).join('')}</div>
      <form class="own-value" data-form="affirmAddValue"><input type="text" name="value" maxlength="30" placeholder="Add your own — e.g. My kids, Painting, Being present" aria-label="Add your own value"><button class="btn small tonal" ${(affirm.values || []).length >= MAX_VALUES ? 'disabled title="Untick one first"' : ''}>Add</button></form>
      ${(affirm.values || []).some((v) => !VALUES[v]) ? `<p class="muted" style="font-size:var(--text-xs);margin:6px 0 0">Untick your own value to remove it.</p>` : ''}
      <label class="field" style="margin-top:14px"><span>Your “why” <span class="hint">Finish the sentence: I’m doing this…</span></span><input type="text" maxlength="120" data-change="affirmWhy" value="${esc(affirm.why || '')}" placeholder="to have energy to play with my kids"></label>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Kinds of messages</h3>
      <div class="options">${Object.entries(MESSAGE_SETS).map(([k, s]) => `<label class="option"><input type="checkbox" data-change="affirmSet" value="${k}" ${sets.includes(k) ? 'checked' : ''}><div><strong>${esc(s.label)}</strong><small class="muted">${esc(s.hint)}</small><small class="muted" style="font-style:italic">“${esc(s.lines[0].replace(/\{[^}]+\}/g, '…'))}”</small></div></label>`).join('')}</div>
      <label class="field" style="margin-top:14px"><span>Your own words <span class="hint">One per line — they come up more often. A note from your future self works well.</span></span><textarea rows="3" maxlength="1200" data-change="affirmCustom" placeholder="You’ve got this.">${esc((affirm.custom || []).join('\n'))}</textarea></label>
      ${(affirm.favs || []).length ? `<p class="muted" style="font-size:var(--text-sm)">♥ ${affirm.favs.length} saved favourite${affirm.favs.length === 1 ? '' : 's'} — shown more often. <button class="btn small ghost" data-action="affirmClearFavs">Clear</button></p>` : ''}
    </div>`;
}

export async function alarmsAfter(root) {
  const el = root.querySelector('#alarm-status');
  if (!el) return;
  const s = await alarmNative.status();
  if (!s) return;
  const issues = [];
  if (!s.notifications) issues.push(['notifications', 'Notifications are off for Habit Lab, so alarms can’t show.', 'Turn on']);
  if (!s.exact) issues.push(['exact', 'Exact alarms aren’t allowed, so alarms may be late.', 'Allow']);
  if (!s.fullScreen) issues.push(['fullScreen', 'Full-screen alarms aren’t allowed, so the wake screen won’t open over the lock screen.', 'Allow']);
  el.innerHTML = `${issues.map(([k, text, btn]) => `<div class="notice warn">${icon('alert')}<div class="grow">${esc(text)}</div><button class="btn small" data-action="alarmPerm" data-which="${k}">${btn}</button></div>`).join('')}
    ${s.next ? `<div class="notice ok">${icon('clock')}<div class="grow">Next alarm: <strong>${esc(new Date(s.next).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}</strong></div></div>` : ''}
    ${s.count ? `<p class="muted" style="font-size:var(--text-xs);margin:-4px 0 10px">If alarms ever don’t ring, check that battery optimisation isn’t restricting Habit Lab. <button class="btn small ghost" data-action="alarmPerm" data-which="battery">Battery settings</button></p>` : ''}`;
}

const setPath = (st, path, value) => {
  const [k, f] = path.split('.');
  st.alarms = { ...(st.alarms || {}) };
  st.alarms[k] = { ...(st.alarms[k] || {}), [f]: value };
};

const save = (ctx, fn) => ctx.update((st) => {
  fn(st);
  return st;
}, { quiet: true });

export const alarmActions = {
  alarmSet(el, ev, ctx) {
    const path = el.dataset.path;
    const on = el.checked;
    save(ctx, (st) => {
      setPath(st, path, on);
      // Turning the wake alarm on for the first time takes the time from "Your day".
      if (path === 'wake.on' && on && !st.alarms.wake.time) st.alarms.wake.time = fmtTime(daySchedule(st.profile).wake);
    });
    if (on && path.endsWith('.on')) ctx.toast(alarmNative.available() ? 'Alarm on' : 'Saved — it will ring in the Android app');
  },
  alarmTime(el, ev, ctx) {
    if (!/^\d{2}:\d{2}$/.test(el.value)) return;
    save(ctx, (st) => {
      setPath(st, 'wake.time', el.value);
      setPath(st, 'wake.on', true);
    });
  },
  alarmDay(el, ev, ctx) {
    const day = Number(el.dataset.day);
    save(ctx, (st) => {
      const cur = new Set(alarmsOf(st).wake.days);
      if (cur.has(day)) cur.delete(day);
      else cur.add(day);
      if (!cur.size) return;
      setPath(st, 'wake.days', [...cur].sort());
    });
  },
  alarmStyle(el, ev, ctx) {
    save(ctx, (st) => setPath(st, el.dataset.path, el.dataset.value));
  },
  alarmBefore(el, ev, ctx) {
    save(ctx, (st) => setPath(st, 'wind.before', Number(el.value)));
  },
  alarmSnooze(el, ev, ctx) {
    save(ctx, (st) => {
      st.alarms = { ...(st.alarms || {}), snooze: Number(el.value) };
    });
  },
  async alarmTest(el, ev, ctx) {
    await alarmNative.sync(ctx.state);
    const ok = await alarmNative.test(el.dataset.id, 5);
    ctx.toast(ok ? 'Ringing in 5 seconds — lock your phone to see the wake screen' : 'Couldn’t start a test alarm');
  },
  alarmPerm(el) {
    alarmNative.openSettings(el.dataset.which);
  },
  affirmValue(el, ev, ctx) {
    const picked = [...document.querySelectorAll('[data-change=affirmValue]:checked')].map((x) => x.value);
    if (picked.length > MAX_VALUES) {
      el.checked = false;
      return ctx.toast(`Pick up to ${MAX_VALUES} — the ones that matter most`);
    }
    save(ctx, (st) => {
      st.affirm = { ...(st.affirm || {}), values: picked };
    });
  },
  affirmAddValue(form, ev, ctx, data) {
    const v = String(data.value || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!v) return;
    const cur = ctx.state.affirm?.values || [];
    if (cur.some((x) => valueInfo(x).label.toLowerCase() === valueInfo(v).label.toLowerCase())) return ctx.toast('Already on your list');
    if (cur.length >= MAX_VALUES) return ctx.toast(`You have ${MAX_VALUES} already — untick one to add this`);
    // A typed preset ("family") just ticks the preset.
    const preset = Object.entries(VALUES).find(([, x]) => x.label.toLowerCase() === v.toLowerCase())?.[0];
    save(ctx, (st) => {
      st.affirm = { ...(st.affirm || {}), values: [...cur, preset || v] };
    });
    ctx.toast(`Added “${valueInfo(preset || v).label}”`);
  },
  affirmWhy(el, ev, ctx) {
    save(ctx, (st) => {
      st.affirm = { ...(st.affirm || {}), why: el.value.trim().slice(0, 120) };
    });
  },
  affirmSet(el, ev, ctx) {
    const picked = [...document.querySelectorAll('[data-change=affirmSet]:checked')].map((x) => x.value);
    if (!picked.length) {
      el.checked = true;
      return ctx.toast('Keep at least one kind of message');
    }
    save(ctx, (st) => {
      st.affirm = { ...(st.affirm || {}), sets: picked };
    });
  },
  affirmCustom(el, ev, ctx) {
    const lines = el.value.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20);
    save(ctx, (st) => {
      st.affirm = { ...(st.affirm || {}), custom: lines };
    });
  },
  affirmClearFavs(el, ev, ctx) {
    save(ctx, (st) => {
      st.affirm = { ...(st.affirm || {}), favs: [] };
    });
  },
};

