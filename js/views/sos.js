// Craving SOS (#/sos): first a reminder of why you're doing this (this morning's reasons), then
// a 1–4 minute exercise to ride the craving out, then "how is it now?". No food is ever named
// or shown, and eating anyway is met without blame.
//
// Evidence for the tools:
// - Visual tasks crowd out the mental images cravings run on (elaborated intrusion theory):
//   3 minutes of a visual puzzle game cut craving strength by about a fifth, in the lab and in
//   daily life (Skorka-Brown 2014, 2015); a hand-held visual-noise task reduced cravings and
//   craving-related eating (Kemps & Tiggemann 2013).
// - A 15-minute brisk walk reduced urges for chocolate during and after (Taylor & Oliver 2009).
// - Stepping back from craving thoughts ("defusion", urge surfing) reduced how much people ate,
//   though not always the craving itself (Jenkins & Tapper 2014); app-based mindfulness training
//   reduced craving-related eating (Mason 2018).
// - Slow breathing and a minute with eyes closed are gentle ways to pause before deciding.
import { esc, icon } from '../ui/dom.js';
import * as store from '../store.js';
import { valueInfo, reasonLine } from '../data/affirmations.js';
import { chime, confetti, buzz } from '../ui/celebrate.js';

export const TOOLS = {
  puzzle: { emoji: '🧩', title: 'Tile puzzle', min: 3, why: 'A visual puzzle crowds out the picture in your head that keeps the craving going.' },
  breathe: { emoji: '🌬️', title: 'Slow breathing', min: 1, why: 'Breathe in for 4, out for 6. Slower breathing helps you pause before deciding.' },
  eyes: { emoji: '😌', title: 'One minute, eyes closed', min: 1, why: 'Close your eyes, let thoughts pass like clouds. A soft chime tells you when the minute is up.' },
  surf: { emoji: '🌊', title: 'Surf the urge', min: 2, why: 'Cravings rise, peak and fade like a wave. Watch it instead of obeying it.' },
  picture: { emoji: '🏞️', title: 'Picture a place', min: 2, why: 'Imagining somewhere you love, in detail, takes up the same mental space the craving needs.' },
  walk: { emoji: '🚶', title: 'Walk it off', min: 10, why: 'A brisk walk lowered urges during the walk and for a while after. Even 10 minutes helps.' },
  water: { emoji: '💧', title: 'A glass of water', min: 1, why: 'Thirst can feel like hunger. Drink a full glass slowly, then check in again.' },
};

const SURF = ['Notice where you feel the craving — mouth, stomach, chest, hands.', 'Rate it from 1 to 10. Just notice the number.', 'Breathe into that spot. You don’t have to do anything about it.', 'Watch it change. Is it stronger, weaker, moving?', 'It’s a wave: it builds, peaks and falls. You’re riding it.', 'Notice: you’ve been feeling it and nothing happened. You chose.'];
const PICTURE = ['Choose a place you love — a beach, a forest, a room from childhood.', 'What do you see? Colours, light, shapes.', 'What can you hear there?', 'Feel the air on your skin. Warm or cool?', 'Walk a few steps further into it. What’s there?', 'Stay a little longer. Notice how the craving has changed.'];

let tool = null; // running tool id
let phase = 'pick'; // pick | run | after | done
let timer = null;
let endsAt = 0;
let tiles = [];

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** This morning's reasons, else your saved ones. */
function reasonsHtml(state) {
  const today = store.today();
  const r = state.reasons?.date === today ? state.reasons : null;
  const saved = (state.affirm?.values || []).filter((v) => valueInfo(v));
  if (r && (r.values.length || r.other)) {
    return `<p class="sos-kicker">This morning you said</p><p class="sos-why">${esc(reasonLine(r.values, r.other) || 'You are reason enough.')}</p>`;
  }
  if (saved.length) return `<p class="sos-kicker">Remember why you started</p><p class="sos-why">${esc(reasonLine(saved.slice(0, 4)))}</p>`;
  if (state.affirm?.why) return `<p class="sos-kicker">Remember why you started</p><p class="sos-why">“${esc(state.affirm.why)}”</p>`;
  return `<p class="sos-kicker">Remember</p><p class="sos-why">You started this for a reason. A craving is a feeling, not an order.</p>`;
}

// ---------- tile puzzle (3×3 sliding tiles) ----------
function shuffleTiles() {
  tiles = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let blank = 8;
  let prev = -1;
  for (let i = 0; i < 60; i++) {
    const r = Math.floor(blank / 3);
    const c = blank % 3;
    const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => y >= 0 && y < 3 && x >= 0 && x < 3).map(([y, x]) => y * 3 + x).filter((p) => p !== prev);
    const pick = opts[Math.floor(Math.random() * opts.length)];
    [tiles[blank], tiles[pick]] = [tiles[pick], tiles[blank]];
    prev = blank;
    blank = pick;
  }
  if (tiles.join() === '1,2,3,4,5,6,7,8,0') shuffleTiles();
}
const solved = () => tiles.join() === '1,2,3,4,5,6,7,8,0';
const puzzleHtml = () => `<div class="sos-puzzle" role="group" aria-label="Tile puzzle: put the tiles in order 1 to 8">${tiles.map((t, i) => (t ? `<button class="sos-tile t${t}" data-action="sosTile" data-i="${i}" aria-label="Tile ${t}">${t}</button>` : '<span class="sos-tile blank" aria-hidden="true"></span>')).join('')}</div>
  <p class="muted" style="font-size:var(--text-sm);text-align:center">Tap a tile next to the gap to slide it. Put them in order 1–8.</p>`;

function runHtml() {
  const t = TOOLS[tool];
  const left = endsAt - Date.now();
  let body = '';
  if (tool === 'puzzle') body = puzzleHtml();
  else if (tool === 'breathe') body = '<div class="sos-breath" aria-hidden="true"><span></span></div><p class="sos-step" data-breath>Breathe in…</p>';
  else if (tool === 'eyes') body = '<div class="sos-eyes" aria-hidden="true">😌</div><p class="sos-step">Close your eyes. Let thoughts come and go. You’ll hear a soft chime.</p>';
  else if (tool === 'surf' || tool === 'picture') body = `<p class="sos-step big" data-prompt>${esc((tool === 'surf' ? SURF : PICTURE)[0])}</p>`;
  else if (tool === 'walk') body = '<div class="sos-eyes" aria-hidden="true">🚶</div><p class="sos-step">Head out the door, at a pace where you can talk but not sing. Come back and tap Done.</p>';
  else if (tool === 'water') body = '<div class="sos-eyes" aria-hidden="true">💧</div><p class="sos-step">Pour a full glass. Sip it slowly, sitting down. Notice how you feel after.</p>';
  return `<div class="sos-run"><div class="over">${t.emoji} ${esc(t.title)}</div>
    <div class="sos-timer" data-timer>${mmss(left)}</div>
    ${body}
    <button class="btn block" data-action="sosDone" style="margin-top:16px">${tool === 'water' || tool === 'walk' ? 'Done' : 'I’m done'}</button></div>`;
}

export default {
  render(state) {
    if (phase === 'run' && tool) return `<div class="sos-page">${runHtml()}</div>`;
    if (phase === 'after') {
      return `<div class="sos-page"><h1>How is the craving now?</h1>
        <div class="sos-after">
          <button class="btn primary large block" data-action="sosResult" data-v="gone">Gone 🎉</button>
          <button class="btn large block" data-action="sosResult" data-v="weaker">Weaker</button>
          <button class="btn ghost large block" data-action="sosResult" data-v="still">Still there</button>
        </div></div>`;
    }
    if (phase === 'done') {
      const today = store.today();
      const week = Object.entries(state.cravings || {}).filter(([d]) => d > new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).flatMap(([, l]) => l).filter((c) => c.result !== 'still').length;
      const last = (state.cravings?.[today] || []).at(-1);
      return `<div class="sos-page"><div class="sos-wave" aria-hidden="true">🌊</div>
        ${last?.result === 'still'
          ? `<h1>That’s OK</h1><p class="sos-why">Some waves are bigger. Try another tool — or if you do eat something, log it without guilt. One moment doesn’t undo anything.</p><button class="btn primary block" data-action="sosAgain">Try another tool</button>`
          : `<h1>You rode it out</h1><p class="sos-why">${week > 1 ? `That’s ${week} cravings you’ve ridden out this week. ` : ''}Every time you do, the next one gets a little easier.</p>`}
        <a class="btn block" href="#/today" style="margin-top:10px">Back to today</a></div>`;
    }
    return `<div class="sos-page">
      <div class="sos-hero"><div class="sos-wave" aria-hidden="true">🌊</div><h1>Craving? Let’s ride it out.</h1>${reasonsHtml(state)}
        <p class="muted" style="font-size:var(--text-sm)">Cravings rise, peak and pass. Pick something for a few minutes, then see how you feel.</p></div>
      <div class="sos-tools">${Object.entries(TOOLS).map(([id, t]) => `<button class="sos-tool" data-action="sosStart" data-tool="${id}"><span class="sos-emoji" aria-hidden="true">${t.emoji}</span><span class="grow"><strong>${esc(t.title)}</strong><small>${t.min} min · ${esc(t.why)}</small></span></button>`).join('')}</div>
      <p class="muted" style="font-size:var(--text-xs);margin-top:12px">Why these work: <a href="#/learn/cravings">the evidence</a></p>
    </div>`;
  },
  after(root, ctx) {
    stop();
    if (phase !== 'run' || !tool) return;
    let i = 0;
    let breathIn = true;
    let breathAt = Date.now();
    timer = setInterval(() => {
      const el = document.querySelector('[data-timer]');
      if (!el) return stop(); // left the screen
      const left = endsAt - Date.now();
      el.textContent = mmss(left);
      if (tool === 'surf' || tool === 'picture') {
        const list = tool === 'surf' ? SURF : PICTURE;
        const step = Math.min(list.length - 1, Math.floor((TOOLS[tool].min * 60000 - left) / 20000));
        if (step !== i) {
          i = step;
          const p = document.querySelector('[data-prompt]');
          if (p) p.textContent = list[i];
        }
      }
      if (tool === 'breathe') {
        const dur = breathIn ? 4000 : 6000;
        if (Date.now() - breathAt >= dur) {
          breathIn = !breathIn;
          breathAt = Date.now();
          const p = document.querySelector('[data-breath]');
          if (p) p.textContent = breathIn ? 'Breathe in…' : 'And out, slowly…';
          document.querySelector('.sos-breath')?.classList.toggle('out', !breathIn);
        }
      }
      if (left <= 0 && tool !== 'walk' && tool !== 'water') {
        stop();
        if (ctx.state.game?.sound !== false) chime('quest');
        if (ctx.state.game?.haptics !== false) buzz([10, 40, 10]);
        phase = 'after';
        ctx.rerender();
      }
    }, 250);
  },
  actions: {
    sosStart(el, ev, ctx) {
      tool = el.dataset.tool;
      phase = 'run';
      endsAt = Date.now() + TOOLS[tool].min * 60000;
      if (tool === 'puzzle') shuffleTiles();
      ctx.rerender();
    },
    sosTile(el, ev, ctx) {
      const i = Number(el.dataset.i);
      const b = tiles.indexOf(0);
      const near = (Math.abs(i - b) === 3) || (Math.abs(i - b) === 1 && Math.floor(i / 3) === Math.floor(b / 3));
      if (!near) return;
      [tiles[i], tiles[b]] = [tiles[b], tiles[i]];
      if (solved()) {
        confetti(0.6);
        stop();
        phase = 'after';
      }
      ctx.rerender();
    },
    sosDone(el, ev, ctx) {
      stop();
      phase = 'after';
      ctx.rerender();
    },
    sosResult(el, ev, ctx) {
      const d = new Date();
      const at = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const today = store.today();
      const result = el.dataset.v;
      ctx.update((st) => {
        st.cravings = { ...(st.cravings || {}), [today]: [...(st.cravings?.[today] || []), { at, tool, result }] };
        return st;
      }, { quiet: true, render: false });
      if (result !== 'still') confetti(result === 'gone' ? 1 : 0.5);
      phase = 'done';
      ctx.rerender();
    },
    sosAgain(el, ev, ctx) {
      phase = 'pick';
      tool = null;
      ctx.rerender();
    },
  },
};

/** Entering the screen from elsewhere starts fresh. */
export function resetSos() {
  stop();
  phase = 'pick';
  tool = null;
}
