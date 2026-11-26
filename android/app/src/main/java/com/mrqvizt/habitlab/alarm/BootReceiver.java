package com.mrqvizt.habitlab.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Re-schedules alarms after a reboot, an app update or a clock/time-zone change.
 * Exported (the system must reach it), so it does nothing but reschedule: another app sending it
 * an intent can at most cause a harmless re-schedule. Firing alarms is handled by AlarmReceiver,
 * which is not exported.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)
            || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) {
            AlarmScheduler.scheduleAll(ctx);
            FriendsWatch.schedule(ctx);
        }
    }
}
