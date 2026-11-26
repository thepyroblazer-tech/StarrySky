# StarrySky

An animated, themed remote for Spotify on Android, built for a OnePlus 12. It works with **free Spotify**: no login, no developer key and no special permissions.

- **Seeing what's playing:** Spotify's own *Device Broadcast Status* setting tells StarrySky the song, artist and play state. The cover comes from Spotify's public link preview.
- **Controlling it:** StarrySky sends the same play/pause/next/previous signals as headphone buttons.

- `web/`: the app's screens (HTML/CSS/JS). Themes are in `themes.js`, the screens in `app.js`, and a fake player for demo mode in `demo.js`.
- `android/`: the Android app. It packages `web/`; `Player.java` and `SpotifyReceiver.java` follow Spotify. It also has the home-screen widget (`PlayerWidget.java`) and the sleep timer (`SleepReceiver.java`).

## What it does
- **Now playing:** a big round album cover that spins while music plays, title and artist, a progress bar, previous, play/pause, next, and phone volume.
- **Swipe the cover:** left for the next song, right for the previous one.
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
2. In **Spotify**: tap your profile picture → **Settings and privacy** → switch on **Device Broadcast Status**. It's usually under *Playback* or *Apps and devices*.
3. Play any song. It shows up in StarrySky and the widget straight away.

## What it can't do (with free Spotify)
Spotify only gives its developer key, the Web API, to Premium accounts. Without it:
- Search, Library and Liked Songs open in the Spotify app.
- Songs can't be added to the queue, liked or seeked from StarrySky. Seek and like in Spotify itself.
- StarrySky only hears Spotify's updates while it's running. If it was closed, it catches up at the next song change or play/pause.

## Building
1. Open `android/` in Android Studio, or run `android\gradlew.bat assembleDebug` with `JAVA_HOME` set to Android Studio's `jbr` folder.
2. The APK is written to `android\app\build\outputs\apk\debug\app-debug.apk`.

Updates must be signed with the same key as the installed app: `%USERPROFILE%\.android\debug.keystore`, with a backup outside the repo. Never commit it.

## Testing on a PC
Serve `web/`, for example with `python -m http.server 8737 --directory web`. Open `http://127.0.0.1:8737/index.html` and tap **Try the demo**.
