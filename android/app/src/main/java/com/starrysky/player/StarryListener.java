package com.starrysky.player;

import android.content.Context;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;

import java.util.List;

/**
 * Turned on by the user under Notification access. Android only shares other apps' media sessions with
 * apps that have this, so StarrySky can follow what Spotify is playing. Notifications themselves are ignored.
 */
public class StarryListener extends NotificationListenerService {
    private MediaSessionManager msm;
    private MediaController current;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private final MediaSessionManager.OnActiveSessionsChangedListener sessions = this::attach;

    private final MediaController.Callback callback = new MediaController.Callback() {
        @Override public void onMetadataChanged(MediaMetadata metadata) { Player.changed(StarryListener.this); }
        @Override public void onPlaybackStateChanged(PlaybackState state) { Player.changed(StarryListener.this); }
        @Override public void onSessionDestroyed() { attach(msm.getActiveSessions(Player.listener(StarryListener.this))); }
    };

    @Override
    public void onListenerConnected() {
        msm = (MediaSessionManager) getSystemService(Context.MEDIA_SESSION_SERVICE);
        try {
            msm.addOnActiveSessionsChangedListener(sessions, Player.listener(this), handler);
            attach(msm.getActiveSessions(Player.listener(this)));
        } catch (SecurityException ignored) { }
    }

    @Override
    public void onListenerDisconnected() {
        if (msm != null) msm.removeOnActiveSessionsChangedListener(sessions);
        if (current != null) current.unregisterCallback(callback);
        current = null;
    }

    private void attach(List<MediaController> list) {
        MediaController next = Player.pick(list);
        boolean same = current != null && next != null && current.getSessionToken().equals(next.getSessionToken());
        if (!same) {
            if (current != null) current.unregisterCallback(callback);
            current = next;
            if (current != null) current.registerCallback(callback, handler);
        }
        Player.changed(this);
    }
}
