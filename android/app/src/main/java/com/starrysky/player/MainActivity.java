package com.starrysky.player;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/** Thin shell around the web UI in assets/. Music info and controls come from Player (Android media sessions). */
public class MainActivity extends Activity {
    static final String HOME = "https://appassets.androidplatform.net/assets/index.html";

    private WebView web;
    private WebViewAssetLoader assets;
    private boolean pageReady = false;
    private int insetTop = 0, insetBottom = 0;
    private String sentArtId = "";
    private final Runnable onPlayerChanged = this::pushState;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Player.ensureRegistered(this);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);

        assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.addJavascriptInterface(new Bridge(), "StarryNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                openExternal(u.toString());
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                sentArtId = "";
                pushInsets();
            }
        });

        web.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                insetTop = bars.top;
                insetBottom = bars.bottom;
            } else {
                insetTop = insets.getSystemWindowInsetTop();
                insetBottom = insets.getSystemWindowInsetBottom();
            }
            pushInsets();
            return insets;
        });

        setContentView(web);
        web.loadUrl(HOME);
    }

    private void pushInsets() {
        if (!pageReady) return;
        float d = getResources().getDisplayMetrics().density;
        web.evaluateJavascript("window.onNativeInsets && window.onNativeInsets(" + Math.round(insetTop / d) + "," + Math.round(insetBottom / d) + ")", null);
    }

    /** Sends the latest song/playback state to the page; the cover is only sent when the song changes. */
    private void pushState() {
        if (!pageReady) return;
        String json = Player.stateJson(this, true);
        try {
            JSONObject j = new JSONObject(json);
            String id = j.optString("artId");
            if (id.equals(sentArtId)) j.remove("art"); else sentArtId = id;
            json = j.toString();
        } catch (Exception ignored) { }
        web.evaluateJavascript("window.onNativePlayer && window.onNativePlayer(" + JSONObject.quote(json) + ")", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        Player.watch(onPlayerChanged);
        if (pageReady) web.evaluateJavascript("window.onNativeResume && window.onNativeResume()", null);
    }

    @Override
    protected void onPause() {
        Player.unwatch(onPlayerChanged);
        web.onPause();
        super.onPause();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onNativeBack ? window.onNativeBack() : false", result -> {
            if (!"true".equals(result)) MainActivity.super.onBackPressed();
        });
    }

    void openExternal(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            if (url.equals("spotify:")) { Player.openSpotify(this); return; }
            Toast.makeText(this, url.startsWith("spotify:") ? "The Spotify app isn't installed." : "No app can open that link.", Toast.LENGTH_LONG).show();
        }
    }

    /** Methods callable from JavaScript as window.StarryNative.*. */
    class Bridge {
        /** True once Spotify has broadcast a song (its Device Broadcast Status setting is on). */
        @JavascriptInterface
        public boolean ready() { return Player.ready(MainActivity.this); }

        @JavascriptInterface
        public void openSpotify() { runOnUiThread(() -> Player.openSpotify(MainActivity.this)); }

        @JavascriptInterface
        public String playerState() {
            String json = Player.stateJson(MainActivity.this, true);
            try { sentArtId = new JSONObject(json).optString("artId"); } catch (Exception ignored) { }
            return json;
        }

        @JavascriptInterface
        public void control(String cmd, String arg) { Player.control(MainActivity.this, cmd, arg); }

        @JavascriptInterface
        public String volumeGet() { return Player.volumeJson(MainActivity.this); }

        @JavascriptInterface
        public void volumeSet(String pct) {
            try { Player.setVolume(MainActivity.this, Integer.parseInt(pct)); } catch (NumberFormatException ignored) { }
        }

        @JavascriptInterface
        public void setAccent(String hex) {
            if (hex == null || !hex.matches("#[0-9a-fA-F]{6}")) return;
            if (hex.equalsIgnoreCase(Player.prefs(MainActivity.this).getString("accent", ""))) return;
            Player.prefs(MainActivity.this).edit().putString("accent", hex).apply();
            runOnUiThread(() -> PlayerWidget.render(MainActivity.this));
        }

        @JavascriptInterface
        public void openExternal(String url) {
            if (url == null) return;
            if (!(url.startsWith("spotify:") || url.startsWith("https://open.spotify.com/"))) return;
            runOnUiThread(() -> MainActivity.this.openExternal(url));
        }

        @JavascriptInterface
        public void sleepSet(String atMillis) {
            try { SleepReceiver.schedule(MainActivity.this, Long.parseLong(atMillis)); } catch (NumberFormatException ignored) { }
        }

        @JavascriptInterface
        public String sleepGet() { return String.valueOf(SleepReceiver.endsAt(MainActivity.this)); }

        @JavascriptInterface
        public void sleepCancel() { SleepReceiver.cancel(MainActivity.this); }

        @JavascriptInterface
        public void haptic() {
            runOnUiThread(() -> web.performHapticFeedback(HapticFeedbackConstants.CONFIRM));
        }
    }
}
