package com.mrqvizt.habitlab.alarm;

import android.animation.ArgbEvaluator;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.Date;

/**
 * Full-screen wake screen shown over the lock screen. For the morning alarm the background moves
 * from night to sunrise colours while the screen brightens over ~40 s, a small nod to dawn
 * simulation (artificial dawn reduced sleepiness after waking: Van de Werken et al., J Sleep Res 2010).
 */
public class AlarmActivity extends Activity {
    public static final String ACTION_FINISH = "com.mrqvizt.habitlab.alarm.FINISH";
    private final BroadcastReceiver finisher = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            if (!morning) finish();
        }
    };
    private ValueAnimator dawn;
    private boolean morning = false;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (Build.VERSION.SDK_INT >= 27) {
            // Show over the lock screen like a clock app; don't ask for the PIN to see or stop the alarm.
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (AlarmService.ringingId == null) {
            finish();
            return;
        }
        boolean wake = "wake".equals(AlarmService.ringingKind);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        final int pad = dp(24);
        root.setPadding(pad, dp(40), pad, dp(20));
        // Android 15 draws behind the status and navigation bars: keep the buttons clear of them.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int top = insets.getSystemWindowInsetTop();
            int bottom = insets.getSystemWindowInsetBottom();
            v.setPadding(pad + insets.getSystemWindowInsetLeft(), dp(32) + top, pad + insets.getSystemWindowInsetRight(), dp(20) + bottom);
            return insets;
        });
        final GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] {0xFF141A33, 0xFF2B2050});
        root.setBackground(bg);

        TextView time = text(DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date()), 56, true);
        TextView label = text(AlarmService.ringingLabel == null ? "Alarm" : AlarmService.ringingLabel, 20, true);
        label.setAlpha(0.9f);
        root.addView(time);
        root.addView(label);

        // The message sits in the free space and scrolls if it's long, so the buttons always fit.
        LinearLayout middle = new LinearLayout(this);
        middle.setOrientation(LinearLayout.VERTICAL);
        middle.setGravity(Gravity.CENTER);
        String msg = AlarmService.ringingMessage;
        if (msg != null && !msg.isEmpty()) {
            if (wake) {
                TextView kicker = text("A thought for this morning", 13, true);
                kicker.setAllCaps(true);
                kicker.setLetterSpacing(0.12f);
                kicker.setAlpha(0.85f);
                middle.addView(kicker);
            }
            TextView m = text(msg, wake ? 26 : 21, true);
            m.setLineSpacing(0, 1.15f);
            m.setPadding(0, dp(10), 0, 0);
            middle.addView(m);
        }
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(middle, new ScrollView.LayoutParams(ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.MATCH_PARENT));
        LinearLayout.LayoutParams mid = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f);
        mid.topMargin = dp(12);
        mid.bottomMargin = dp(12);
        root.addView(scroll, mid);

        Button up = button(wake ? "I'm up" : "Done", true);
        up.setOnClickListener(v -> {
            if (wake) {
                // Stop the sound and stay on the lock screen with the morning screen; the PIN is only
                // asked for when "Start my day" opens the app.
                String m = AlarmService.ringingMessage;
                morning = true;
                startService(new Intent(this, AlarmService.class).setAction(AlarmService.ACTION_DISMISS));
                showMorning(m);
            } else {
                startService(new Intent(this, AlarmService.class).setAction(AlarmService.ACTION_DISMISS));
                finish();
            }
        });
        // Snooze: starts at your usual length; − / + change it for this time only.
        snoozeMin = AlarmStore.snoozeMinutes(this);
        final Button snooze = button(snoozeText(), false);
        snooze.setOnClickListener(v -> {
            startService(new Intent(this, AlarmService.class).setAction(AlarmService.ACTION_SNOOZE).putExtra("minutes", snoozeMin));
            finish();
        });
        Button minus = button("−", false);
        Button plus = button("+", false);
        minus.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        plus.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        minus.setContentDescription("Shorter snooze");
        plus.setContentDescription("Longer snooze");
        minus.setOnClickListener(v -> {
            snoozeMin = step(snoozeMin, -1);
            snooze.setText(snoozeText());
        });
        plus.setOnClickListener(v -> {
            snoozeMin = step(snoozeMin, 1);
            snooze.setText(snoozeText());
        });
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams side = new LinearLayout.LayoutParams(dp(56), LinearLayout.LayoutParams.MATCH_PARENT);
        LinearLayout.LayoutParams centre = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f);
        centre.leftMargin = dp(10);
        centre.rightMargin = dp(10);
        row.addView(minus, side);
        row.addView(snooze, centre);
        row.addView(plus, new LinearLayout.LayoutParams(side));

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56));
        root.addView(up, lp);
        LinearLayout.LayoutParams lp2 = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56));
        lp2.topMargin = dp(10);
        root.addView(row, lp2);
        setContentView(root);

        ContextCompat.registerReceiver(this, finisher, new IntentFilter(ACTION_FINISH), ContextCompat.RECEIVER_NOT_EXPORTED);

        if (wake) {
            // Night → sunrise colours, and the screen brightens gradually.
            final ArgbEvaluator ev = new ArgbEvaluator();
            final int[] from = {0xFF141A33, 0xFF2B2050};
            final int[] to = {0xFFFF8A5B, 0xFFFFD27A};
            final WindowManager.LayoutParams attrs = getWindow().getAttributes();
            dawn = ValueAnimator.ofFloat(0f, 1f);
            dawn.setDuration(40_000);
            dawn.addUpdateListener(a -> {
                float k = (float) a.getAnimatedValue();
                bg.setColors(new int[] {(int) ev.evaluate(k, from[0], to[0]), (int) ev.evaluate(k, from[1], to[1])});
                attrs.screenBrightness = 0.08f + 0.92f * k;
                getWindow().setAttributes(attrs);
            });
            dawn.start();
        }
    }

    // ---------- Morning screen (after "I'm up"), shown over the lock screen ----------
    private final java.util.LinkedHashSet<String> chosen = new java.util.LinkedHashSet<>();
    private String other = "";
    private final java.util.List<String> added = new java.util.ArrayList<>();

    private interface Adder {
        void add(String label);
    }
    private final java.util.Map<String, String> phrases = new java.util.HashMap<>();
    private boolean fav;

    private void showMorning(String msg) {
        if (dawn != null) dawn.cancel();
        final String message = msg == null ? "" : msg;
        fav = AlarmStore.isFav(this, message);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        WindowManager.LayoutParams attrs = getWindow().getAttributes();
        attrs.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
        getWindow().setAttributes(attrs);

        final LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] {0xFFD4687A, 0xFFFF8F5E, 0xFFFFCF7A}));
        final int pad = dp(28);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(pad + insets.getSystemWindowInsetLeft(), dp(24) + insets.getSystemWindowInsetTop(), pad + insets.getSystemWindowInsetRight(), dp(20) + insets.getSystemWindowInsetBottom());
            return insets;
        });

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_VERTICAL);

        TextView date = left(text(new SimpleDateFormat("EEEE d MMMM", Locale.getDefault()).format(new Date()), 13, true));
        date.setAllCaps(true);
        date.setLetterSpacing(0.12f);
        date.setAlpha(0.85f);
        col.addView(date);
        TextView hello = left(text(greeting(), 40, true));
        hello.setPadding(0, dp(10), 0, dp(10));
        col.addView(hello);
        if (!message.isEmpty()) {
            TextView m = left(text(message, 24, true));
            m.setLineSpacing(0, 1.15f);
            col.addView(m);
        }
        final Button heart = pill(fav ? "\u2665 Saved \u2014 you\u2019ll see it more often" : "\u2661 This one boosted me", false);
        heart.setOnClickListener(v -> {
            fav = !fav;
            heart.setText(fav ? "\u2665 Saved \u2014 you\u2019ll see it more often" : "\u2661 This one boosted me");
        });
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(48));
        hp.topMargin = dp(16);
        if (!message.isEmpty()) col.addView(heart, hp);

        // "Today I'm doing this for…" — your values, plus "Me"
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        int cp = dp(18);
        card.setPadding(cp, cp, cp, cp);
        GradientDrawable cb = new GradientDrawable();
        cb.setCornerRadius(dp(24));
        cb.setColor(0x26000000);
        card.setBackground(cb);
        TextView k = left(text("Today I\u2019m doing this for\u2026  (pick any)", 13, true));
        k.setAllCaps(true);
        k.setLetterSpacing(0.12f);
        k.setAlpha(0.9f);
        card.addView(k);
        final TextView why = left(text("", 15, false));
        final Button start = button("Tap one to start your day", true);
        start.setEnabled(false);
        start.setAlpha(0.6f);
        java.util.List<String[]> vals = new java.util.ArrayList<>();
        JSONArray arr = AlarmStore.values(this);
        for (int i = 0; i < arr.length() && i < 60; i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && !o.optString("id").isEmpty()) vals.add(new String[] {o.optString("id"), o.optString("label", o.optString("id")), o.optString("phrase", "")});
        }
        vals.add(new String[] {"me", "Me", ""});
        vals.add(new String[] {"other", "\uFF0B Something else", ""});
        final EditText otherField = new EditText(this);
        final View[] otherRow = new View[1];
        final Runnable refresh = () -> {
            String line = reasonLine();
            why.setText(line);
            why.setVisibility(line.isEmpty() ? View.GONE : View.VISIBLE);
            boolean ready = !chosen.isEmpty() || !other.trim().isEmpty();
            start.setEnabled(ready);
            start.setAlpha(ready ? 1f : 0.6f);
            start.setText(ready ? "Start my day" : "Tap one or more to start your day");
        };
        LinearLayout rowL = null;
        for (int i = 0; i < vals.size(); i++) {
            if (i % 2 == 0) {
                rowL = new LinearLayout(this);
                rowL.setOrientation(LinearLayout.HORIZONTAL);
                LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
                rp.topMargin = dp(10);
                card.addView(rowL, rp);
            }
            final String[] val = vals.get(i);
            phrases.put(val[0], val[2].isEmpty() ? val[1].toLowerCase(Locale.getDefault()) : val[2]);
            final Button chip = pill(val[1], false);
            if ("other".equals(val[0])) {
                chip.setOnClickListener(v -> {
                    chip.setVisibility(View.GONE);
                    otherRow[0].setVisibility(View.VISIBLE);
                    otherField.requestFocus();
                    android.view.inputmethod.InputMethodManager im = (android.view.inputmethod.InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (im != null) im.showSoftInput(otherField, 0);
                });
                GradientDrawable d = new GradientDrawable();
                d.setCornerRadius(dp(26));
                d.setStroke(dp(1), 0xCCFFFFFF);
                chip.setBackground(d);
                chip.setTextColor(Color.WHITE);
            } else {
                chip.setOnClickListener(v -> {
                    // Tap to pick, tap again to unpick; pick as many as you like.
                    boolean on = !chosen.contains(val[0]);
                    if (on) chosen.add(val[0]);
                    else chosen.remove(val[0]);
                    styleChip(chip, on);
                    refresh.run();
                });
                styleChip(chip, false);
            }
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(52), 1f);
            if (i % 2 == 1) lp.leftMargin = dp(10);
            rowL.addView(chip, lp);
        }
        if (vals.size() % 2 == 1) rowL.addView(new View(this), new LinearLayout.LayoutParams(0, dp(52), 1f));
        otherField.setHint("A word \u2014 e.g. Freedom");
        otherField.setSingleLine(true);
        otherField.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_DONE);
        otherField.setFilters(new android.text.InputFilter[] {new android.text.InputFilter.LengthFilter(40)});
        otherField.setTextColor(0xFF2D1B4E);
        otherField.setHintTextColor(0xFF7A6A95);
        otherField.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        otherField.setPadding(dp(16), 0, dp(16), 0);
        GradientDrawable ob = new GradientDrawable();
        ob.setCornerRadius(dp(16));
        ob.setColor(0xFFFFF6EE);
        otherField.setBackground(ob);
        otherField.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence c, int a, int b, int d) {}
            public void onTextChanged(CharSequence c, int a, int b, int d) {}
            public void afterTextChanged(android.text.Editable e) {
                other = e.toString();
                refresh.run();
            }
        });
        final LinearLayout addRow = new LinearLayout(this);
        addRow.setOrientation(LinearLayout.HORIZONTAL);
        addRow.setVisibility(View.GONE);
        addRow.addView(otherField, new LinearLayout.LayoutParams(0, dp(50), 1f));
        Button addBtn = button("Add", false);
        addBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        GradientDrawable ab = new GradientDrawable();
        ab.setCornerRadius(dp(16));
        ab.setColor(0xFF2D1B4E);
        addBtn.setBackground(ab);
        LinearLayout.LayoutParams abp = new LinearLayout.LayoutParams(dp(72), dp(50));
        abp.leftMargin = dp(8);
        addRow.addView(addBtn, abp);
        LinearLayout.LayoutParams op = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50));
        op.topMargin = dp(10);
        card.addView(addRow, op);
        otherRow[0] = addRow;
        final TextView note = left(text("Saved to your reasons, so it\u2019s here next time.", 12, false));
        note.setAlpha(0.85f);
        note.setVisibility(View.GONE);
        card.addView(note);
        // Add: the words become a picked chip and are saved for next time.
        final Adder adder = label -> {
            String t = label.trim().replaceAll("\\s+", " ");
            if (t.isEmpty()) return;
            if (t.length() > 40) t = t.substring(0, 40);
            String key = t;
            phrases.put(key, turn(t));
            if (!added.contains(key)) added.add(key);
            AlarmStore.addValue(this, key, turn(t));
            chosen.add(key);
            final String k2 = key;
            final Button chip = pill(t, false);
            styleChip(chip, true);
            chip.setOnClickListener(v -> {
                boolean on = !chosen.contains(k2);
                if (on) chosen.add(k2);
                else chosen.remove(k2);
                styleChip(chip, on);
                refresh.run();
            });
            LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52));
            cl.topMargin = dp(10);
            card.addView(chip, card.indexOfChild(addRow), cl);
            otherField.setText("");
            other = "";
            note.setVisibility(View.VISIBLE);
            refresh.run();
        };
        addBtn.setOnClickListener(v -> adder.add(otherField.getText().toString()));
        otherField.setOnEditorActionListener((v, actionId, ev) -> {
            adder.add(otherField.getText().toString());
            return true;
        });
        why.setVisibility(View.GONE);
        why.setPadding(0, dp(12), 0, 0);
        card.addView(why);
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.topMargin = dp(24);
        col.addView(card, cardLp);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(col, new ScrollView.LayoutParams(ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.MATCH_PARENT));
        root.addView(scroll, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        start.setOnClickListener(v -> unlockAndOpen(message));
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56));
        sp.topMargin = dp(12);
        root.addView(start, sp);
        Button later = button("Later", false);
        later.setBackground(null);
        later.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        later.setOnClickListener(v -> finish());
        root.addView(later, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(44)));
        setContentView(root);
    }

    /** "Start my day": now the phone asks for the PIN, then Habit Lab opens and records the morning. */
    private void unlockAndOpen(String message) {
        JSONObject w = new JSONObject();
        try {
            JSONArray picked = new JSONArray();
            for (String c : chosen) picked.put(c);
            w.put("values", picked);
            w.put("value", chosen.isEmpty() ? "" : chosen.iterator().next());
            w.put("other", other.trim());
            JSONArray add = new JSONArray();
            for (String a : added) add.put(a);
            if (!other.trim().isEmpty()) add.put(other.trim());
            w.put("added", add);
            w.put("fav", fav);
            w.put("message", message);
            w.put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()));
            w.put("at", new SimpleDateFormat("HH:mm", Locale.US).format(new Date()));
        } catch (org.json.JSONException ignored) {
        }
        final Intent open = new Intent(this, com.mrqvizt.habitlab.MainActivity.class)
            .putExtra("habit_route", "#/today")
            .putExtra("habit_wake", w.toString())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && km != null && km.isKeyguardLocked()) {
            km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                @Override
                public void onDismissSucceeded() {
                    startActivity(open);
                    finish();
                }
            });
        } else {
            startActivity(open);
            finish();
        }
    }

    /** "Keep up with my kids" → "keep up with your kids" (as valueInfo does in the app). */
    static String turn(String label) {
        String t = label.replaceAll("(?i)\\bmyself\\b", "yourself").replaceAll("(?i)\\bmine\\b", "yours").replaceAll("(?i)\\bmy\\b", "your").replaceAll("\\b(I|me)\\b", "you");
        boolean keep = t.length() > 1 && Character.isUpperCase(t.charAt(0)) && Character.isUpperCase(t.charAt(1));
        return keep || t.isEmpty() ? t : Character.toLowerCase(t.charAt(0)) + t.substring(1);
    }

    /** Same wording as the app (reasonLine in js/data/affirmations.js). */
    private String reasonLine() {
        boolean me = chosen.contains("me");
        java.util.List<String> parts = new java.util.ArrayList<>();
        for (String c : chosen) if (!"me".equals(c) && phrases.get(c) != null) parts.add(phrases.get(c));
        String own = other.trim().replaceAll("\\s+", " ");
        if (!own.isEmpty()) parts.add(turn(own));
        if (parts.isEmpty()) return me ? "Good. You are reason enough." : "";
        if (me) parts.add(0, "you");
        String list = parts.size() < 2 ? parts.get(0) : android.text.TextUtils.join(", ", parts.subList(0, parts.size() - 1)) + " and " + parts.get(parts.size() - 1);
        return "Your reasons today: " + list + ". Every good choice counts.";
    }

    private String greeting() {
        int h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
        return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    }

    private TextView left(TextView t) {
        t.setGravity(Gravity.START);
        return t;
    }

    private Button pill(String s, boolean primary) {
        Button b = button(s, primary);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setPadding(dp(18), 0, dp(18), 0);
        return b;
    }

    private void styleChip(Button b, boolean on) {
        GradientDrawable d = new GradientDrawable();
        d.setCornerRadius(dp(26));
        d.setColor(on ? 0xFF2D1B4E : 0xFFFFF6EE);
        b.setBackground(d);
        b.setTextColor(on ? Color.WHITE : 0xFF2D1B4E);
    }

    private int snoozeMin = 5;
    static final int[] SNOOZE_STEPS = {1, 2, 3, 5, 10, 15, 20, 30, 45, 60};

    /** Next snooze length up or down the steps (a value between steps snaps to the nearest one). */
    static int step(int current, int dir) {
        if (dir > 0) {
            for (int v : SNOOZE_STEPS) if (v > current) return v;
            return SNOOZE_STEPS[SNOOZE_STEPS.length - 1];
        }
        for (int i = SNOOZE_STEPS.length - 1; i >= 0; i--) if (SNOOZE_STEPS[i] < current) return SNOOZE_STEPS[i];
        return SNOOZE_STEPS[0];
    }

    private String snoozeText() {
        return "Snooze " + snoozeMin + " min";
    }

    private TextView text(String s, int sp, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
        return t;
    }

    private Button button(String s, boolean primary) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        b.setMinHeight(0);
        b.setMinimumHeight(0);
        b.setPadding(dp(12), 0, dp(12), 0);
        if (Build.VERSION.SDK_INT >= 21) b.setStateListAnimator(null);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable d = new GradientDrawable();
        d.setCornerRadius(dp(30));
        if (primary) {
            d.setColor(Color.WHITE);
            b.setTextColor(0xFF1C1C1E);
        } else {
            d.setColor(0x33FFFFFF);
            d.setStroke(dp(1), 0x88FFFFFF);
            b.setTextColor(Color.WHITE);
        }
        b.setBackground(d);
        return b;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        // An alarm should be dismissed or snoozed on purpose.
    }

    @Override
    protected void onDestroy() {
        if (dawn != null) dawn.cancel();
        try {
            unregisterReceiver(finisher);
        } catch (IllegalArgumentException ignored) {
        }
        super.onDestroy();
    }
}
