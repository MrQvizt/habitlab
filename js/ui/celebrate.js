// Celebration effects: floating XP, confetti, chimes, haptics and the level-up / badge dialogs.
// Everything degrades gracefully: reduced motion skips animation, sound is optional and only plays
// after the user has interacted with the page.
import { esc, icon } from './dom.js';

let lastPoint = null;
document.addEventListener('pointerdown', (e) => (lastPoint = { x: e.clientX, y: e.clientY }), true);

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** "+10 XP" rising from where the user tapped. */
export function floatXp(amount, { lucky = false, label = '' } = {}) {
  const el = document.createElement('div');
  el.className = `xp-float${lucky ? ' lucky' : ''}`;
  el.textContent = `+${amount} XP${label ? ` · ${label}` : ''}`;
  const p = lastPoint || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  el.style.left = `${Math.min(window.innerWidth - 90, Math.max(10, p.x - 30))}px`;
  el.style.top = `${p.y - 20}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), reducedMotion() ? 1200 : 1300);
}

/** "Eat ring closed!" pill that drops in at the top; separate from the toast so Undo stays visible. */
export function ringBanner(text, color = 'var(--accent)') {
  document.querySelector('.ring-banner')?.remove();
  const el = document.createElement('div');
  el.className = 'ring-banner';
  el.setAttribute('role', 'status');
  el.style.setProperty('--rc', color);
  el.innerHTML = `<span class="rb-dot"></span>${esc(text)}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/** Confetti burst from the tap point (or top centre). */
export function confetti(power = 1) {
  if (reducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const colors = ['--accent', '--warm', '--info', '--danger', '--chart-trend'].map((v) => css.getPropertyValue(v).trim() || '#1b6e52');
  colors.push('#f2c14e');
  const origin = lastPoint || { x: window.innerWidth / 2, y: window.innerHeight / 3 };
  const n = Math.round(70 * power);
  const parts = Array.from({ length: n }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const v = (5 + Math.random() * 7) * Math.sqrt(power);
    return { x: origin.x, y: origin.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 3 + Math.random() * 4, c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, shape: Math.random() < 0.5 };
  });
  const t0 = performance.now();
  const frame = (t) => {
    const age = (t - t0) / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.vy += 0.28;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / 1.6);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      if (p.shape) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (age < 1.6) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

let audio = null;
/** Short synthesized chime. kind: 'tick' | 'quest' | 'level' | 'badge' | 'lucky'. */
export function chime(kind = 'tick') {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notes = { tick: [880], lucky: [988, 1319], quest: [784, 988, 1175], badge: [659, 880, 1109, 1319], level: [523, 659, 784, 1047, 1319] }[kind] || [880];
    const now = audio.currentTime;
    notes.forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = now + i * 0.085;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(kind === 'tick' ? 0.06 : 0.09, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
  } catch (e) {
    /* audio unavailable */
  }
}

export function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch (e) {
    /* ignore */
  }
}

/** Celebration dialog for a level-up or a new badge. */
export function showCelebration({ kicker, title, body, iconName = 'star', ok = 'Nice!' }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal celebrate-modal" role="dialog" aria-modal="true" aria-labelledby="cel-title">
    <div class="medal big">${icon(iconName)}</div>
    <div class="kicker">${esc(kicker)}</div>
    <h2 id="cel-title">${esc(title)}</h2>
    <p class="muted-2">${esc(body)}</p>
    <button class="btn primary" type="button">${esc(ok)}</button></div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => (e.target === wrap || e.target.closest('button')) && close());
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  });
  document.body.appendChild(wrap);
  wrap.querySelector('button').focus();
}
