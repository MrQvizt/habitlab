// Rendering helpers. Views return HTML strings; every user-provided value goes through esc().
import { kgToLb, cmToIn, lbToKg, inToCm, round } from '../engine/util.js';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const html = (strings, ...vals) =>
  strings.reduce((out, s, i) => out + s + (i < vals.length ? (Array.isArray(vals[i]) ? vals[i].join('') : vals[i] ?? '') : ''), '');

export function units(state) {
  return state?.profile?.units === 'imperial' ? 'imperial' : 'metric';
}

export function fmtWeight(kg, u, digits = 1) {
  if (kg == null || !Number.isFinite(kg)) return '–';
  return u === 'imperial' ? `${round(kgToLb(kg), 10 ** -digits).toFixed(digits)} lb` : `${round(kg, 10 ** -digits).toFixed(digits)} kg`;
}

/** Like fmtWeight, but drops a trailing ".0" (82 kg, 61.5 kg). */
export function fmtKg(kg, u) {
  return fmtWeight(kg, u).replace(/\.0 /, ' ');
}

export function weightNum(kg, u) {
  return u === 'imperial' ? kgToLb(kg) : kg;
}

export function toKg(v, u) {
  return u === 'imperial' ? lbToKg(v) : v;
}

export function fmtDelta(kg, u, digits = 1) {
  const sign = kg > 0 ? '+' : kg < 0 ? '−' : '';
  return sign + fmtWeight(Math.abs(kg), u, digits);
}

export function fmtHeight(cm, u) {
  if (u === 'imperial') {
    const inches = Math.round(cmToIn(cm));
    return `${Math.floor(inches / 12)}′${inches % 12}″`;
  }
  return `${Math.round(cm)} cm`;
}

export function heightFromFtIn(ft, inch) {
  return inToCm((Number(ft) || 0) * 12 + (Number(inch) || 0));
}

export function fmtNum(n, step = 1) {
  return Number.isFinite(n) ? round(n, step).toLocaleString() : '–';
}

// Date formatters are expensive to create (toLocaleDateString builds one per call), so they're cached
// per option set: lists of hundreds of dates render in a few milliseconds.
const dateFormats = new Map();
export function fmtDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const key = JSON.stringify(opts);
  let f = dateFormats.get(key);
  if (!f) dateFormats.set(key, (f = new Intl.DateTimeFormat(undefined, opts)));
  return f.format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
}

export function icon(name, cls = '') {
  const paths = {
    today: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
    meals: '<path d="M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 3c-2 2-3 5-3 8h3v10"/>',
    move: '<circle cx="13" cy="4" r="2"/><path d="M8 21l3-6 3 3v3M6 12l3-4 4 1 3 4M14 9l-1 6"/>',
    habits: '<path d="M4 12l5 5L20 6"/>',
    progress: '<path d="M3 20h18M6 16l4-5 4 3 5-7"/>',
    learn: '<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>',
    scale: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9a5 5 0 0 1 8 0l-3 3"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17h.01"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2 2 2 3 1-2 1-4 1-6z"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1.5 3h5L16 13h5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  };
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
}

export function chips(name, options, selected = [], { multi = true } = {}) {
  const sel = new Set(Array.isArray(selected) ? selected : [selected]);
  return `<div class="chips" role="group">${Object.entries(options)
    .map(([value, label]) => `<label class="chip"><input type="${multi ? 'checkbox' : 'radio'}" name="${esc(name)}" value="${esc(value)}" ${sel.has(value) ? 'checked' : ''}><span>${esc(typeof label === 'string' ? label : label.label)}</span></label>`)
    .join('')}</div>`;
}

export function progressBar(value, max, { label = '', tone = '' } = {}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="bar ${tone}" role="progressbar" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="${Math.round(max)}" aria-label="${esc(label)}"><span style="width:${pct.toFixed(1)}%"></span></div>`;
}

/**
 * Read a form into a plain object.
 * - A group of checkboxes sharing a name (chips) becomes an array of the checked values ([] if none).
 * - A single checkbox becomes its value when checked and is absent when not, so `!!data.x` is a
 *   correct "is it ticked?" test. (An empty array would be truthy — that was a bug.)
 */
export function formData(form) {
  const out = {};
  const fd = new FormData(form);
  const counts = {};
  for (const i of form.querySelectorAll('input[type=checkbox]')) counts[i.name] = (counts[i.name] || 0) + 1;
  const multi = new Set(Object.keys(counts).filter((n) => counts[n] > 1 || form.querySelector(`input[type=checkbox][name="${CSS.escape(n)}"]`)?.closest('.chips')));
  for (const name of multi) out[name] = [];
  for (const [k, v] of fd.entries()) {
    if (multi.has(k)) out[k].push(v);
    else out[k] = v;
  }
  return out;
}
