# StarrySky

An animated, themed remote for Spotify on Android, built for a OnePlus 12. It controls Spotify the same way your lock screen and earbuds do, through Android's media controls. It works with **free Spotify**, with no login and no developer key.

- `web/`: the app's screens (HTML/CSS/JS). Themes are in `themes.js`, the screens in `app.js`, and a fake player for demo mode in `demo.js`.
- `android/`: the Android app. It packages `web/` and reads/controls the playing music through media sessions (`Player.java`, `StarryListener.java`). It also has the home-screen widget (`PlayerWidget.java`) and the sleep timer (`SleepReceiver.java`).

## What it does
- **Now playing:** a big round album cover that spins while music plays, title and artist, seek bar, previous, play/pause, next, and phone volume.
- **Swipe the cover:** left for the next song, right for the previous one.
- **Like and more:** the ♥ button and the ⋯ menu show the extra buttons Spotify offers on your lock screen (like, shuffle, radio and so on).
- **Sleep timer:** 5 minutes to 1.5 hours, or end of this song. It pauses the music even when StarrySky is closed.
- **Home-screen widget:** round cover, title, artist, and previous / play-pause / next, coloured to match your theme. Long-press the home screen → Widgets → StarrySky.
- **Search:** hands off to the Spotify app's search, along with quick buttons for Liked Songs and Your Library.

## Themes
- **StarryNight**: all 7 colour schemes (Base, Cotton Candy, Forest, Galaxy, Orange, Sky, Sunrise), with twinkling stars and shooting stars. It's based on the StarryNight Spicetify theme by b-chen00 (spicetify-themes, MIT licence).
- **Aurora**: northern lights over a starry sky.
- **Rain**: drops sliding down glass, with city lights behind.
- **Lava lamp**: warm glowing blobs.
- **Fireflies**: blinking fireflies over a dark meadow.
- **Snowfall**: drifting snow, a moon, and a snowbank.
- **Album glow**: the colours and a blurred copy of the current album cover, changing with every song.

Motion can be set to Full, Calm or Still. Album-cover spin can be turned off.

## Setting it up on the phone
1. Install `StarrySky.apk` from the latest release.
2. Open StarrySky and tap **Open notification access**. Find **StarrySky** and switch it on. This is how Android lets an app see and control what's playing. StarrySky ignores your actual notifications.
3. If Android shows **"Restricted setting"**: go back, tap **Open app info**, then the **⋮** menu at the top right → **Allow restricted settings**, and try step 2 again. Android does this for every app installed outside the Play Store.
4. Go back to StarrySky and play something in Spotify. It shows up straight away.

## What it can't do (without Spotify Premium)
Spotify only gives its developer key, the Web API, to Premium accounts. Without it, Android's media controls don't include your library, playlists, search results or the queue. So:
- Search, Library and Liked Songs open in the Spotify app.
- Songs can't be added to the queue from StarrySky.
- Shuffle and repeat only appear if Spotify offers them as lock-screen buttons, in the ⋯ menu.

## Building
1. Open `android/` in Android Studio, or run `android\gradlew.bat assembleDebug` with `JAVA_HOME` set to Android Studio's `jbr` folder.
2. The APK is written to `android\app\build\outputs\apk\debug\app-debug.apk`.

Updates must be signed with the same key as the installed app: `%USERPROFILE%\.android\debug.keystore`, with a backup outside the repo. Never commit it.

## Testing on a PC
Serve `web/`, for example with `python -m http.server 8737 --directory web`. Open `http://127.0.0.1:8737/index.html` and tap **Try the demo**.
