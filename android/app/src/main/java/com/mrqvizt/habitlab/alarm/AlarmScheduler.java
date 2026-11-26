package com.mrqvizt.habitlab.alarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.mrqvizt.habitlab.MainActivity;

import java.util.Calendar;
import java.util.List;

/**
 * Schedules each alarm's next occurrence with AlarmManager.setAlarmClock: exact, allowed through
 * Doze, and shown as the next alarm in the status bar — the same API clock apps use.
 */
public final class AlarmScheduler {
    public static final String ACTION_FIRE = "com.mrqvizt.habitlab.alarm.FIRE";
    public static final String EXTRA_ID = "alarm_id";

    private AlarmScheduler() {}

    /** Next trigger time (ms) for a repeating weekday alarm, strictly after `from`. */
    public static long nextTrigger(AlarmStore.Alarm a, long from) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(from);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        c.set(Calendar.HOUR_OF_DAY, a.hour);
        c.set(Calendar.MINUTE, a.minute);
        for (int i = 0; i < 8; i++) {
            if (c.getTimeInMillis() > from) {
                int dow = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7; // Monday = 0
                if (a.days[dow]) return c.getTimeInMillis();
            }
            c.add(Calendar.DAY_OF_MONTH, 1);
            c.set(Calendar.HOUR_OF_DAY, a.hour);
            c.set(Calendar.MINUTE, a.minute);
        }
        return -1;
    }

    private static PendingIntent firePending(Context ctx, String id, int code) {
        Intent i = new Intent(ctx, AlarmReceiver.class).setAction(ACTION_FIRE).putExtra(EXTRA_ID, id);
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent showPending(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class).putExtra("habit_route", "#/settings/alarms").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(ctx, 6999, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static boolean canExact(Context ctx) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    private static void setAt(Context ctx, long at, PendingIntent pi) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            if (canExact(ctx)) {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPending(ctx)), pi);
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); // inexact fallback
            } else {
                am.set(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    /** Cancel everything previously scheduled and schedule the next occurrence of each alarm. */
    public static void scheduleAll(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (String code : AlarmStore.scheduledCodes(ctx).split(",")) {
            if (code.isEmpty()) continue;
            try {
                String[] parts = code.split(":", 2);
                am.cancel(firePending(ctx, parts.length > 1 ? parts[1] : "", Integer.parseInt(parts[0])));
            } catch (NumberFormatException ignored) {
            }
        }
        StringBuilder codes = new StringBuilder();
        long now = System.currentTimeMillis();
        List<AlarmStore.Alarm> list = AlarmStore.alarms(ctx);
        for (AlarmStore.Alarm a : list) {
            long at = nextTrigger(a, now);
            if (at < 0) continue;
            setAt(ctx, at, firePending(ctx, a.id, a.code()));
            codes.append(a.code()).append(':').append(a.id).append(',');
        }
        // A pending snooze survives rescheduling.
        AlarmStore.Alarm s = AlarmStore.snoozed(ctx);
        long sAt = AlarmStore.snoozeAt(ctx);
        if (s != null && sAt > now) {
            setAt(ctx, sAt, firePending(ctx, s.id, s.code()));
            codes.append(s.code()).append(':').append(s.id).append(',');
        }
        AlarmStore.setScheduledCodes(ctx, codes.toString());
    }

    public static void snooze(Context ctx, AlarmStore.Alarm a) {
        snooze(ctx, a, AlarmStore.snoozeMinutes(ctx));
    }

    /** Snooze for a chosen number of minutes (1–60), as picked with − / + on the wake screen. */
    public static void snooze(Context ctx, AlarmStore.Alarm a, int minutes) {
        AlarmStore.Alarm s = AlarmStore.snoozeCopy(a.id.endsWith("_snooze") ? base(ctx, a) : a);
        long at = System.currentTimeMillis() + Math.max(1, Math.min(60, minutes)) * 60_000L;
        AlarmStore.putSnooze(ctx, s, at);
        scheduleAll(ctx);
    }

    private static AlarmStore.Alarm base(Context ctx, AlarmStore.Alarm a) {
        AlarmStore.Alarm b = AlarmStore.find(ctx, a.id.replace("_snooze", ""));
        if (b != null) return b;
        a.id = a.id.replace("_snooze", "");
        return a;
    }

    /** A one-off test ring in `seconds`. */
    public static void test(Context ctx, AlarmStore.Alarm a, int seconds) {
        long at = System.currentTimeMillis() + Math.max(3, seconds) * 1000L;
        AlarmStore.putSnooze(ctx, AlarmStore.snoozeCopy(a), at);
        scheduleAll(ctx);
    }
}
