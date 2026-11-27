package com.mrqvizt.habitlab.alarm;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Friends on your shared calendar: about every 15 minutes (inexact, battery-friendly, even when the
 * app is closed) ask the calendar service who's joining and who sent a cheer, and show a
 * notification for anything new. Uses only your own calendar id and key, kept on this phone.
 * Things you already saw in the app are marked seen, so they don't notify twice.
 */
public final class FriendsWatch {
    static final String ACTION_CHECK = "com.mrqvizt.habitlab.friends.CHECK";
    static final String CHANNEL = "friends";
    private static final String PREFS = "habitlab_friends";
    private static final String BASE = "https://jwjabhcebwnzhfphsuwg.supabase.co/rest/v1/rpc/";
    // Publishable key: safe in an app; it only reaches the calendar functions.
    private static final String API_KEY = "sb_publishable_wRKoEGC_8OtpR9SoT8tGkQ_Z9rhDWjl";
    private static final long EVERY = 15 * 60_000L;

    private FriendsWatch() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** From the app: start (or stop) watching, with titles for nicer messages. */
    public static void configure(Context c, String id, String key, boolean on, JSONObject titles) {
        SharedPreferences.Editor e = prefs(c).edit();
        if (!on || id == null || key == null) {
            e.putBoolean("on", false);
        } else {
            if (!id.equals(prefs(c).getString("id", ""))) e.remove("seen").remove("cheer").putBoolean("baselined", false);
            e.putBoolean("on", true).putString("id", id).putString("key", key);
            if (titles != null) e.putString("titles", titles.toString());
        }
        e.apply();
        schedule(c);
    }

    /** From the app: what you've already seen on screen (so it won't notify again). */
    public static void markSeen(Context c, JSONArray signups, long cheerId) {
        Set<String> seen = seen(c);
        for (int i = 0; signups != null && i < signups.length(); i++) {
            JSONObject s = signups.optJSONObject(i);
            if (s != null) seen.add(keyOf(s.optString("event"), s.optString("name")));
        }
        save(c, seen, Math.max(prefs(c).getLong("cheer", 0), cheerId), true);
    }

    static String keyOf(String event, String name) {
        return event + "|" + (name == null ? "" : name.trim().toLowerCase());
    }

    private static PendingIntent pending(Context c, int flags) {
        Intent i = new Intent(c, FriendsReceiver.class).setAction(ACTION_CHECK);
        return PendingIntent.getBroadcast(c, 7301, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pending(c, PendingIntent.FLAG_UPDATE_CURRENT);
        if (!prefs(c).getBoolean("on", false)) {
            am.cancel(pi);
            return;
        }
        am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + 60_000L, EVERY, pi);
    }

    private static Set<String> seen(Context c) {
        Set<String> out = new LinkedHashSet<>();
        try {
            JSONArray a = new JSONArray(prefs(c).getString("seen", "[]"));
            for (int i = 0; i < a.length(); i++) out.add(a.optString(i));
        } catch (Exception ignored) {
        }
        return out;
    }

    private static void save(Context c, Set<String> seen, long cheer, boolean baselined) {
        List<String> list = new ArrayList<>(seen);
        if (list.size() > 600) list = list.subList(list.size() - 600, list.size());
        prefs(c).edit().putString("seen", new JSONArray(list).toString()).putLong("cheer", cheer).putBoolean("baselined", baselined).apply();
    }

    private static String post(String fn, String body) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(BASE + fn).openConnection();
        h.setConnectTimeout(10_000);
        h.setReadTimeout(10_000);
        h.setRequestMethod("POST");
        h.setDoOutput(true);
        h.setRequestProperty("apikey", API_KEY);
        h.setRequestProperty("Content-Type", "application/json");
        try (OutputStream o = h.getOutputStream()) {
            o.write(body.getBytes(StandardCharsets.UTF_8));
        }
        if (h.getResponseCode() != 200) throw new Exception("HTTP " + h.getResponseCode());
        try (InputStream in = h.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } finally {
            h.disconnect();
        }
    }

    /** One check (run on a background thread by FriendsReceiver). */
    static void check(Context c) {
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("on", false)) return;
        String id = p.getString("id", null);
        String key = p.getString("key", null);
        if (id == null || key == null) return;
        try {
            JSONObject args = new JSONObject().put("p_id", id).put("p_key", key);
            JSONArray signups = new JSONArray(post("hl_signups", args.toString()));
            JSONArray cheers = new JSONArray(post("hl_cheers", args.toString()));
            JSONObject titles = new JSONObject(p.getString("titles", "{}"));
            boolean first = !p.getBoolean("baselined", false);
            Set<String> seen = seen(c);
            long lastCheer = p.getLong("cheer", 0);
            long maxCheer = lastCheer;
            channel(c);
            for (int i = 0; i < signups.length(); i++) {
                JSONObject s = signups.optJSONObject(i);
                if (s == null) continue;
                String k = keyOf(s.optString("event"), s.optString("name"));
                if (seen.add(k) && !first) {
                    String what = titles.optString(s.optString("event"), "your activity");
                    notify(c, k.hashCode(), s.optString("name") + " is joining you", what, "#/inbox");
                }
            }
            for (int i = 0; i < cheers.length(); i++) {
                JSONObject ch = cheers.optJSONObject(i);
                if (ch == null) continue;
                long cid = ch.optLong("id");
                if (cid > lastCheer && !first) notify(c, (int) (8000 + (cid % 1000)), "💌 " + ch.optString("name") + " sent you a cheer", ch.optString("message"), "#/inbox");
                maxCheer = Math.max(maxCheer, cid);
            }
            save(c, seen, maxCheer, true);
        } catch (Exception ignored) {
            // offline or the service is busy: try again next time
        }
    }

    private static void channel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Friends", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("When a friend joins one of your activities or sends you a cheer");
        nm.createNotificationChannel(ch);
    }

    private static void notify(Context c, int id, String title, String body, String route) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            nm.notify(id, new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(AlarmReceiver.openApp(c, route, null, 7400 + (id & 0xff)))
                .build());
        } catch (SecurityException ignored) {
            // notifications not allowed
        }
    }
}
