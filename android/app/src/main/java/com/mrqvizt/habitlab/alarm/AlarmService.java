package com.mrqvizt.habitlab.alarm;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Rings an alarm until it is dismissed or snoozed (or for 10 minutes at most).
 * Sound: a soft melodic arpeggio that starts quiet and grows over about a minute — melodic waking
 * sounds are linked to less perceived grogginess (McFarlane et al., PLOS ONE 2020), and a gradual
 * start avoids a startle. It plays on the alarm stream, so it rings even when the phone is on silent.
 */
public class AlarmService extends Service {
    public static final String ACTION_START = "com.mrqvizt.habitlab.alarm.START";
    public static final String ACTION_DISMISS = "com.mrqvizt.habitlab.alarm.DISMISS";
    public static final String ACTION_SNOOZE = "com.mrqvizt.habitlab.alarm.SNOOZE";
    public static final String ACTION_CHIME = "com.mrqvizt.habitlab.alarm.CHIME";
    public static final String ACTION_STOP_AUTO = "com.mrqvizt.habitlab.alarm.STOP_AUTO";
    public static final int AUTO_ID = 6912;
    public static final int CHIME_ID = 6911;
    public static final int NOTIF_ID = 6901;
    private static final long MAX_RING_MS = AlarmScheduler.AUTO_RING_MS;

    /** What is ringing now (read by AlarmActivity). */
    public static volatile String ringingId;
    public static volatile String ringingKind;
    public static volatile String ringingLabel;
    public static volatile String ringingBody;
    public static volatile String ringingRoute;
    public static volatile String ringingMessage;

    private volatile boolean playing;
    private final SoundPlayer sound = new SoundPlayer();
    private final SoundPlayer chimeSound = new SoundPlayer();
    private Vibrator vibrator;
    private PowerManager.WakeLock wake;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable vibrate = this::startVibration;
    private final Runnable timeout = this::unanswered;
    private long chainStart;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_DISMISS.equals(action)) {
            String route = ringingRoute;
            String msg = ringingMessage;
            stopRinging(false);
            if (intent.getBooleanExtra("open", false)) openApp(this, route, msg);
            return START_NOT_STICKY;
        }
        if (ACTION_STOP_AUTO.equals(action)) {
            // "Stop alarm" on the auto-snooze notification: no more rings this time.
            AlarmStore.clearSnooze(this);
            AlarmStore.setAutoPending(this, false);
            AlarmScheduler.scheduleAll(this);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(AUTO_ID);
            if (ringingId == null) stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_SNOOZE.equals(action)) {
            AlarmStore.Alarm a = current();
            stopRinging(false);
            int min = intent.getIntExtra("minutes", 0);
            if (a != null) {
                if (min > 0) AlarmScheduler.snooze(this, a, min);
                else AlarmScheduler.snooze(this, a);
            }
            return START_NOT_STICKY;
        }
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_CHIME.equals(action)) {
            chime(intent);
            return START_NOT_STICKY;
        }
        // START: one alarm at a time; a new one replaces the old.
        stopSound();
        chainStart = AlarmStore.beginRing(this, System.currentTimeMillis());
        NotificationManager autoNm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (autoNm != null) autoNm.cancel(AUTO_ID);
        ringingId = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
        ringingKind = intent.getStringExtra("kind");
        ringingLabel = intent.getStringExtra("label");
        ringingBody = intent.getStringExtra("body");
        ringingRoute = intent.getStringExtra("route");
        ringingMessage = "wake".equals(ringingKind) ? AlarmStore.messageFor(this, System.currentTimeMillis() / 86_400_000L) : ringingBody;
        AlarmReceiver.channels(this);
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(NOTIF_ID, n);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "habitlab:alarm");
            wake.acquire(MAX_RING_MS + 5000);
        }
        startSound(intent.getStringExtra("spec"));
        handler.postDelayed(vibrate, 20_000);
        handler.postDelayed(timeout, MAX_RING_MS);
        // Take over the screen straight away. Android allows this from the background when the user has
        // granted "Display over other apps"; otherwise the full-screen notification covers the locked case.
        showWakeScreen(this);
        return START_NOT_STICKY;
    }

    private AlarmStore.Alarm current() {
        if (ringingId == null) return null;
        AlarmStore.Alarm a = AlarmStore.find(this, ringingId.replace("_snooze", ""));
        if (a == null) {
            a = new AlarmStore.Alarm();
            a.id = ringingId.replace("_snooze", "");
            a.kind = ringingKind;
            a.label = ringingLabel;
            a.body = ringingBody;
            a.route = ringingRoute;
            a.style = "ring";
        }
        return a;
    }

    private Notification buildNotification() {
        PendingIntent full = PendingIntent.getActivity(this, 6902, new Intent(this, AlarmActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent dismiss = PendingIntent.getService(this, 6903, new Intent(this, AlarmService.class).setAction(ACTION_DISMISS),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent snooze = PendingIntent.getService(this, 6904, new Intent(this, AlarmService.class).setAction(ACTION_SNOOZE),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String text = ringingMessage != null && !ringingMessage.isEmpty() ? ringingMessage : ringingBody;
        return new NotificationCompat.Builder(this, AlarmReceiver.CH_ALARM)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(ringingLabel == null ? "Alarm" : ringingLabel)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setFullScreenIntent(full, true)
            .setContentIntent(full)
            .addAction(0, "Snooze " + AlarmStore.snoozeMinutes(this) + " min", snooze)
            .addAction(0, "I'm up", dismiss)
            .build();
    }

    // ---------- sound (see SoundPlayer) ----------
    private void startSound(String specJson) {
        playing = true;
        JSONObject spec = null;
        try {
            if (specJson != null) spec = new JSONObject(specJson);
        } catch (JSONException ignored) {
        }
        sound.start(this, spec, true, AudioAttributes.USAGE_ALARM, null);
    }

    /** A gentle alarm: a notification plus the chosen melody played twice at a moderate level. */
    private void chime(Intent intent) {
        AlarmReceiver.channels(this);
        String label = intent.getStringExtra("label");
        String body = intent.getStringExtra("body");
        String route = intent.getStringExtra("route");
        Notification n = new NotificationCompat.Builder(this, AlarmReceiver.CH_CHIME)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(label == null ? "Reminder" : label)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(AlarmReceiver.openApp(this, route == null ? "#/today" : route, null, CHIME_ID))
            .build();
        if (ringingId != null) {
            // Something is already ringing: just show the reminder, silently.
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            try {
                if (nm != null) nm.notify(CHIME_ID, n);
            } catch (SecurityException ignored) {
            }
            return;
        }
        if (Build.VERSION.SDK_INT >= 29) startForeground(CHIME_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(CHIME_ID, n);
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v != null) {
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(new long[] {0, 120, 120, 120}, -1));
            else v.vibrate(new long[] {0, 120, 120, 120}, -1);
        }
        JSONObject spec = null;
        try {
            String js = intent.getStringExtra("spec");
            if (js != null) spec = new JSONObject(js);
        } catch (JSONException ignored) {
        }
        chimeSound.start(this, spec, false, AudioAttributes.USAGE_NOTIFICATION_EVENT, () -> {
            // Keep the reminder in the shade after the sound ends.
            if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_DETACH);
            else stopForeground(false);
            if (ringingId == null) stopSelf();
        });
        handler.postDelayed(() -> chimeSound.stop(), 20_000);
    }

    private void startVibration() {
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !playing) return;
        long[] pattern = {0, 400, 600, 400, 1600};
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
        else vibrator.vibrate(pattern, 0);
    }

    private void stopSound() {
        playing = false;
        handler.removeCallbacks(vibrate);
        handler.removeCallbacks(timeout);
        if (vibrator != null) vibrator.cancel();
        sound.stop();
    }

    /** Nobody answered: snooze 5 minutes and ring again, until an hour after the first ring. */
    private void unanswered() {
        AlarmStore.Alarm a = current();
        long next = AlarmScheduler.nextAutoRing(chainStart, System.currentTimeMillis());
        if (a == null || next < 0) {
            stopRinging(true);
            return;
        }
        String label = ringingLabel;
        stopRinging(false);
        AlarmScheduler.autoSnooze(this, a, next);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        PendingIntent stop = PendingIntent.getService(this, 6913, new Intent(this, AlarmService.class).setAction(ACTION_STOP_AUTO),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String at = java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(new java.util.Date(next));
        try {
            nm.notify(AUTO_ID, new NotificationCompat.Builder(this, AlarmReceiver.CH_GENTLE)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Snoozed: " + (label == null ? "Alarm" : label))
                .setContentText("No answer, so it rings again at " + at + ".")
                .setOngoing(true)
                .setSilent(true)
                .addAction(0, "Stop alarm", stop)
                .build());
        } catch (SecurityException ignored) {
        }
    }

    private void stopRinging(boolean missed) {
        stopSound();
        if (wake != null && wake.isHeld()) wake.release();
        String label = ringingLabel;
        ringingId = null;
        stopForeground(true);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIF_ID);
        if (missed && nm != null) {
            try {
                nm.notify(NOTIF_ID + 1, new NotificationCompat.Builder(this, AlarmReceiver.CH_GENTLE)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle("Missed alarm: " + (label == null ? "Alarm" : label))
                    .setContentText("It kept ringing on and off for an hour. Tap to open Habit Lab.")
                    .setAutoCancel(true)
                    .setContentIntent(AlarmReceiver.openApp(this, "#/today", null, 6905))
                    .build());
            } catch (SecurityException ignored) {
            }
        }
        sendBroadcast(new Intent(AlarmActivity.ACTION_FINISH).setPackage(getPackageName()));
        stopSelf();
    }

    static void showWakeScreen(Context ctx) {
        try {
            ctx.startActivity(new Intent(ctx, AlarmActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION | Intent.FLAG_ACTIVITY_SINGLE_TOP));
        } catch (Exception ignored) {
            // background start blocked: the notification still rings
        }
    }

    static void openApp(Context ctx, String route, String message) {
        try {
            AlarmReceiver.openApp(ctx, route == null ? "#/today" : route, message, 6906).send();
        } catch (PendingIntent.CanceledException ignored) {
        }
    }

    @Override
    public void onDestroy() {
        stopSound();
        chimeSound.stop();
        if (wake != null && wake.isHeld()) wake.release();
        super.onDestroy();
    }
}
