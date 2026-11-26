package com.starrysky.player;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Sleep timer: an alarm that pauses Spotify, so it works even when StarrySky is closed. */
public class SleepReceiver extends BroadcastReceiver {
    static final String KEY_AT = "sleep_at";

    static void schedule(Context ctx, long at) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = pending(ctx);
        am.cancel(pi);
        if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        Spot.prefs(ctx).edit().putLong(KEY_AT, at).apply();
    }

    static void cancel(Context ctx) {
        ((AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE)).cancel(pending(ctx));
        Spot.prefs(ctx).edit().remove(KEY_AT).apply();
    }

    static long endsAt(Context ctx) {
        long at = Spot.prefs(ctx).getLong(KEY_AT, 0);
        return at > System.currentTimeMillis() ? at : 0;
    }

    private static PendingIntent pending(Context ctx) {
        Intent i = new Intent(ctx, SleepReceiver.class);
        return PendingIntent.getBroadcast(ctx, 10, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        final Context app = ctx.getApplicationContext();
        Spot.prefs(app).edit().remove(KEY_AT).apply();
        final PendingResult done = goAsync();
        new Thread(() -> {
            try {
                Spot.api(app, "PUT", "/me/player/pause", null);
                Spot.prefs(app).edit().putBoolean("w_playing", false).apply();
            } catch (Exception ignored) {
            } finally {
                PlayerWidget.render(app);
                done.finish();
            }
        }).start();
    }
}
