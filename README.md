# StarrySky

A themed Spotify remote for Android (built for a OnePlus 12). It uses Spotify's official Web API. The Spotify app still does the actual playback, so keep it installed. Controlling playback needs Spotify Premium.

- `web/`: the whole app (HTML/CSS/JS). Themes are in `themes.js`, Spotify login and requests in `spotify.js`, screens in `app.js`, and a fake Spotify for demo mode in `demo.js`.
- `android/`: a small Android wrapper that packages `web/` into an APK and handles the Spotify login redirect (`starrysky://callback`).

## Themes
- **StarryNight**: all 7 colour schemes (Base, Cotton Candy, Forest, Galaxy, Orange, Sky, Sunrise), with twinkling stars, shooting stars and a spinning round album cover. It's based on the StarryNight Spicetify theme by b-chen00 (spicetify-themes, MIT licence).
- **Aurora**: northern lights drifting over a starry sky.
- **Rain**: drops sliding down glass, with city lights behind.
- **Lava lamp**: warm glowing blobs.
- **Fireflies**: blinking fireflies over a dark meadow.
- **Snowfall**: three layers of drifting snow, a moon, and a snowbank.
- **Album glow**: the colours and a blurred copy of the current album cover, changing with every song.

Motion can be set to Full, Calm or Still. Album-cover spin can be turned off.

## Gestures and extras (1.1.0)
- **Swipe the cover**: left for the next song, right for the previous one.
- **Drag a song to the left** in any list (Library, Search, a playlist) to add it to the queue. The phone gives a small buzz when you've pulled far enough.
- **Sleep timer**: 5 to 90 minutes, or "end of this song". It pauses Spotify even if StarrySky is closed.
- **Home-screen widget**: long-press the home screen → Widgets → StarrySky. It shows the cover, title and artist, with previous, play/pause and next buttons. It uses your current theme's colour.

## Connecting your Spotify account
StarrySky talks to Spotify through a free developer key that belongs to you. You set it up once.
1. On the phone or PC, go to **developer.spotify.com/dashboard** and log in with your normal Spotify account. The first time, accept Spotify's developer terms and verify your email if it asks.
2. Tap **Create app** and fill it in:
   - **App name:** StarrySky (any name works)
   - **App description:** My themed Spotify remote (anything)
   - **Website:** leave it empty
   - **Redirect URIs:** type `starrysky://callback` exactly, then tap **Add**
   - **Which API/SDKs are you planning to use?** tick **Web API**
   - Tick the terms box and tap **Save**
3. Open the app's **Settings** and copy the **Client ID** (32 letters and numbers). You don't need the Client secret.
4. Open StarrySky on the phone, paste the Client ID, and tap **Connect Spotify**.
5. The browser opens Spotify's login. Log in, tap **Agree**, and the phone jumps back into StarrySky.
6. Open the Spotify app and start any song. StarrySky now shows and controls it.

If something goes wrong:
- **"INVALID_CLIENT: Invalid redirect URI"**: the redirect URI in the dashboard doesn't exactly match `starrysky://callback`.
- **"Needs Spotify Premium"**: Spotify only lets apps control playback for Premium accounts.
- **Nothing playing / no device**: open the Spotify app and play something for a second, then tap the device button at the top of StarrySky.
- **Another Spotify account**: developer apps start in *development mode*, so only you can use yours. To let someone else log in, add their Spotify email under the app's **User Management**.

## 1. Build the APK (on the PC)
1. Open **Android Studio**. If it asks to set up the Android SDK, accept its defaults and let it download. The SDK on this PC was missing as of 2026-11-26.
2. **File → Open** → choose `C:\Users\leole\StarrySky\android`. Let it sync: it downloads Gradle and the libraries, and asks you to accept the SDK licences.
3. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
4. The APK ends up at `android\app\build\outputs\apk\debug\app-debug.apk`.

## 2. Install on the phone
- Copy `app-debug.apk` to the phone (USB, Google Drive, or Phone Link), tap it, and allow "Install unknown apps" for the app you opened it from.
- Or, with USB debugging on: `adb install -r app-debug.apk`.

## 3. Connect Spotify (one time)
See **Connecting your Spotify account** above.

## Updating
Install a new APK over the old one. Your theme and login stay as they are. Updates must be signed with the same key: it lives in `%USERPROFILE%\.android\debug.keystore`, with a backup in `C:\Users\leole\StarrySky-keys\`. If that key is lost, the app has to be uninstalled before a new build will install.

## Testing on the PC
Serve `web/` on localhost, for example `python -m http.server 8737 --directory web`. Open `http://localhost:8737/index.html?demo` for demo mode. To log in for real from the PC, add `http://localhost:8737/index.html` as a second redirect URI.

## Limits (Spotify's, not the app's)
- Playback control needs Premium. Some phones don't allow volume changes from other apps.
- Apps can't reorder the queue, and there's no lyrics API.
- Spotify developer apps in "development mode" only work for the owner and a few allow-listed users.
