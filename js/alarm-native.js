// Bridge to the native alarm clock (android/app/src/main/java/com/mrqvizt/habitlab/alarm).
// In a browser there is no alarm clock: the settings still save, and the page explains why.
import { alarmSpecs, alarmsOf } from './engine/alarms.js';
import { morningMessages, valueInfo } from './data/affirmations.js';

let lastMessage = null;

function plugin() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.HabitAlarm || null;
}

export function available() {
  return !!plugin();
}

/** Send the alarms and the morning-message rotation to the phone. */
export async function sync(state) {
  const p = plugin();
  if (!p || !state.profile) return null;
  try {
    const affirm = state.affirm || {};
    // The morning screen runs on the lock screen, so it needs your values and saved favourites.
    const values = (affirm.values || []).map((v) => ({ id: v, ...valueInfo(v) })).filter((v) => v.label).map((v) => ({ id: v.id, label: v.label, phrase: v.phrase || '' }));
    return await p.setAlarms({ alarms: alarmSpecs(state), messages: morningMessages(affirm), snooze: alarmsOf(state).snooze, values, favs: affirm.favs || [] });
  } catch (e) {
    return null;
  }
}

export async function status() {
  const p = plugin();
  if (!p) return null;
  try {
    return await p.getStatus();
  } catch (e) {
    return null;
  }
}

export async function openSettings(which) {
  const p = plugin();
  if (p) await p.openSettings({ which }).catch(() => {});
}

/** Android's sound picker → {uri, title} or null. */
export async function pickSound(uri) {
  const p = plugin();
  if (!p?.pickSound) return null;
  try {
    const r = await p.pickSound(uri ? { uri } : {});
    return r?.uri ? r : null;
  } catch (e) {
    return null;
  }
}

/** Preview the phone's own sound or a picked one. */
export async function previewPhoneSound(spec) {
  const p = plugin();
  if (p?.previewSound) await p.previewSound(spec).catch(() => {});
}

export async function stopPhonePreview() {
  const p = plugin();
  if (p?.stopPreview) await p.stopPreview().catch(() => {});
}

export async function test(id, seconds = 5) {
  const p = plugin();
  if (!p) return false;
  try {
    await p.test({ id, seconds });
    return true;
  } catch (e) {
    return false;
  }
}

/** The morning message the alarm showed (handed over when you tap "I'm up"). */
export function takeMessage() {
  const m = lastMessage;
  lastMessage = null;
  return m;
}

/** The morning the lock-screen wake screen recorded ("Start my day"), checked: {date, at, values, other, fav, message} or null. */
export function parseWake(raw) {
  try {
    const w = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(w.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.at)) return null;
    const picked = (Array.isArray(w.values) ? w.values : typeof w.value === 'string' && w.value ? [w.value] : []).filter((v) => typeof v === 'string' && v).map((v) => v.slice(0, 30)).slice(0, 6);
    return { date: w.date, at: w.at, values: picked, other: typeof w.other === 'string' ? w.other.trim().slice(0, 60) : '', fav: w.fav === true, message: typeof w.message === 'string' ? w.message.slice(0, 200) : '' };
  } catch (e) {
    return null;
  }
}

/** Open the screen an alarm points to, on cold start and while running. */
export async function listen(go, onWake) {
  const p = plugin();
  if (!p) return;
  const handle = (r) => {
    if (!r?.route) return;
    if (r.message) lastMessage = r.message;
    const w = r.wake ? parseWake(r.wake) : null;
    if (w && onWake) onWake(w);
    go(r.route);
  };
  try {
    p.addListener('route', handle);
    handle(await p.consumeRoute());
  } catch (e) {
    /* ignore */
  }
}
