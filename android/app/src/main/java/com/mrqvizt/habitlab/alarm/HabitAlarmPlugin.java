package com.mrqvizt.habitlab.alarm;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

/** JS bridge: window.Capacitor.Plugins.HabitAlarm */
@CapacitorPlugin(name = "HabitAlarm")
public class HabitAlarmPlugin extends Plugin {
    private static String pendingRoute;
    private static String pendingMessage;

    @Override
    public void load() {
        if (getActivity() != null) capture(getActivity().getIntent());
        AlarmReceiver.channels(getContext());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (capture(intent)) {
            JSObject o = new JSObject();
            o.put("route", pendingRoute);
            o.put("message", pendingMessage);
            notifyListeners("route", o, true);
        }
    }

    private static boolean capture(Intent intent) {
        if (intent == null) return false;
        String r = intent.getStringExtra("habit_route");
        if (r == null) return false;
        pendingRoute = r;
        pendingMessage = intent.getStringExtra("habit_message");
        intent.removeExtra("habit_route");
        intent.removeExtra("habit_message");
        return true;
    }

    @PluginMethod
    public void consumeRoute(PluginCall call) {
        JSObject o = new JSObject();
        o.put("route", pendingRoute);
        o.put("message", pendingMessage);
        pendingRoute = null;
        pendingMessage = null;
        call.resolve(o);
    }

    @PluginMethod
    public void setAlarms(PluginCall call) {
        JSArray alarms = call.getArray("alarms", new JSArray());
        JSArray messages = call.getArray("messages", new JSArray());
        int snooze = call.getInt("snooze", 9);
        AlarmStore.save(getContext(), alarms, messages, snooze);
        AlarmScheduler.scheduleAll(getContext());
        call.resolve(status());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    private JSObject status() {
        Context c = getContext();
        JSObject o = new JSObject();
        o.put("exact", AlarmScheduler.canExact(c));
        o.put("notifications", NotificationManagerCompat.from(c).areNotificationsEnabled());
        boolean full = true;
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            full = nm != null && nm.canUseFullScreenIntent();
        }
        o.put("fullScreen", full);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        AlarmManager.AlarmClockInfo next = am == null ? null : am.getNextAlarmClock();
        o.put("next", next == null ? 0 : next.getTriggerTime());
        o.put("count", AlarmStore.alarms(c).size());
        return o;
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String which = call.getString("which", "app");
        Context c = getContext();
        Intent i;
        Uri pkg = Uri.parse("package:" + c.getPackageName());
        if ("exact".equals(which) && Build.VERSION.SDK_INT >= 31) {
            i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg);
        } else if ("fullScreen".equals(which) && Build.VERSION.SDK_INT >= 34) {
            i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg);
        } else if ("notifications".equals(which) && Build.VERSION.SDK_INT >= 26) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName());
        } else if ("battery".equals(which)) {
            i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg);
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            c.startActivity(i);
        } catch (Exception e) {
            c.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }

    /** Ring a saved alarm (by id) in a few seconds, to try it out. */
    @PluginMethod
    public void test(PluginCall call) {
        String id = call.getString("id", "wake");
        int seconds = call.getInt("seconds", 5);
        AlarmStore.Alarm a = AlarmStore.find(getContext(), id);
        if (a == null) {
            call.reject("Save the alarm first");
            return;
        }
        AlarmScheduler.test(getContext(), a, seconds);
        call.resolve();
    }

    static JSONArray safe(JSArray a) {
        try {
            return new JSONArray(a.toString());
        } catch (JSONException e) {
            return new JSONArray();
        }
    }
}
