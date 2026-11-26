package com.mrqvizt.habitlab.alarm;

import android.animation.ArgbEvaluator;
import android.animation.ValueAnimator;
import android.app.Activity;
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
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import java.text.DateFormat;
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
            finish();
        }
    };
    private ValueAnimator dawn;

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
            startService(new Intent(this, AlarmService.class).setAction(AlarmService.ACTION_DISMISS).putExtra("open", true));
            finish();
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
