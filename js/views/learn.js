// Learn: the evidence behind each feature, with sources.
import { html, esc, icon } from '../ui/dom.js';
import { LEARN, LEARN_SECTIONS } from '../data/learn.js';

let section = 'all';

export default {
  render(state, params) {
    const focus = params[0];
    const cards = LEARN.filter((c) => section === 'all' || c.section === section);
    return html`${state.profile ? '' : '<a class="btn ghost small" href="#/start">' + icon('back') + 'Back</a>'}
      <h1>The evidence</h1>
      <p class="muted">Every feature in Habit Lab is based on guidelines, trials and reviews. Here’s what they say, in plain language, with links to the sources. The full research brief is in <code>RESEARCH.md</code> in the project.</p>
      <div class="segmented" style="margin-bottom:14px">${[['all', 'All'], ...LEARN_SECTIONS.map((s) => [s, s])].map(([k, l]) => `<button type="button" class="${section === k ? 'on' : ''}" data-action="section" data-value="${esc(k)}">${esc(l)}</button>`)}</div>
      ${cards.map((c) => `<article class="card learn-card" id="learn-${c.id}" ${focus === c.id ? 'style="border-color:var(--accent)"' : ''}>
        <span class="tag">${esc(c.section)}</span>
        <h3 style="margin-top:6px">${esc(c.title)}</h3>
        <p class="muted-2">${esc(c.summary)}</p>
        <ul>${c.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        ${c.app ? `<div class="notice ok" style="margin:10px 0 0">${icon('info')}<div><strong>In the app:</strong> ${esc(c.app)}</div></div>` : ''}
        <div class="src">Sources: ${c.sources.map(([label, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`).join(' · ')}</div>
      </article>`)}
      <p class="footer-note">General information only — not medical advice. Talk to your doctor about your own situation.</p>`;
  },
  after(root, ctx, params) {
    if (params[0]) root.querySelector(`#learn-${CSS.escape(params[0])}`)?.scrollIntoView({ block: 'start' });
  },
  actions: {
    section(el, ev, ctx) {
      section = el.dataset.value;
      ctx.rerender();
    },
  },
};
