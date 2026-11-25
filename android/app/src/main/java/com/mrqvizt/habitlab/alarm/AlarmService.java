package com.mrqvizt.habitlab.alarm;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

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
    public static final int NOTIF_ID = 6901;
    private static final long MAX_RING_MS = 10 * 60_000L;

    /** What is ringing now (read by AlarmActivity). */
    public static volatile String ringingId;
    public static volatile String ringingKind;
    public static volatile String ringingLabel;
    public static volatile String ringingBody;
    public static volatile String ringingRoute;
    public static volatile String ringingMessage;

    private volatile boolean playing;
    private Thread player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wake;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable vibrate = this::startVibration;
    private final Runnable timeout = () -> stopRinging(true);

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
        if (ACTION_SNOOZE.equals(action)) {
            AlarmStore.Alarm a = current();
            stopRinging(false);
            if (a != null) AlarmScheduler.snooze(this, a);
            return START_NOT_STICKY;
        }
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        // START: one alarm at a time; a new one replaces the old.
        stopSound();
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
        startSound();
        handler.postDelayed(vibrate, 20_000);
        handler.postDelayed(timeout, MAX_RING_MS);
        // Try to show the wake screen directly too (allowed for alarm apps with full-screen intent).
        try {
            startActivity(new Intent(this, AlarmActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION));
        } catch (Exception ignored) {
            // background activity start blocked: the full-screen notification covers it
        }
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

    // ---------- sound ----------
    private static final double[] MELODY = {523.25, 659.25, 783.99, 880.00, 1046.50, 880.00, 783.99, 659.25}; // C-major pentatonic
    private static final int RATE = 44100;

    private void startSound() {
        playing = true;
        player = new Thread(() -> {
            AudioTrack track = null;
            try {
                int minBuf = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
                track = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                    .setAudioFormat(new AudioFormat.Builder().setSampleRate(RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setBufferSizeInBytes(Math.max(minBuf, RATE))
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build();
                track.play();
                long t0 = System.currentTimeMillis();
                int noteLen = (int) (RATE * 0.34);
                short[] buf = new short[noteLen];
                short[] rest = new short[(int) (RATE * 0.9)];
                while (playing) {
                    for (double f : MELODY) {
                        if (!playing) break;
                        double secs = (System.currentTimeMillis() - t0) / 1000.0;
                        double gain = 0.06 + 0.94 * Math.min(1.0, Math.pow(secs / 60.0, 1.6)); // crescendo over ~1 minute
                        for (int i = 0; i < noteLen; i++) {
                            double t = (double) i / RATE;
                            double env = Math.min(1.0, t / 0.012) * Math.exp(-t * 6.5); // soft attack, bell-like decay
                            double s = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t);
                            buf[i] = (short) (s / 1.47 * env * gain * 0.85 * Short.MAX_VALUE);
                        }
                        track.write(buf, 0, buf.length);
                    }
                    if (playing) track.write(rest, 0, rest.length);
                }
            } catch (Exception ignored) {
                // audio unavailable
            } finally {
                if (track != null) {
                    try {
                        track.stop();
                    } catch (Exception ignored) {
                    }
                    track.release();
                }
            }
        }, "habitlab-alarm");
        player.start();
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
        if (player != null) {
            try {
                player.join(600);
            } catch (InterruptedException ignored) {
            }
            player = null;
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
                    .setContentText("It rang for 10 minutes. Tap to open Habit Lab.")
                    .setAutoCancel(true)
                    .setContentIntent(AlarmReceiver.openApp(this, "#/today", null, 6905))
                    .build());
            } catch (SecurityException ignored) {
            }
        }
        sendBroadcast(new Intent(AlarmActivity.ACTION_FINISH).setPackage(getPackageName()));
        stopSelf();
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
        if (wake != null && wake.isHeld()) wake.release();
        super.onDestroy();
    }
}
