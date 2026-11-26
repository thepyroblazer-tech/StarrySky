package com.starrysky.player;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import android.view.KeyEvent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.concurrent.CopyOnWriteArraySet;

/** Reads and controls whatever music app is playing (Spotify first), through Android's media sessions. */
final class Player {
    static final String SPOTIFY = "com.spotify.music";
    private static final CopyOnWriteArraySet<Runnable> watchers = new CopyOnWriteArraySet<>();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static String cachedArtId = "", cachedArtUrl = "";

    private Player() {}

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("starrysky", Context.MODE_PRIVATE);
    }

    static ComponentName listener(Context c) { return new ComponentName(c, StarryListener.class); }

    /** True when the user has switched StarrySky on under Notification access. */
    static boolean hasAccess(Context c) {
        String flat = Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        return flat != null && flat.contains(listener(c).flattenToString());
    }

    static MediaController find(Context c) {
        if (!hasAccess(c)) return null;
        try {
            MediaSessionManager msm = (MediaSessionManager) c.getSystemService(Context.MEDIA_SESSION_SERVICE);
            return pick(msm.getActiveSessions(listener(c)));
        } catch (SecurityException e) {
            return null;
        }
    }

    /** Prefers Spotify, then anything that is playing, then the most recent session. */
    static MediaController pick(List<MediaController> list) {
        if (list == null || list.isEmpty()) return null;
        for (MediaController m : list) if (SPOTIFY.equals(m.getPackageName())) return m;
        for (MediaController m : list) {
            PlaybackState s = m.getPlaybackState();
            if (s != null && s.getState() == PlaybackState.STATE_PLAYING) return m;
        }
        return list.get(0);
    }

    static boolean isPlaying(MediaController m) {
        PlaybackState s = m == null ? null : m.getPlaybackState();
        return s != null && (s.getState() == PlaybackState.STATE_PLAYING || s.getState() == PlaybackState.STATE_BUFFERING);
    }

    static Bitmap art(MediaMetadata md) {
        if (md == null) return null;
        Bitmap b = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (b == null) b = md.getBitmap(MediaMetadata.METADATA_KEY_ART);
        if (b == null) b = md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
        return b;
    }

    static String text(MediaMetadata md, String key) {
        CharSequence s = md == null ? null : md.getText(key);
        return s == null ? "" : s.toString();
    }

    static String artId(MediaMetadata md) {
        return Integer.toHexString((text(md, MediaMetadata.METADATA_KEY_TITLE) + "|" + text(md, MediaMetadata.METADATA_KEY_ARTIST) + "|" + text(md, MediaMetadata.METADATA_KEY_ALBUM)).hashCode());
    }

    static String appName(Context c, String pkg) {
        if (SPOTIFY.equals(pkg)) return "Spotify";
        try {
            PackageManager pm = c.getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
        } catch (Exception e) {
            return "Music";
        }
    }

    /** Current state as JSON for the web UI. Includes the cover as a data URL when withArt is true. */
    static synchronized String stateJson(Context c, boolean withArt) {
        JSONObject j = new JSONObject();
        try {
            MediaController m = find(c);
            MediaMetadata md = m == null ? null : m.getMetadata();
            if (m == null || md == null) { j.put("has", false); return j.toString(); }
            PlaybackState ps = m.getPlaybackState();
            j.put("has", true);
            j.put("app", appName(c, m.getPackageName()));
            j.put("title", text(md, MediaMetadata.METADATA_KEY_TITLE));
            String artist = text(md, MediaMetadata.METADATA_KEY_ARTIST);
            if (artist.isEmpty()) artist = text(md, MediaMetadata.METADATA_KEY_ALBUM_ARTIST);
            j.put("artist", artist);
            j.put("album", text(md, MediaMetadata.METADATA_KEY_ALBUM));
            j.put("duration", Math.max(0, md.getLong(MediaMetadata.METADATA_KEY_DURATION)));
            j.put("playing", isPlaying(m));
            if (ps != null) {
                long pos = ps.getPosition();
                long age = SystemClock.elapsedRealtime() - ps.getLastPositionUpdateTime();
                j.put("position", Math.max(0, pos));
                j.put("positionAt", System.currentTimeMillis() - Math.max(0, age));
                j.put("speed", ps.getPlaybackSpeed() == 0 ? 1 : ps.getPlaybackSpeed());
                JSONArray acts = new JSONArray();
                for (PlaybackState.CustomAction a : ps.getCustomActions()) {
                    acts.put(new JSONObject().put("id", a.getAction()).put("name", String.valueOf(a.getName())));
                }
                j.put("actions", acts);
            }
            String id = artId(md);
            j.put("artId", id);
            if (withArt) {
                if (!id.equals(cachedArtId)) {
                    cachedArtId = id;
                    cachedArtUrl = dataUrl(art(md));
                }
                j.put("art", cachedArtUrl);
            }
        } catch (Exception e) {
            try { j.put("has", false); } catch (Exception ignored) { }
        }
        return j.toString();
    }

    static String dataUrl(Bitmap b) {
        if (b == null) return "";
        int max = 640, w = b.getWidth(), h = b.getHeight();
        if (w > max || h > max) {
            float k = Math.min(max / (float) w, max / (float) h);
            b = Bitmap.createScaledBitmap(b, Math.round(w * k), Math.round(h * k), true);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, 88, out);
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    /** Commands: play, pause, toggle, next, prev, seek (ms), custom (action id). */
    static void control(Context c, String cmd, String arg) {
        MediaController m = find(c);
        if (m == null) { mediaKey(c, cmd); return; }
        MediaController.TransportControls t = m.getTransportControls();
        switch (cmd) {
            case "play": t.play(); break;
            case "pause": t.pause(); break;
            case "toggle": if (isPlaying(m)) t.pause(); else t.play(); break;
            case "next": t.skipToNext(); break;
            case "prev": t.skipToPrevious(); break;
            case "seek": try { t.seekTo(Long.parseLong(arg)); } catch (NumberFormatException ignored) { } break;
            case "custom": if (arg != null && !arg.isEmpty()) t.sendCustomAction(arg, null); break;
            default: break;
        }
    }

    /** Fallback when no session is visible: send a headset-style media key to whatever player is active. */
    static void mediaKey(Context c, String cmd) {
        int code;
        switch (cmd) {
            case "play": code = KeyEvent.KEYCODE_MEDIA_PLAY; break;
            case "pause": code = KeyEvent.KEYCODE_MEDIA_PAUSE; break;
            case "toggle": code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE; break;
            case "next": code = KeyEvent.KEYCODE_MEDIA_NEXT; break;
            case "prev": code = KeyEvent.KEYCODE_MEDIA_PREVIOUS; break;
            default: return;
        }
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));
        am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, code));
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

    /* Something changed (song, play state, session): refresh the widget and any open screen. */
    static void watch(Runnable r) { watchers.add(r); }
    static void unwatch(Runnable r) { watchers.remove(r); }

    static void changed(Context c) {
        final Context app = c.getApplicationContext();
        main.removeCallbacksAndMessages(null);
        main.postDelayed(() -> {
            PlayerWidget.render(app);
            for (Runnable r : watchers) r.run();
        }, 120); // small delay groups the burst of updates a song change sends
    }
}
