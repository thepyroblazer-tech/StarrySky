/* Demo mode: a fake music player so the app and its themes can be tried on a PC. */
(function () {
  'use strict';

  function cover(seed, label) {
    const hues = [[260, 320], [200, 250], [10, 40], [150, 190], [330, 20], [40, 60], [180, 280]];
    const [h1, h2] = hues[seed % hues.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},70%,55%)"/><stop offset="1" stop-color="hsl(${h2},70%,25%)"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="${80 + seed * 23 % 140}" cy="${90 + seed * 37 % 120}" r="${50 + seed * 11 % 60}" fill="rgba(255,255,255,.14)"/><text x="24" y="270" font-family="Arial" font-weight="700" font-size="34" fill="rgba(255,255,255,.9)">${label}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const ARTISTS = ['Nova Vale', 'The Paper Moons', 'Kiro', 'Lumen Drift', 'Ash & Ivory', 'Moth Hour', 'Selene Park'];
  const TITLES = ['Shooting Star', 'Midnight Static', 'Paper Planets', 'Glass Rain', 'Low Tide', 'Neon Orchard', 'Afterglow', 'Silver Line'];
  const tracks = TITLES.map((title, i) => ({
    title, artist: ARTISTS[i % ARTISTS.length], album: title + ' (Single)',
    duration: 150000 + (i * 17321) % 110000, art: cover(i, title.split(' ')[0]), artId: 'demo' + i,
  }));

  const st = { idx: 0, playing: true, pos: 42000, at: Date.now(), vol: 60, liked: false, shuffle: false };
  const pos = () => Math.min(tracks[st.idx].duration, st.pos + (st.playing ? Date.now() - st.at : 0));
  const setPos = p => { st.pos = p; st.at = Date.now(); };
  const go = d => { st.idx = (st.idx + d + tracks.length) % tracks.length; setPos(0); st.liked = false; changed(); };
  let listener = null;
  const changed = () => { if (listener) setTimeout(() => listener(state()), 60); };
  setInterval(() => { if (st.playing && pos() >= tracks[st.idx].duration) go(1); }, 1000);

  function state() {
    const t = tracks[st.idx];
    return {
      has: true, app: 'Spotify (demo)', title: t.title, artist: t.artist, album: t.album,
      duration: t.duration, position: pos(), positionAt: Date.now(), speed: 1, playing: st.playing,
      art: t.art, artId: t.artId,
      actions: [
        { id: 'like', name: st.liked ? 'Remove from Liked Songs' : 'Add to Liked Songs' },
        { id: 'shuffle', name: st.shuffle ? 'Turn shuffle off' : 'Turn shuffle on' },
        { id: 'radio', name: 'Go to song radio' },
      ],
    };
  }

  function control(cmd, arg) {
    if (cmd === 'play') { st.playing = true; st.at = Date.now(); }
    else if (cmd === 'pause') { st.pos = pos(); st.playing = false; }
    else if (cmd === 'next') go(1);
    else if (cmd === 'prev') { if (pos() > 3000) setPos(0); else go(-1); }
    else if (cmd === 'seek') setPos(+arg);
    else if (cmd === 'custom') { if (arg === 'like') st.liked = !st.liked; if (arg === 'shuffle') st.shuffle = !st.shuffle; }
    changed();
  }

  window.Demo = {
    state, control,
    onChange(fn) { listener = fn; },
    volume: () => ({ cur: st.vol, max: 100 }),
    setVolume(v) { st.vol = v; },
  };
})();
