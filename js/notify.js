// Notification delivery.
// - Android app (Capacitor): native scheduled local notifications, delivered even when the app is closed.
// - Browser: best effort — notifications fire only while the page is open (browsers can't schedule
//   reliably without a server), so the Settings screen explains that the app is better for reminders.
import { buildReminders } from './engine/reminders.js';

const MAX_WEB_DELAY = 24 * 3600 * 1000;
let webTimers = [];
let listening = false;

export function platform() {
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) return 'native';
  if ('Notification' in window) return 'web';
  return 'none';
}

function plugin() {
  const cap = window.Capacitor;
  return cap?.Plugins?.LocalNotifications || cap?.registerPlugin?.('LocalNotifications') || null;
}

export async function permissionState() {
  try {
    if (platform() === 'native') return (await plugin().checkPermissions()).display; // granted | denied | prompt
    if (platform() === 'web') return Notification.permission === 'default' ? 'prompt' : Notification.permission;
  } catch (e) {
    /* fall through */
  }
  return 'denied';
}

export async function requestPermission() {
  try {
    if (platform() === 'native') {
      const ln = plugin();
      const res = await ln.requestPermissions();
      if (ln.createChannel) {
        await ln.createChannel({ id: 'reminders', name: 'Reminders & encouragement', description: 'Daily quests, meal logging and movement nudges', importance: 4, vibration: true }).catch(() => {});
      }
      return res.display;
    }
    if (platform() === 'web') return await Notification.requestPermission();
  } catch (e) {
    /* ignore */
  }
  return 'denied';
}

/** Route taps on notifications to the right screen. */
export function listen() {
  if (listening || platform() !== 'native') return;
  listening = true;
  try {
    plugin().addListener('localNotificationActionPerformed', (e) => {
      const route = e?.notification?.extra?.route;
      if (route) location.hash = route;
    });
  } catch (e) {
    /* ignore */
  }
}

/**
 * Replace all scheduled reminders with a fresh set built from the current state.
 * @param ctx passed through to buildReminders ({habitsOnly, schedule, streak})
 */
export async function sync(state, ctx) {
  const list = buildReminders(state, new Date(), ctx);
  const p = platform();
  if (p === 'native') {
    const ln = plugin();
    try {
      if ((await ln.checkPermissions()).display !== 'granted') return { scheduled: 0, platform: p };
      const pending = await ln.getPending();
      const ours = (pending.notifications || []).filter((n) => n.id >= 100000);
      if (ours.length) await ln.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
      if (list.length) {
        await ln.schedule({
          notifications: list.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            channelId: 'reminders',
            schedule: { at: n.at, allowWhileIdle: true },
            extra: { route: n.route },
            smallIcon: 'ic_stat_notify',
            iconColor: '#1b6e52',
          })),
        });
      }
      return { scheduled: list.length, platform: p };
    } catch (e) {
      return { scheduled: 0, platform: p, error: String(e?.message || e) };
    }
  }
  if (p === 'web') {
    webTimers.forEach(clearTimeout);
    webTimers = [];
    if (Notification.permission !== 'granted') return { scheduled: 0, platform: p };
    const now = Date.now();
    for (const n of list) {
      const delay = n.at - now;
      if (delay <= 0 || delay > MAX_WEB_DELAY) continue;
      webTimers.push(setTimeout(() => showWeb(n), delay));
    }
    return { scheduled: webTimers.length, platform: p };
  }
  return { scheduled: 0, platform: p };
}

function showWeb(n) {
  try {
    const note = new Notification(n.title, { body: n.body, icon: 'icons/icon-192.png', tag: String(n.id) });
    note.onclick = () => {
      window.focus();
      location.hash = n.route;
      note.close();
    };
  } catch (e) {
    /* some browsers only allow notifications via a service worker; ignore */
  }
}

/** Fire one notification a few seconds from now so the user can see what reminders look like. */
export async function test() {
  const n = { id: 99999, title: 'Habit Lab reminders are on', body: 'This is what a nudge looks like. Tap to open today’s quests.', route: '#/today', at: new Date(Date.now() + 5000) };
  if (platform() === 'native') {
    await plugin().schedule({ notifications: [{ id: n.id, title: n.title, body: n.body, channelId: 'reminders', schedule: { at: n.at, allowWhileIdle: true }, extra: { route: n.route }, smallIcon: 'ic_stat_notify', iconColor: '#1b6e52' }] });
  } else if (platform() === 'web' && Notification.permission === 'granted') {
    setTimeout(() => showWeb(n), 5000);
  }
}
