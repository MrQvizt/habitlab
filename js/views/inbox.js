// Inbox: cheers from friends and people joining your activities, newest first. Opening it marks
// everything as read; new ones show a dot this visit so you can see what came in.
import { esc, icon } from '../ui/dom.js';
import * as share from '../share.js';

let shownUnread = null; // what was unread while you've had the inbox open (kept until you leave)
let fresh = false;

const when = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days < 1 && new Date().toDateString() === d.toDateString()) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (days < 6) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export function resetInbox() {
  shownUnread = null;
}

export default {
  render(state) {
    const items = share.inboxItems(state);
    fresh = shownUnread == null;
    shownUnread ||= new Set();
    for (const x of items) if (x.unread) shownUnread.add(`${x.kind}|${x.at}|${x.name}`);
    const head = `<header class="page-head"><div><div class="eyebrow">From friends</div><h1>Inbox</h1></div></header>`;
    if (!state.share?.id) {
      return `${head}<div class="card empty-state">${icon('inbox')}<strong>Nothing here yet</strong>Share your calendar and friends can cheer you on or join your walks — it all lands here.<a class="btn primary small" href="#/calendar" style="margin-top:10px">Share your calendar</a></div>`;
    }
    if (!items.length) {
      return `${head}<div class="card empty-state">${icon('inbox')}<strong>No messages yet</strong>When a friend sends a cheer or joins one of your activities, you’ll see it here.<a class="btn small" href="#/calendar" style="margin-top:10px">Your shared calendar</a></div>`;
    }
    const row = (x) => {
      const isNew = shownUnread.has(`${x.kind}|${x.at}|${x.name}`);
      return `<li class="inbox-item ${isNew ? 'new' : ''}"><span class="inbox-ico" aria-hidden="true">${x.kind === 'cheer' ? '💌' : '🙌'}</span>
        <div class="grow"><div class="row between nowrap"><strong>${esc(x.name)}</strong><span class="muted inbox-when">${esc(when(x.at))}${isNew ? ' <span class="inbox-dot" aria-label="new"></span>' : ''}</span></div>
        <div class="inbox-text">${x.kind === 'cheer' ? esc(x.text) : `Joining you: ${esc(x.text)}`}</div></div></li>`;
    };
    return `${head}<ul class="card tight inbox-list" aria-label="Messages">${items.map(row).join('')}</ul>
      <p class="muted" style="font-size:var(--text-xs)">Cheers and joins come from the people you shared <a href="#/calendar">your calendar</a> with.</p>`;
  },
  after(root, ctx) {
    if (fresh) share.refresh(ctx, true); // once per visit: pick up anything just sent
    share.markInboxRead(ctx);
  },
};
