package com.mrqvizt.habitlab.alarm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.mrqvizt.habitlab.MainActivity;

/** Fires alarms, and re-schedules them after a reboot, an app update or a clock change. */
public class AlarmReceiver extends BroadcastReceiver {
    public static final String CH_ALARM = "habit_alarm";
    public static final String CH_GENTLE = "habit_gentle";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (AlarmScheduler.ACTION_FIRE.equals(action)) {
            String id = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
            AlarmStore.Alarm a = null;
            if (id != null && id.endsWith("_snooze")) {
                a = AlarmStore.snoozed(ctx);
                AlarmStore.clearSnooze(ctx);
            } else if (id != null) {
                a = AlarmStore.find(ctx, id);
            }
            if (a != null) {
                if ("gentle".equals(a.style)) gentle(ctx, a);
                else {
                    Intent s = new Intent(ctx, AlarmService.class).setAction(AlarmService.ACTION_START).putExtra(AlarmScheduler.EXTRA_ID, a.id)
                        .putExtra("kind", a.kind).putExtra("label", a.label).putExtra("body", a.body).putExtra("route", a.route).putExtra("style", a.style);
                    ContextCompat.startForegroundService(ctx, s);
                }
            }
        }
        // Always line up the next occurrence (also handles BOOT_COMPLETED, TIME_SET, package replaced).
        AlarmScheduler.scheduleAll(ctx);
    }

    static void channels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel alarm = new NotificationChannel(CH_ALARM, "Alarms", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("Wake-up and other ringing alarms");
        alarm.setSound(null, null); // the service plays the melody itself
        alarm.enableVibration(false);
        alarm.setBypassDnd(true);
        alarm.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(alarm);
        NotificationChannel gentle = new NotificationChannel(CH_GENTLE, "Gentle reminders", NotificationManager.IMPORTANCE_HIGH);
        gentle.setDescription("Meal and wind-down chimes");
        gentle.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        gentle.enableVibration(true);
        nm.createNotificationChannel(gentle);
    }

    static PendingIntent openApp(Context ctx, String route, String message, int code) {
        Intent i = new Intent(ctx, MainActivity.class)
            .putExtra("habit_route", route)
            .putExtra("habit_message", message)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void gentle(Context ctx, AlarmStore.Alarm a) {
        channels(ctx);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CH_GENTLE)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(a.label)
            .setContentText(a.body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(a.body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openApp(ctx, a.route, null, a.code()));
        try {
            nm.notify(a.code(), b.build());
        } catch (SecurityException ignored) {
            // notifications not permitted
        }
    }
}
