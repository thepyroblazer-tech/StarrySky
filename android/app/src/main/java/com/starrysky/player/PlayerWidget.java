package com.starrysky.player;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Shader;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Home-screen now-playing widget: cover, title, artist, previous / play-pause / next. */
public class PlayerWidget extends AppWidgetProvider {
    static final String ACTION_TOGGLE = "com.starrysky.player.TOGGLE";
    static final String ACTION_NEXT = "com.starrysky.player.NEXT";
    static final String ACTION_PREV = "com.starrysky.player.PREV";
    static final String ACTION_REFRESH = "com.starrysky.player.REFRESH";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx);
        refreshAsync(ctx, null);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        if (ACTION_TOGGLE.equals(a) || ACTION_NEXT.equals(a) || ACTION_PREV.equals(a) || ACTION_REFRESH.equals(a)) {
            if (ACTION_TOGGLE.equals(a)) { // flip the icon straight away
                SharedPreferences p = Spot.prefs(ctx);
                p.edit().putBoolean("w_playing", !p.getBoolean("w_playing", false)).apply();
                render(ctx);
            }
            refreshAsync(ctx, a, goAsync());
        }
    }

    static void refreshAsync(Context ctx, String action) { refreshAsync(ctx, action, null); }

    static void refreshAsync(Context ctx, String action, PendingResult pending) {
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try {
                SharedPreferences p = Spot.prefs(app);
                if (action != null && !ACTION_REFRESH.equals(action)) {
                    Spot.Result r;
                    if (ACTION_NEXT.equals(action)) r = Spot.api(app, "POST", "/me/player/next", null);
                    else if (ACTION_PREV.equals(action)) r = Spot.api(app, "POST", "/me/player/previous", null);
                    else r = Spot.api(app, "PUT", p.getBoolean("w_playing", false) ? "/me/player/play" : "/me/player/pause", null);
                    if (r.code == 404) p.edit().putString("w_artist", "Open Spotify on this phone first").apply();
                    else if (r.code == 403) p.edit().putString("w_artist", "Needs Spotify Premium").apply();
                    Thread.sleep(700);
                }
                fetchState(app);
            } catch (Exception e) {
                SharedPreferences p = Spot.prefs(app);
                if (Spot.tokenJson(app).isEmpty()) p.edit().putString("w_title", "StarrySky").putString("w_artist", "Open the app to connect Spotify").apply();
            } finally {
                render(app);
                if (pending != null) pending.finish();
            }
        }).start();
    }

    /** Reads what Spotify is playing and stores it for the widget. */
    static void fetchState(Context ctx) throws Exception {
        Spot.Result r = Spot.api(ctx, "GET", "/me/player?additional_types=episode", null);
        SharedPreferences.Editor e = Spot.prefs(ctx).edit();
        if (r.code == 204 || r.body.isEmpty()) {
            e.putBoolean("w_playing", false).putString("w_title", "Nothing playing").putString("w_artist", "Tap to open StarrySky").apply();
            return;
        }
        if (!r.ok()) return;
        JSONObject j = new JSONObject(r.body);
        JSONObject item = j.optJSONObject("item");
        e.putBoolean("w_playing", j.optBoolean("is_playing"));
        if (item != null) {
            e.putString("w_title", item.optString("name"));
            StringBuilder artists = new StringBuilder();
            JSONArray arr = item.optJSONArray("artists");
            if (arr != null) for (int i = 0; i < arr.length(); i++) { if (i > 0) artists.append(", "); artists.append(arr.getJSONObject(i).optString("name")); }
            else if (item.optJSONObject("show") != null) artists.append(item.getJSONObject("show").optString("name"));
            e.putString("w_artist", artists.toString());
            JSONObject album = item.optJSONObject("album");
            JSONArray imgs = album != null ? album.optJSONArray("images") : item.optJSONArray("images");
            if (imgs != null && imgs.length() > 0) e.putString("w_cover", imgs.getJSONObject(Math.min(1, imgs.length() - 1)).optString("url"));
        }
        e.apply();
        loadCover(ctx);
    }

    /** Called by the app whenever its now-playing screen changes. */
    static void pushFromApp(Context ctx, String json) {
        final Context app = ctx.getApplicationContext();
        try {
            JSONObject j = new JSONObject(json);
            Spot.prefs(app).edit()
                    .putString("w_title", j.optString("title").isEmpty() ? "Nothing playing" : j.optString("title"))
                    .putString("w_artist", j.optString("artist"))
                    .putBoolean("w_playing", j.optBoolean("playing"))
                    .putString("w_cover", j.optString("cover"))
                    .putString("w_accent", j.optString("accent", "#FFF3C4"))
                    .apply();
        } catch (Exception ignored) { return; }
        render(app);
        new Thread(() -> { loadCover(app); render(app); }).start();
    }

    /** Downloads the cover once per song and saves a round version for the widget. */
    static void loadCover(Context ctx) {
        SharedPreferences p = Spot.prefs(ctx);
        String url = p.getString("w_cover", "");
        if (url.isEmpty() || url.equals(p.getString("w_cover_done", "")) || !url.startsWith("https://")) return;
        try {
            HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
            con.setConnectTimeout(8000); con.setReadTimeout(8000);
            Bitmap src;
            try (InputStream in = con.getInputStream()) { src = BitmapFactory.decodeStream(in); }
            if (src == null) return;
            int size = 200;
            Bitmap scaled = Bitmap.createScaledBitmap(src, size, size, true);
            Bitmap round = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            new Canvas(round).drawCircle(size / 2f, size / 2f, size / 2f, paint);
            try (FileOutputStream out = new FileOutputStream(coverFile(ctx))) { round.compress(Bitmap.CompressFormat.PNG, 100, out); }
            p.edit().putString("w_cover_done", url).apply();
        } catch (Exception ignored) { }
    }

    static File coverFile(Context ctx) { return new File(ctx.getCacheDir(), "widget_cover.png"); }

    static void render(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, PlayerWidget.class));
        if (ids.length == 0) return;
        SharedPreferences p = Spot.prefs(ctx);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_player);
        v.setTextViewText(R.id.w_title, p.getString("w_title", "StarrySky"));
        v.setTextViewText(R.id.w_artist, p.getString("w_artist", "Tap to open"));
        boolean playing = p.getBoolean("w_playing", false);
        v.setImageViewResource(R.id.w_play_icon, playing ? R.drawable.ic_w_pause : R.drawable.ic_w_play);
        int accent;
        try { accent = Color.parseColor(p.getString("w_accent", "#FFF3C4")); } catch (Exception e) { accent = 0xFFFFF3C4; }
        v.setInt(R.id.w_play_bg, "setColorFilter", accent);
        v.setInt(R.id.w_play_icon, "setColorFilter", luminance(accent) > 0.5 ? Color.BLACK : Color.WHITE);
        File f = coverFile(ctx);
        Bitmap cover = f.exists() && !p.getString("w_cover_done", "").isEmpty() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
        if (cover != null) v.setImageViewBitmap(R.id.w_cover, cover); else v.setImageViewResource(R.id.w_cover, R.drawable.ic_w_disc);

        v.setOnClickPendingIntent(R.id.w_prev, broadcast(ctx, ACTION_PREV, 1));
        v.setOnClickPendingIntent(R.id.w_play, broadcast(ctx, ACTION_TOGGLE, 2));
        v.setOnClickPendingIntent(R.id.w_next, broadcast(ctx, ACTION_NEXT, 3));
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent openPi = PendingIntent.getActivity(ctx, 4, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.w_cover, openPi);
        v.setOnClickPendingIntent(R.id.w_text, openPi);
        mgr.updateAppWidget(ids, v);
    }

    static PendingIntent broadcast(Context ctx, String action, int code) {
        Intent i = new Intent(ctx, PlayerWidget.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static double luminance(int c) {
        return (0.2126 * Color.red(c) + 0.7152 * Color.green(c) + 0.0722 * Color.blue(c)) / 255.0;
    }
}
