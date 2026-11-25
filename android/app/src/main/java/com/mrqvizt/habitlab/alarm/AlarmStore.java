package com.mrqvizt.habitlab.alarm;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Alarms and morning messages, persisted so they survive reboots and app updates. */
public final class AlarmStore {
    private static final String PREFS = "habit_alarms";

    private AlarmStore() {}

    public static final class Alarm {
        public String id;
        public String kind; // wake | wind | bed | meal
        public String label;
        public String body;
        public int hour;
        public int minute;
        public boolean[] days = new boolean[7]; // Monday = 0
        public String style; // ring | gentle
        public String route;

        static Alarm fromJson(JSONObject o) {
            Alarm a = new Alarm();
            a.id = o.optString("id", "alarm");
            a.kind = o.optString("kind", "wake");
            a.label = o.optString("label", "Alarm");
            a.body = o.optString("body", "");
            a.hour = Math.max(0, Math.min(23, o.optInt("hour", 7)));
            a.minute = Math.max(0, Math.min(59, o.optInt("minute", 0)));
            a.style = o.optString("style", "ring");
            a.route = o.optString("route", "#/today");
            JSONArray d = o.optJSONArray("days");
            boolean any = false;
            if (d != null) {
                for (int i = 0; i < d.length(); i++) {
                    int v = d.optInt(i, -1);
                    if (v >= 0 && v < 7) {
                        a.days[v] = true;
                        any = true;
                    }
                }
            }
            if (!any) for (int i = 0; i < 7; i++) a.days[i] = true;
            return a;
        }

        JSONObject toJson() throws JSONException {
            JSONObject o = new JSONObject();
            o.put("id", id).put("kind", kind).put("label", label).put("body", body).put("hour", hour).put("minute", minute).put("style", style).put("route", route);
            JSONArray d = new JSONArray();
            for (int i = 0; i < 7; i++) if (days[i]) d.put(i);
            o.put("days", d);
            return o;
        }

        /** Stable request code for PendingIntents. */
        public int code() {
            return 7000 + (id.hashCode() & 0x3fff);
        }
    }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void save(Context c, JSONArray alarms, JSONArray messages, int snoozeMin) {
        prefs(c).edit()
            .putString("alarms", alarms == null ? "[]" : alarms.toString())
            .putString("messages", messages == null ? "[]" : messages.toString())
            .putInt("snooze", Math.max(1, Math.min(30, snoozeMin)))
            .apply();
    }

    public static List<Alarm> alarms(Context c) {
        List<Alarm> out = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(prefs(c).getString("alarms", "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o != null) out.add(Alarm.fromJson(o));
            }
        } catch (JSONException ignored) {
            // corrupt store: no alarms
        }
        return out;
    }

    public static Alarm find(Context c, String id) {
        for (Alarm a : alarms(c)) if (a.id.equals(id)) return a;
        return null;
    }

    /** Previously scheduled request codes, so removed alarms can be cancelled. */
    public static String scheduledCodes(Context c) {
        return prefs(c).getString("codes", "");
    }

    public static void setScheduledCodes(Context c, String codes) {
        prefs(c).edit().putString("codes", codes).apply();
    }

    public static int snoozeMinutes(Context c) {
        return prefs(c).getInt("snooze", 9);
    }

    /** Today's morning message: rotates by day so each morning is different. */
    public static String messageFor(Context c, long epochDay) {
        try {
            JSONArray arr = new JSONArray(prefs(c).getString("messages", "[]"));
            if (arr.length() == 0) return "Good morning. Today is a fresh start, and you deserve a healthy life.";
            int i = (int) (Math.abs(epochDay) % arr.length());
            return arr.optString(i, "Good morning.");
        } catch (JSONException e) {
            return "Good morning.";
        }
    }

    public static Alarm snoozeCopy(Alarm a) {
        Alarm s = new Alarm();
        s.id = a.id + "_snooze";
        s.kind = a.kind;
        s.label = a.label;
        s.body = a.body;
        s.style = a.style;
        s.route = a.route;
        return s;
    }

    public static void putSnooze(Context c, Alarm a, long at) {
        try {
            prefs(c).edit().putString("snooze_alarm", a.toJson().toString()).putLong("snooze_at", at).apply();
        } catch (JSONException ignored) {
        }
    }

    public static Alarm snoozed(Context c) {
        try {
            String s = prefs(c).getString("snooze_alarm", null);
            return s == null ? null : Alarm.fromJson(new JSONObject(s));
        } catch (JSONException e) {
            return null;
        }
    }

    public static long snoozeAt(Context c) {
        return prefs(c).getLong("snooze_at", 0);
    }

    public static void clearSnooze(Context c) {
        prefs(c).edit().remove("snooze_alarm").remove("snooze_at").apply();
    }
}
