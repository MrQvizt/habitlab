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
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;

import androidx.activity.result.ActivityResult;

import org.json.JSONObject;

import org.json.JSONArray;
import org.json.JSONException;

/** JS bridge: window.Capacitor.Plugins.HabitAlarm */
@CapacitorPlugin(name = "HabitAlarm")
public class HabitAlarmPlugin extends Plugin {
    private static String pendingRoute;
    private static String pendingMessage;
    private static String pendingWake;

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
            o.put("wake", pendingWake);
            pendingRoute = null;
            pendingMessage = null;
            pendingWake = null;
            notifyListeners("route", o, true);
        }
    }

    private static boolean capture(Intent intent) {
        if (intent == null) return false;
        String r = intent.getStringExtra("habit_route");
        if (r == null) return false;
        pendingRoute = r;
        pendingMessage = intent.getStringExtra("habit_message");
        pendingWake = intent.getStringExtra("habit_wake");
        intent.removeExtra("habit_route");
        intent.removeExtra("habit_message");
        intent.removeExtra("habit_wake");
        return true;
    }

    @PluginMethod
    public void consumeRoute(PluginCall call) {
        JSObject o = new JSObject();
        o.put("route", pendingRoute);
        o.put("message", pendingMessage);
        o.put("wake", pendingWake);
        pendingRoute = null;
        pendingMessage = null;
        pendingWake = null;
        call.resolve(o);
    }

    @PluginMethod
    public void setAlarms(PluginCall call) {
        JSArray alarms = call.getArray("alarms", new JSArray());
        JSArray messages = call.getArray("messages", new JSArray());
        int snooze = call.getInt("snooze", 9);
        AlarmStore.save(getContext(), alarms, messages, snooze);
        AlarmStore.saveMorning(getContext(), call.getArray("values", new JSArray()), call.getArray("favs", new JSArray()));
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
        // Without "Display over other apps", Android shows a ringing alarm as a notification while the phone is in use.
        o.put("overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c));
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
        } else if ("overlay".equals(which) && Build.VERSION.SDK_INT >= 23) {
            i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg);
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

    // ---------- Sounds from the phone ----------
    private final SoundPlayer preview = new SoundPlayer();

    /** Opens Android's sound picker; resolves {uri, title} (or {cancelled: true}). */
    @PluginMethod
    public void pickSound(PluginCall call) {
        Intent i = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER)
            .putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALL)
            .putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Alarm sound")
            .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
            .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        String cur = call.getString("uri");
        if (cur != null && !cur.isEmpty()) i.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(cur));
        startActivityForResult(call, i, "pickSoundResult");
    }

    @ActivityCallback
    private void pickSoundResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject o = new JSObject();
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        if (uri == null) {
            o.put("cancelled", true);
            call.resolve(o);
            return;
        }
        String title = "Sound from phone";
        try {
            Ringtone r = RingtoneManager.getRingtone(getContext(), uri);
            if (r != null) title = r.getTitle(getContext());
        } catch (Exception ignored) {
        }
        o.put("uri", uri.toString());
        o.put("title", title);
        call.resolve(o);
    }

    /** Preview a phone sound ({sound: 'device'} or {sound: 'uri', uri}) for a few seconds. */
    @PluginMethod
    public void previewSound(PluginCall call) {
        try {
            JSONObject spec = new JSONObject(call.getData().toString());
            preview.start(getContext(), spec, false, AudioAttributes.USAGE_NOTIFICATION_EVENT, null);
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(preview::stop, 6000);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn’t play that sound");
        }
    }

    @PluginMethod
    public void stopPreview(PluginCall call) {
        preview.stop();
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
