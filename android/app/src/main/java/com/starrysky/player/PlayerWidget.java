package com.starrysky.player;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Shader;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;

/** Home-screen now-playing widget: round cover, title, artist, previous / play-pause / next. */
public class PlayerWidget extends AppWidgetProvider {
    static final String ACTION_TOGGLE = "com.starrysky.player.TOGGLE";
    static final String ACTION_NEXT = "com.starrysky.player.NEXT";
    static final String ACTION_PREV = "com.starrysky.player.PREV";

    private static String roundId = "";
    private static Bitmap roundArt = null;

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        Player.ensureRegistered(ctx);
        render(ctx);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        String cmd = ACTION_TOGGLE.equals(a) ? "toggle" : ACTION_NEXT.equals(a) ? "next" : ACTION_PREV.equals(a) ? "prev" : null;
        if (cmd == null) return;
        final Context app = ctx.getApplicationContext();
        Player.ensureRegistered(app);
        if ("toggle".equals(cmd) && !Player.ready(app)) {
            Player.openSpotify(app); // nothing known yet: open Spotify so there is something to control
            return;
        }
        Player.control(app, cmd, null);
        final PendingResult done = goAsync();
        new Handler(Looper.getMainLooper()).postDelayed(() -> { render(app); done.finish(); }, 600);
    }

    static void render(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, PlayerWidget.class));
        if (ids.length == 0) return;
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_player);

        android.content.SharedPreferences p = Player.prefs(ctx);
        boolean playing = Player.playing(ctx);
        if (!Player.ready(ctx)) {
            v.setTextViewText(R.id.w_title, "StarrySky");
            v.setTextViewText(R.id.w_artist, "Tap play to open Spotify");
        } else {
            v.setTextViewText(R.id.w_title, p.getString("s_title", ""));
            v.setTextViewText(R.id.w_artist, p.getString("s_artist", ""));
        }

        Bitmap cover = round(p.getString("s_art_id", ""), Player.artBitmap(ctx));
        if (cover != null) v.setImageViewBitmap(R.id.w_cover, cover); else v.setImageViewResource(R.id.w_cover, R.drawable.ic_w_disc);

        v.setImageViewResource(R.id.w_play_icon, playing ? R.drawable.ic_w_pause : R.drawable.ic_w_play);
        int accent;
        try { accent = Color.parseColor(Player.prefs(ctx).getString("accent", "#FFF3C4")); } catch (Exception e) { accent = 0xFFFFF3C4; }
        v.setInt(R.id.w_play_bg, "setColorFilter", accent);
        v.setInt(R.id.w_play_icon, "setColorFilter", luminance(accent) > 0.5 ? Color.BLACK : Color.WHITE);

        v.setOnClickPendingIntent(R.id.w_prev, broadcast(ctx, ACTION_PREV, 1));
        v.setOnClickPendingIntent(R.id.w_play, broadcast(ctx, ACTION_TOGGLE, 2));
        v.setOnClickPendingIntent(R.id.w_next, broadcast(ctx, ACTION_NEXT, 3));
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent openPi = PendingIntent.getActivity(ctx, 4, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.w_cover, openPi);
        v.setOnClickPendingIntent(R.id.w_text, openPi);
        mgr.updateAppWidget(ids, v);
    }

    /** Round, 200px copy of the cover, made once per song. */
    private static synchronized Bitmap round(String id, Bitmap src) {
        if (src == null) return null;
        if (id.equals(roundId) && roundArt != null) return roundArt;
        int size = 200;
        Bitmap scaled = Bitmap.createScaledBitmap(src, size, size, true);
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        new Canvas(out).drawCircle(size / 2f, size / 2f, size / 2f, p);
        roundId = id; roundArt = out;
        return out;
    }

    static PendingIntent broadcast(Context ctx, String action, int code) {
        Intent i = new Intent(ctx, PlayerWidget.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static double luminance(int c) {
        return (0.2126 * Color.red(c) + 0.7152 * Color.green(c) + 0.0722 * Color.blue(c)) / 255.0;
    }
}
