package com.mrqvizt.habitlab.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Runs FriendsWatch.check off the main thread when its repeating alarm goes off. Not exported. */
public class FriendsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || !FriendsWatch.ACTION_CHECK.equals(intent.getAction())) return;
        final PendingResult result = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try {
                FriendsWatch.check(app);
            } finally {
                result.finish();
            }
        }).start();
    }
}
