// Learn: the evidence behind each feature, with sources.
import { html, esc, icon } from '../ui/dom.js';
import { LEARN, LEARN_SECTIONS } from '../data/learn.js';

let section = 'all';
let openAll = false;

export default {
  render(state, params) {
    const focus = params[0];
    if (focus && LEARN.some((c) => c.id === focus)) section = 'all';
    const cards = LEARN.filter((c) => section === 'all' || c.section === section);
    return html`${state.profile ? '' : '<a class="btn ghost small" href="#/start">' + icon('back') + 'Back</a>'}
      <header class="page-head"><div><div class="eyebrow">Learn</div><h1>The evidence</h1></div></header>
      <p class="muted">Every feature in Habit Lab is based on guidelines, trials and reviews. Here’s what they say, in plain language, with links to the sources.</p>
      <div class="scroll-x" style="margin-bottom:12px">${[['all', 'All'], ...LEARN_SECTIONS.map((s) => [s, s])].map(([k, l]) => `<button type="button" class="qchip ${section === k ? 'done' : ''}" style="padding-left:12px" data-action="section" data-value="${esc(k)}" aria-pressed="${section === k}">${esc(l)}</button>`).join('')}</div>
      <div class="row between" style="margin:0 2px 10px"><span class="muted" style="font-size:var(--text-sm)">${cards.length} topics</span><button type="button" class="btn small ghost" data-action="toggleAll">${openAll ? 'Collapse all' : 'Expand all'}</button></div>
      ${cards.map((c) => `<article class="card learn-card" id="learn-${c.id}" ${focus === c.id ? 'style="border-color:var(--accent)"' : ''}>
        <span class="tag">${esc(c.section)}</span>
        <h2 class="learn-title">${esc(c.title)}</h2>
        <p class="muted-2">${esc(c.summary)}</p>
        ${c.app ? `<div class="notice ok" style="margin:10px 0 0">${icon('info')}<div><strong>In the app:</strong> ${esc(c.app)}</div></div>` : ''}
        <details class="recipe" ${focus === c.id || openAll ? 'open' : ''}><summary>Show the evidence (${c.sources.length} source${c.sources.length === 1 ? '' : 's'})</summary>
          <ul>${c.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          <div class="src">Sources: ${c.sources.map(([label, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`).join(' · ')}</div>
        </details>
      </article>`)}
      <p class="footer-note">General information only — not medical advice. Talk to your doctor about your own situation.</p>`;
  },
  after(root, ctx, params) {
    if (params[0]) root.querySelector(`#learn-${CSS.escape(params[0])}`)?.scrollIntoView({ block: 'start' });
  },
  actions: {
    toggleAll(el, ev, ctx) {
      openAll = !openAll;
      ctx.rerender();
    },
    section(el, ev, ctx) {
      section = el.dataset.value;
      if (location.hash.replace(/^#\/?/, '') !== 'learn') location.hash = '#/learn';
      else ctx.rerender();
    },
  },
};
