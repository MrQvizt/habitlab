// Small dependency-free SVG charts. Colours come from CSS variables so they follow the theme.
import { esc } from './dom.js';
import { daysBetween, addDays } from '../engine/util.js';

/**
 * Weight chart: raw weigh-ins as dots, smoothed trend as a line, optional goal line and milestone ticks.
 * series: [{date, kg|null, trend}] (from trendSeries), conv: kg -> display units
 */
export function weightChart(series, { goal = null, band = null, milestones = [], conv = (x) => x, unitLabel = 'kg', width = 640, height = 240 } = {}) {
  if (series.length < 2) return '<div class="empty">Log a few weigh-ins to see your trend line.</div>';
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const vals = series.flatMap((p) => [p.trend, p.kg].filter((v) => v != null)).map(conv);
  if (goal != null) vals.push(conv(goal));
  if (band) vals.push(conv(band.lo), conv(band.hi));
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const span = Math.max(hi - lo, 2);
  lo -= span * 0.08;
  hi += span * 0.08;
  const n = series.length - 1;
  const x = (i) => pad.l + (i / n) * W;
  const y = (v) => pad.t + (1 - (conv(v) - lo) / (hi - lo)) * H;
  const yRaw = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * H;

  const ticks = niceTicks(lo, hi, 4);
  const grid = ticks.map((t) => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${yRaw(t).toFixed(1)}" y2="${yRaw(t).toFixed(1)}" class="grid"/><text x="${pad.l - 6}" y="${(yRaw(t) + 4).toFixed(1)}" class="axis" text-anchor="end">${t}</text>`).join('');
  const labelEvery = Math.max(1, Math.round(n / 5));
  const xlabels = series
    .map((p, i) => (i % labelEvery === 0 || i === n ? `<text x="${x(i).toFixed(1)}" y="${height - 6}" class="axis" text-anchor="middle">${esc(shortDate(p.date))}</text>` : ''))
    .join('');
  const trendPath = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`).join('');
  const dots = series
    .map((p, i) => (p.kg != null ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="3" class="dot"><title>${esc(p.date)}: ${conv(p.kg).toFixed(1)} ${unitLabel}</title></circle>` : ''))
    .join('');
  const goalLine = goal != null && conv(goal) >= lo && conv(goal) <= hi
    ? `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" class="goal"/><text x="${width - pad.r}" y="${(y(goal) - 5).toFixed(1)}" class="axis goal-label" text-anchor="end">Goal</text>`
    : '';
  const ms = milestones
    .filter((m) => conv(m.weightKg) >= lo && conv(m.weightKg) <= hi)
    .map((m) => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(m.weightKg).toFixed(1)}" y2="${y(m.weightKg).toFixed(1)}" class="milestone"/><text x="${pad.l + 4}" y="${(y(m.weightKg) - 4).toFixed(1)}" class="axis">−${m.pct}%</text>`)
    .join('');
  const bandRect = band
    ? `<rect x="${pad.l}" width="${W}" y="${y(band.hi).toFixed(1)}" height="${(y(band.lo) - y(band.hi)).toFixed(1)}" class="band"/><text x="${width - pad.r - 4}" y="${(y(band.hi) + 12).toFixed(1)}" class="axis" text-anchor="end">maintenance band</text>`
    : '';
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Weight trend chart">${bandRect}${grid}${ms}${goalLine}${dots}<path d="${trendPath}" class="trend"/>${xlabels}</svg>`;
}

/**
 * The Progress hero chart: faint daily weigh-ins, the smoothed trend as a bold line with a soft fill,
 * the next milestone as a dashed target, and a dotted projection to it at your current pace.
 * series: [{date, kg|null, trend}], target: {kg, label}, projection: {days, toKg}
 */
export function trendChart(series, { target = null, projection = null, band = null, conv = (x) => x, unitLabel = 'kg', width = 360, height = 220 } = {}) {
  if (series.length < 2) return '<div class="empty chart-empty">Weigh in a few mornings and your trend line appears here.</div>';
  const pad = { l: 34, r: 14, t: 16, b: 24 };
  const n = series.length - 1;
  const days = n + (projection?.days || 0);
  const vals = series.flatMap((p) => [p.trend, p.kg].filter((v) => v != null)).map(conv);
  if (target) vals.push(conv(target.kg));
  if (projection) vals.push(conv(projection.toKg));
  if (band) vals.push(conv(band.lo), conv(band.hi));
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const span = Math.max(hi - lo, 1.5);
  lo -= span * 0.12;
  hi += span * 0.1;
  const ticks = niceTicks(lo, hi, 3);
  // Room for the longest axis label (bigger with large system text), so numbers are never cut off.
  pad.l = Math.max(34, Math.max(...ticks.map((t) => String(t).length)) * 8 + 8);
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const x = (i) => pad.l + (i / days) * W;
  const yv = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * H;
  const y = (kg) => yv(conv(kg));
  const f = (v) => v.toFixed(1);
  const grid = ticks.map((t) => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${f(yv(t))}" y2="${f(yv(t))}" class="grid"/><text x="${pad.l - 6}" y="${f(yv(t) + 4)}" class="axis" text-anchor="end">${t}</text>`).join('');
  const lastI = n;
  const labels = [0, Math.round(n / 2), n].filter((v, i, a) => a.indexOf(v) === i)
    .map((i) => `<text x="${f(x(i))}" y="${height - 6}" class="axis" text-anchor="${i === 0 ? 'start' : i === n && !projection ? 'end' : 'middle'}">${esc(shortDate(series[i].date))}</text>`).join('');
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${f(x(i))},${f(y(p.trend))}`).join('');
  const area = `${line}L${f(x(lastI))},${pad.t + H}L${f(x(0))},${pad.t + H}Z`;
  const dots = series.map((p, i) => (p.kg != null ? `<circle cx="${f(x(i))}" cy="${f(y(p.kg))}" r="2.2" class="wdot"><title>${esc(p.date)}: ${conv(p.kg).toFixed(1)} ${unitLabel}</title></circle>` : '')).join('');
  const last = series[lastI];
  const targetLine = target
    ? `<line x1="${pad.l}" x2="${width - pad.r}" y1="${f(y(target.kg))}" y2="${f(y(target.kg))}" class="target"/><text x="${width - pad.r}" y="${f(y(target.kg) - 6)}" class="axis target-label" text-anchor="end">${esc(target.label)}</text>`
    : '';
  const proj = projection
    ? `<path d="M${f(x(lastI))},${f(y(last.trend))}L${f(x(days))},${f(y(projection.toKg))}" class="proj"/><circle cx="${f(x(days))}" cy="${f(y(projection.toKg))}" r="4" class="proj-end"/>${projection.label ? `<text x="${f(x(days))}" y="${height - 6}" class="axis" text-anchor="end">${esc(projection.label)}</text>` : ''}`
    : '';
  const bandRect = band ? `<rect x="${pad.l}" width="${W}" y="${f(y(band.hi))}" height="${f(y(band.lo) - y(band.hi))}" class="band"/>` : '';
  const now = `<circle cx="${f(x(lastI))}" cy="${f(y(last.trend))}" r="5.5" class="now"/>`;
  return `<svg class="chart trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Weight trend: ${conv(series[0].trend).toFixed(1)} to ${conv(last.trend).toFixed(1)} ${unitLabel}${target ? `, next milestone ${conv(target.kg).toFixed(1)}` : ''}">
    <defs><linearGradient id="tc-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--chart-trend)" stop-opacity=".22"/><stop offset="1" stop-color="var(--chart-trend)" stop-opacity="0"/></linearGradient></defs>
    ${bandRect}${grid}${targetLine}<path d="${area}" fill="url(#tc-fill)" class="tarea"/>${dots}<path d="${line}" class="trend"/>${proj}${now}${labels}</svg>`;
}

/** Simple bar chart: items [{label, value}], optional target line. */
export function barChart(items, { target = null, width = 640, height = 180, unit = '' } = {}) {
  if (!items.length) return '<div class="empty">No data yet.</div>';
  const pad = { l: 36, r: 8, t: 14, b: 24 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const max = Math.max(1, target || 0, ...items.map((i) => i.value)) * 1.1;
  const bw = W / items.length;
  const y = (v) => pad.t + (1 - v / max) * H;
  const bars = items
    .map((it, i) => {
      const bx = pad.l + i * bw + bw * 0.18;
      const by = y(it.value);
      const met = target != null && it.value >= target;
      return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(pad.t + H - by).toFixed(1)}" rx="3" class="barfill ${met ? 'met' : ''}"><title>${esc(it.label)}: ${Math.round(it.value)}${unit}</title></rect><text x="${(pad.l + i * bw + bw / 2).toFixed(1)}" y="${height - 7}" class="axis" text-anchor="middle">${esc(it.label)}</text>`;
    })
    .join('');
  const tl = target != null ? `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}" class="goal"/><text x="${pad.l - 4}" y="${(y(target) + 4).toFixed(1)}" class="axis" text-anchor="end">${Math.round(target)}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart">${bars}${tl}</svg>`;
}

/** Habit heatmap: last N days per habit. */
export function habitGrid(habitIds, log, endDate, days = 28, names = {}) {
  const cells = (id) =>
    Array.from({ length: days }, (_, i) => {
      const d = addDays(endDate, i - days + 1);
      const on = log[d]?.[id];
      return `<span class="cell ${on ? 'on' : ''}" title="${esc(d)}${on ? ' ✓' : ''}"></span>`;
    }).join('');
  return `<div class="habit-grid">${habitIds.map((id) => `<div class="hg-row"><div class="hg-name">${esc(names[id] || id)}</div><div class="hg-cells">${cells(id)}</div></div>`).join('')}</div>`;
}

/** Ring gauge for "eaten vs target". */
export function ring(value, max, { size = 120, label = '', sub = '' } = {}) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)} ${esc(sub)}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="47%" text-anchor="middle" class="ring-label">${esc(label)}</text>
    <text x="50%" y="64%" text-anchor="middle" class="ring-sub">${esc(sub)}</text></svg>`;
}

function shortDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}/${m}`;
}

function niceTicks(lo, hi, count) {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) || raw;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(Number(t.toFixed(2)));
  return out;
}

export { daysBetween };
