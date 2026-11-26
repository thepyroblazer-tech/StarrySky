# StarrySky

A themed Spotify remote for Android (built for a OnePlus 12). It uses Spotify's official Web API. The Spotify app still does the actual playback, so keep it installed. Controlling playback needs Spotify Premium.

- `web/`: the whole app (HTML/CSS/JS). Themes are in `themes.js`, Spotify login and requests in `spotify.js`, screens in `app.js`, and a fake Spotify for demo mode in `demo.js`.
- `android/`: a small Android wrapper that packages `web/` into an APK and handles the Spotify login redirect (`starrysky://callback`).

## Themes
- **StarryNight**: all 7 colour schemes (Base, Cotton Candy, Forest, Galaxy, Orange, Sky, Sunrise), with twinkling stars, shooting stars and a spinning round album cover. It's based on the StarryNight Spicetify theme by b-chen00 (spicetify-themes, MIT licence).
- **Aurora**: northern lights drifting over a starry sky.
- **Rain**: drops sliding down glass, with city lights behind.
- **Lava lamp**: warm glowing blobs.

Motion can be set to Full, Calm or Still. Album-cover spin can be turned off.

## 1. Build the APK (on the PC)
1. Open **Android Studio**. If it asks to set up the Android SDK, accept its defaults and let it download. The SDK on this PC was missing as of 2026-11-26.
2. **File → Open** → choose `C:\Users\leole\StarrySky\android`. Let it sync: it downloads Gradle and the libraries, and asks you to accept the SDK licences.
3. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
4. The APK ends up at `android\app\build\outputs\apk\debug\app-debug.apk`.

## 2. Install on the phone
- Copy `app-debug.apk` to the phone (USB, Google Drive, or Phone Link), tap it, and allow "Install unknown apps" for the app you opened it from.
- Or, with USB debugging on: `adb install -r app-debug.apk`.

## 3. Connect Spotify (one time)
1. On developer.spotify.com/dashboard, create an app.
2. Redirect URI: `starrysky://callback`. Tick **Web API**.
3. Open StarrySky, paste the app's **Client ID**, and tap **Connect Spotify**. Log in in the browser, and it jumps back to the app.

## Testing on the PC
Serve `web/` on localhost, for example `python -m http.server 8737 --directory web`. Open `http://localhost:8737/index.html?demo` for demo mode. To log in for real from the PC, add `http://localhost:8737/index.html` as a second redirect URI.

## Limits (Spotify's, not the app's)
- Playback control needs Premium. Some phones don't allow volume changes from other apps.
- Apps can't reorder the queue, and there's no lyrics API.
- Spotify developer apps in "development mode" only work for the owner and a few allow-listed users.
