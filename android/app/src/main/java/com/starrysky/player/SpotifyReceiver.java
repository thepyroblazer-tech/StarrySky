package com.starrysky.player;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Receives Spotify's "Device Broadcast Status" updates (song changes and play/pause). */
public class SpotifyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (Player.ACT_META.equals(a)) Player.onMetadata(ctx, intent);
        else if (Player.ACT_STATE.equals(a)) Player.onPlayback(ctx, intent);
    }
}
