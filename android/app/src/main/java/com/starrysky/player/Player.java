package com.starrysky.player;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.view.KeyEvent;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * What's playing comes from Spotify's "Device Broadcast Status" broadcasts (no special permission needed).
 * Controls are sent as headset-style media keys, which go to the app that last played audio.
 */
final class Player {
    static final String SPOTIFY = "com.spotify.music";
    static final String ACT_META = "com.spotify.music.metadatachanged";
    static final String ACT_STATE = "com.spotify.music.playbackstatechanged";
    static final String ACT_QUEUE = "com.spotify.music.queuechanged";

    private static final CopyOnWriteArraySet<Runnable> watchers = new CopyOnWriteArraySet<>();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static boolean registered = false;
    private static String cachedArtId = "", cachedArtUrl = "";

    private Player() {}

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("starrysky", Context.MODE_PRIVATE);
    }

    /** Starts listening for Spotify's broadcasts while StarrySky's process is alive. */
    static synchronized void ensureRegistered(Context c) {
        if (registered) return;
        Context app = c.getApplicationContext();
        IntentFilter f = new IntentFilter();
        f.addAction(ACT_META);
        f.addAction(ACT_STATE);
        f.addAction(ACT_QUEUE);
        if (Build.VERSION.SDK_INT >= 33) app.registerReceiver(new SpotifyReceiver(), f, Context.RECEIVER_EXPORTED);
        else app.registerReceiver(new SpotifyReceiver(), f);
        registered = true;
    }

    /** True once Spotify has told us about a song (Device Broadcast Status is on). */
    static boolean ready(Context c) { return !prefs(c).getString("s_title", "").isEmpty(); }

    static boolean playing(Context c) { return prefs(c).getBoolean("s_playing", false); }

    static void onMetadata(Context c, Intent i) {
        String id = str(i, "id");
        SharedPreferences p = prefs(c);
        boolean newSong = !id.equals(p.getString("s_id", ""));
        p.edit()
                .putString("s_id", id)
                .putString("s_title", str(i, "track"))
                .putString("s_artist", str(i, "artist"))
                .putString("s_album", str(i, "album"))
                .putLong("s_length", num(i, "length"))
                .apply();
        if (newSong) {
            p.edit().putLong("s_pos", 0).putLong("s_pos_at", System.currentTimeMillis()).apply();
            fetchArt(c, id);
        }
        changed(c);
    }

    static void onPlayback(Context c, Intent i) {
        long sent = i.getLongExtra("timeSent", 0);
        long now = System.currentTimeMillis();
        prefs(c).edit()
                .putBoolean("s_playing", i.getBooleanExtra("playing", false))
                .putLong("s_pos", num(i, "playbackPosition"))
                .putLong("s_pos_at", sent > 0 && Math.abs(now - sent) < 60000 ? sent : now)
                .apply();
        changed(c);
    }

    private static String str(Intent i, String k) { String s = i.getStringExtra(k); return s == null ? "" : s; }

    private static long num(Intent i, String k) {
        Object o = i.getExtras() == null ? null : i.getExtras().get(k);
        return o instanceof Number ? ((Number) o).longValue() : 0;
    }

    /* ---------- cover art: Spotify's public oEmbed endpoint gives a thumbnail for a track id ---------- */

    static File artFile(Context c) { return new File(c.getFilesDir(), "cover.jpg"); }

    static void fetchArt(Context c, String id) {
        final Context app = c.getApplicationContext();
        if (id.isEmpty()) return;
        new Thread(() -> {
            try {
                String trackUrl = id.startsWith("spotify:track:") ? "https://open.spotify.com/track/" + id.substring(14) : id;
                URL u = new URL("https://open.spotify.com/oembed?url=" + URLEncoder.encode(trackUrl, "UTF-8"));
                String thumb = new JSONObject(read(u)).optString("thumbnail_url");
                if (thumb.isEmpty() || !id.equals(prefs(app).getString("s_id", ""))) return;
                Bitmap b;
                HttpURLConnection con = (HttpURLConnection) new URL(thumb).openConnection();
                con.setConnectTimeout(8000); con.setReadTimeout(8000);
                try (InputStream in = con.getInputStream()) { b = BitmapFactory.decodeStream(in); }
                if (b == null) return;
                b = scale(b, 640);
                try (FileOutputStream out = new FileOutputStream(artFile(app))) { b.compress(Bitmap.CompressFormat.JPEG, 88, out); }
                prefs(app).edit().putString("s_art_id", id).apply();
                changed(app);
            } catch (Exception ignored) { }
        }).start();
    }

    private static String read(URL u) throws Exception {
        HttpURLConnection con = (HttpURLConnection) u.openConnection();
        con.setConnectTimeout(8000); con.setReadTimeout(8000);
        try (InputStream in = con.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    static Bitmap scale(Bitmap b, int max) {
        int w = b.getWidth(), h = b.getHeight();
        if (w <= max && h <= max) return b;
        float k = Math.min(max / (float) w, max / (float) h);
        return Bitmap.createScaledBitmap(b, Math.round(w * k), Math.round(h * k), true);
    }

    /** The current song's cover, or null if it hasn't been fetched (yet). */
    static Bitmap artBitmap(Context c) {
        SharedPreferences p = prefs(c);
        String id = p.getString("s_id", "");
        if (id.isEmpty() || !id.equals(p.getString("s_art_id", ""))) return null;
        File f = artFile(c);
        return f.exists() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
    }

    /** Current state as JSON for the web UI. Includes the cover as a data URL when withArt is true. */
    static synchronized String stateJson(Context c, boolean withArt) {
        JSONObject j = new JSONObject();
        try {
            SharedPreferences p = prefs(c);
            if (!ready(c)) { j.put("has", false); return j.toString(); }
            String id = p.getString("s_id", "");
            j.put("has", true);
            j.put("app", "Spotify");
            j.put("title", p.getString("s_title", ""));
            j.put("artist", p.getString("s_artist", ""));
            j.put("album", p.getString("s_album", ""));
            j.put("duration", p.getLong("s_length", 0));
            j.put("playing", p.getBoolean("s_playing", false));
            j.put("position", p.getLong("s_pos", 0));
            j.put("positionAt", p.getLong("s_pos_at", System.currentTimeMillis()));
            j.put("speed", 1);
            j.put("canSeek", false);
            String artKey = id.equals(p.getString("s_art_id", "")) ? id : "";
            j.put("artId", artKey);
            if (withArt) {
                if (!artKey.equals(cachedArtId)) {
                    cachedArtId = artKey;
                    Bitmap b = artKey.isEmpty() ? null : artBitmap(c);
                    cachedArtUrl = b == null ? "" : dataUrl(b);
                }
                j.put("art", cachedArtUrl);
            }
        } catch (Exception e) {
            try { j.put("has", false); } catch (Exception ignored) { }
        }
        return j.toString();
    }

    static String dataUrl(Bitmap b) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, 88, out);
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    /** Commands: play, pause, toggle, next, prev. */
    static void control(Context c, String cmd, String arg) {
        ensureRegistered(c);
        int code;
        switch (cmd) {
            case "play": code = KeyEvent.KEYCODE_MEDIA_PLAY; break;
            case "pause": code = KeyEvent.KEYCODE_MEDIA_PAUSE; break;
            case "toggle": code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE; break;
            case "next": code = KeyEvent.KEYCODE_MEDIA_NEXT; break;
            case "prev": code = KeyEvent.KEYCODE_MEDIA_PREVIOUS; break;
            default: return;
        }
        long t = SystemClock.uptimeMillis();
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        am.dispatchMediaKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_DOWN, code, 0));
        am.dispatchMediaKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_UP, code, 0));
        // Spotify will broadcast the real state; show the expected one right away.
        if (code == KeyEvent.KEYCODE_MEDIA_PLAY || code == KeyEvent.KEYCODE_MEDIA_PAUSE || code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE) {
            SharedPreferences p = prefs(c);
            boolean was = p.getBoolean("s_playing", false);
            boolean now = code == KeyEvent.KEYCODE_MEDIA_PLAY || (code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE && !was);
            if (was && !now) { // freeze the position where we paused
                long pos = p.getLong("s_pos", 0) + (System.currentTimeMillis() - p.getLong("s_pos_at", System.currentTimeMillis()));
                p.edit().putLong("s_pos", pos).putLong("s_pos_at", System.currentTimeMillis()).apply();
            } else if (!was && now) {
                p.edit().putLong("s_pos_at", System.currentTimeMillis()).apply();
            }
            p.edit().putBoolean("s_playing", now).apply();
            changed(c);
        }
    }

    static void openSpotify(Context c) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(SPOTIFY);
        if (i == null) return;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        c.startActivity(i);
    }

    static String volumeJson(Context c) {
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        return "{\"cur\":" + am.getStreamVolume(AudioManager.STREAM_MUSIC) + ",\"max\":" + am.getStreamMaxVolume(AudioManager.STREAM_MUSIC) + "}";
    }

    static void setVolume(Context c, int pct) {
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        try { am.setStreamVolume(AudioManager.STREAM_MUSIC, Math.round(Math.max(0, Math.min(100, pct)) * max / 100f), 0); } catch (SecurityException ignored) { }
    }

    /* Something changed (song, play state, cover): refresh the widget and any open screen. */
    static void watch(Runnable r) { watchers.add(r); }
    static void unwatch(Runnable r) { watchers.remove(r); }

    static void changed(Context c) {
        final Context app = c.getApplicationContext();
        main.removeCallbacksAndMessages(null);
        main.postDelayed(() -> {
            PlayerWidget.render(app);
            for (Runnable r : watchers) r.run();
        }, 120); // groups the burst of broadcasts a song change sends
    }
}
