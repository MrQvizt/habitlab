// Bottom sheet (dialog on wide screens): swipe-down / scrim / Escape to close, focus trapped,
// focus returned to the opener. Content is HTML; buttons inside use the normal data-action routing.
let current = null;

// The (Android) back button closes an open sheet instead of leaving the screen: each sheet pushes a
// history entry, and going back pops it.
window.addEventListener('popstate', () => {
  if (current) closeSheet(false, { fromHistory: true });
});

export function isOpen() {
  return !!current;
}

function setBackgroundInert(on) {
  for (const el of document.querySelectorAll('body > .app, body > .bottomnav')) el.inert = on;
}

export function openSheet(html, { label = 'Details', onClose } = {}) {
  closeSheet(true);
  const opener = document.activeElement;
  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', label);
  sheet.innerHTML = `<span class="grab" aria-hidden="true"></span>${html}`;
  document.body.append(scrim, sheet);
  document.body.style.overflow = 'hidden';
  // Everything behind the sheet is inert: not focusable, not clickable, hidden from screen readers.
  setBackgroundInert(true);
  requestAnimationFrame(() => {
    scrim.classList.add('open');
    sheet.classList.add('open');
  });
  const focusables = () => [...sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
  setTimeout(() => (sheet.querySelector('[autofocus]') || focusables()[0])?.focus({ preventScroll: true }), 60);
  const onKey = (e) => {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f[f.length - 1].focus());
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) (e.preventDefault(), f[0].focus());
    }
  };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', () => closeSheet());
  // Swipe down to dismiss (only when scrolled to top).
  let startY = null;
  let dy = 0;
  sheet.addEventListener('pointerdown', (e) => {
    if (sheet.scrollTop > 0 || e.target.closest('input, select, textarea, button, a')) return;
    startY = e.clientY;
    dy = 0;
    sheet.classList.add('dragging');
  });
  sheet.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY == null) return;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    startY = null;
    if (dy > 90) closeSheet();
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
  try {
    history.pushState({ hlSheet: true }, '');
  } catch (e) {
    /* sandboxed: fine without */
  }
  current = { scrim, sheet, onKey, opener, onClose };
  return sheet;
}

/**
 * @param immediate skip the exit animation (also used when navigating away: history is left alone)
 * @param opts.fromHistory the back button closed it (its history entry is already gone)
 */
export function closeSheet(immediate = false, { fromHistory = false } = {}) {
  if (!current) return;
  const { scrim, sheet, onKey, opener, onClose } = current;
  current = null;
  if (!immediate && !fromHistory && history.state?.hlSheet) {
    try {
      history.back();
    } catch (e) {
      /* ignore */
    }
  }
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
  setBackgroundInert(false);
  const remove = () => (scrim.remove(), sheet.remove());
  if (immediate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) remove();
  else {
    scrim.classList.remove('open');
    sheet.classList.remove('open');
    setTimeout(remove, 280);
  }
  if (opener?.isConnected) opener.focus?.({ preventScroll: true });
  onClose?.();
}

/** Replace the open sheet's content in place (keeps it open). */
export function updateSheet(html) {
  if (!current) return;
  current.sheet.innerHTML = `<span class="grab" aria-hidden="true"></span>${html}`;
}
