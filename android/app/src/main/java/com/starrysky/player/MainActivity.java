package com.starrysky.player;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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

/** Thin shell around the web UI in assets/. Login happens in the browser and comes back via starrysky://callback. */
public class MainActivity extends Activity {
    static final String REDIRECT = "starrysky://callback";
    static final String HOME = "https://appassets.androidplatform.net/assets/index.html";

    private WebView web;
    private WebViewAssetLoader assets;
    private volatile String pendingAuth = "";
    private boolean pageReady = false;
    private int insetTop = 0, insetBottom = 0;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
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
        s.setMediaPlaybackRequiresUserGesture(true);
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
        handleIntent(getIntent());
        web.loadUrl(HOME);
    }

    private void pushInsets() {
        if (!pageReady) return;
        float d = getResources().getDisplayMetrics().density;
        web.evaluateJavascript("window.onNativeInsets && window.onNativeInsets(" + Math.round(insetTop / d) + "," + Math.round(insetBottom / d) + ")", null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !data.toString().startsWith(REDIRECT)) return;
        String url = data.toString();
        if (pageReady) {
            web.evaluateJavascript("window.onNativeAuth && window.onNativeAuth(" + JSONObject.quote(url) + ")", null);
        } else {
            pendingAuth = url;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (pageReady) web.evaluateJavascript("window.onNativeResume && window.onNativeResume()", null);
    }

    @Override
    protected void onPause() {
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
            Toast.makeText(this, url.startsWith("spotify:") ? "The Spotify app isn't installed." : "No app can open that link.", Toast.LENGTH_LONG).show();
        }
    }

    /** Methods callable from JavaScript as window.StarryNative.*. */
    class Bridge {
        @JavascriptInterface
        public String redirectUri() { return REDIRECT; }

        @JavascriptInterface
        public void openExternal(String url) {
            if (url == null) return;
            if (!(url.startsWith("https://accounts.spotify.com/") || url.startsWith("spotify:") || url.startsWith("https://open.spotify.com/"))) return;
            runOnUiThread(() -> MainActivity.this.openExternal(url));
        }

        @JavascriptInterface
        public String takePendingAuth() {
            String p = pendingAuth;
            pendingAuth = "";
            return p;
        }

        @JavascriptInterface
        public void setBarColor(String color) { /* bars are transparent; the theme shows through */ }

        /* Login storage shared with the widget and sleep timer. */
        @JavascriptInterface
        public String tokenGet() { return Spot.tokenJson(MainActivity.this); }

        @JavascriptInterface
        public void tokenSet(String json) {
            Spot.saveTokenJson(MainActivity.this, json);
            if (json == null || json.isEmpty()) {
                Spot.prefs(MainActivity.this).edit().putString("w_title", "StarrySky").putString("w_artist", "Open the app to connect Spotify").remove("w_cover_done").apply();
                PlayerWidget.render(MainActivity.this);
            }
        }

        @JavascriptInterface
        public void widgetUpdate(String json) { PlayerWidget.pushFromApp(MainActivity.this, json); }

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
            runOnUiThread(() -> web.performHapticFeedback(android.view.HapticFeedbackConstants.CONFIRM));
        }
    }
}
