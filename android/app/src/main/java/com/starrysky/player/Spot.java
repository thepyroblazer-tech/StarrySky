package com.starrysky.player;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** Minimal Spotify Web API client for the widget and sleep timer. Shares the login with the web UI. */
final class Spot {
    static final String PREFS = "starrysky";
    static final String KEY_TOKEN = "token";

    private Spot() {}

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized String tokenJson(Context c) { return prefs(c).getString(KEY_TOKEN, ""); }

    static synchronized void saveTokenJson(Context c, String json) {
        prefs(c).edit().putString(KEY_TOKEN, json == null ? "" : json).apply();
    }

    static final class Result {
        final int code; final String body;
        Result(int code, String body) { this.code = code; this.body = body; }
        boolean ok() { return code >= 200 && code < 300; }
    }

    /** Returns a valid access token, refreshing it if needed. Throws if not logged in. */
    static synchronized String accessToken(Context c, boolean forceRefresh) throws IOException {
        try {
            String raw = tokenJson(c);
            if (raw.isEmpty()) throw new IOException("Not logged in");
            JSONObject t = new JSONObject(raw);
            if (!forceRefresh && System.currentTimeMillis() < t.optLong("exp", 0)) return t.getString("access");
            String body = "grant_type=refresh_token&refresh_token=" + enc(t.getString("refresh")) + "&client_id=" + enc(t.optString("clientId"));
            Result r = http("POST", "https://accounts.spotify.com/api/token", null, body, "application/x-www-form-urlencoded");
            if (!r.ok()) {
                // The app may have refreshed at the same moment; use its token if it is fresh.
                JSONObject now = new JSONObject(tokenJson(c).isEmpty() ? "{}" : tokenJson(c));
                if (System.currentTimeMillis() < now.optLong("exp", 0)) return now.getString("access");
                throw new IOException("Token refresh failed (" + r.code + ")");
            }
            JSONObject j = new JSONObject(r.body);
            t.put("access", j.getString("access_token"));
            if (j.has("refresh_token")) t.put("refresh", j.getString("refresh_token"));
            t.put("exp", System.currentTimeMillis() + (j.optLong("expires_in", 3600) - 60) * 1000L);
            saveTokenJson(c, t.toString());
            return t.getString("access");
        } catch (org.json.JSONException e) {
            throw new IOException("Bad token data", e);
        }
    }

    /** Calls the Web API (path like "/me/player/pause"); retries once after refreshing on 401. */
    static Result api(Context c, String method, String path, String jsonBody) throws IOException {
        String url = "https://api.spotify.com/v1" + path;
        Result r = http(method, url, accessToken(c, false), jsonBody, "application/json");
        if (r.code == 401) r = http(method, url, accessToken(c, true), jsonBody, "application/json");
        return r;
    }

    static Result http(String method, String url, String bearer, String body, String type) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(8000);
        con.setReadTimeout(8000);
        con.setRequestMethod(method);
        if (bearer != null) con.setRequestProperty("Authorization", "Bearer " + bearer);
        if (body != null || method.equals("PUT") || method.equals("POST")) {
            byte[] bytes = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8);
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", type);
            con.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream os = con.getOutputStream()) { os.write(bytes); }
        }
        int code = con.getResponseCode();
        InputStream in = code >= 400 ? con.getErrorStream() : con.getInputStream();
        String text = "";
        if (in != null) {
            try (InputStream is = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[8192]; int n;
                while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
                text = out.toString("UTF-8");
            }
        }
        con.disconnect();
        return new Result(code, text);
    }

    static String enc(String s) {
        try { return URLEncoder.encode(s, "UTF-8"); } catch (Exception e) { return s; }
    }
}
