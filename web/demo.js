/* Demo mode: a fake Spotify so the app and its themes can be tried without an account. */
(function () {
  'use strict';

  function cover(seed, label) {
    const hues = [[260, 320], [200, 250], [10, 40], [150, 190], [330, 20], [40, 60], [180, 280]];
    const [h1, h2] = hues[seed % hues.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},70%,55%)"/><stop offset="1" stop-color="hsl(${h2},70%,25%)"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="${80 + seed * 23 % 140}" cy="${90 + seed * 37 % 120}" r="${50 + seed * 11 % 60}" fill="rgba(255,255,255,.14)"/><text x="24" y="270" font-family="Arial" font-weight="700" font-size="34" fill="rgba(255,255,255,.9)">${label}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const img = (seed, label) => [{ url: cover(seed, label), width: 300, height: 300 }];

  const ARTISTS = ['Nova Vale', 'The Paper Moons', 'Kiro', 'Lumen Drift', 'Ash & Ivory', 'Moth Hour', 'Selene Park'];
  const TITLES = ['Shooting Star', 'Midnight Static', 'Paper Planets', 'Glass Rain', 'Low Tide', 'Neon Orchard', 'Afterglow', 'Silver Line',
    'Northern Lights', 'Slow Comet', 'Velvet Hours', 'Satellite Heart', 'Ember', 'Quiet Storm', 'Blue Hour', 'Constellations'];

  const tracks = TITLES.map((name, i) => {
    const artist = ARTISTS[i % ARTISTS.length];
    return {
      id: 'demo' + i, uri: 'spotify:track:demo' + i, name, duration_ms: 150000 + (i * 17321) % 110000,
      artists: [{ name: artist, uri: 'spotify:artist:a' + (i % ARTISTS.length) }],
      album: { name: name + ' (Single)', images: img(i, name.split(' ')[0]) },
    };
  });
  const playlists = ['Night Drive', 'Rainy Window', 'Focus Stars', 'Warm Lava', 'Liked Mix', 'Aurora Chill'].map((name, i) => ({
    id: 'pl' + i, uri: 'spotify:playlist:pl' + i, name, images: img(i + 3, name.split(' ')[0]),
    owner: { display_name: 'You' }, tracks: { total: 8 + i }, items: { total: 8 + i },
  }));
  const devices = [
    { id: 'd1', name: 'OnePlus 12', type: 'Smartphone', is_active: true, volume_percent: 60 },
    { id: 'd2', name: 'Desktop PC', type: 'Computer', is_active: false, volume_percent: 40 },
  ];

  const st = { idx: 0, playing: true, pos: 42000, at: Date.now(), shuffle: false, repeat: 'off', vol: 60, liked: new Set(['demo2']), queue: [1, 2, 3, 4, 5], dev: 'd1' };
  const pos = () => Math.min(tracks[st.idx].duration_ms, st.pos + (st.playing ? Date.now() - st.at : 0));
  const setPos = p => { st.pos = p; st.at = Date.now(); };
  const go = d => { st.idx = (st.idx + d + tracks.length) % tracks.length; setPos(0); };
  setInterval(() => { if (st.playing && pos() >= tracks[st.idx].duration_ms) go(1); }, 1000);

  async function api(path, opts = {}) {
    const { method = 'GET', query = {}, body } = opts;
    await new Promise(r => setTimeout(r, 120));
    const p = path.split('?')[0];
    if (p === '/me/player' && method === 'GET') {
      return { is_playing: st.playing, progress_ms: pos(), shuffle_state: st.shuffle, repeat_state: st.repeat,
        device: { ...devices.find(d => d.id === st.dev), volume_percent: st.vol }, item: tracks[st.idx], currently_playing_type: 'track' };
    }
    if (p === '/me/player' && method === 'PUT') { st.dev = body.device_ids[0]; return null; }
    if (p === '/me/player/play') {
      if (body && body.uris) { const i = tracks.findIndex(t => t.uri === body.uris[(body.offset && body.offset.position) || 0]); if (i >= 0) { st.idx = i; setPos(0); } }
      else if (body && body.context_uri) { const u = body.offset && body.offset.uri; const i = u ? tracks.findIndex(t => t.uri === u) : 0; st.idx = Math.max(0, i); setPos(0); }
      st.playing = true; st.at = Date.now(); return null;
    }
    if (p === '/me/player/pause') { st.pos = pos(); st.playing = false; return null; }
    if (p === '/me/player/next') { go(1); return null; }
    if (p === '/me/player/previous') { pos() > 3000 ? setPos(0) : go(-1); return null; }
    if (p === '/me/player/seek') { setPos(+query.position_ms); return null; }
    if (p === '/me/player/shuffle') { st.shuffle = query.state === 'true'; return null; }
    if (p === '/me/player/repeat') { st.repeat = query.state; return null; }
    if (p === '/me/player/volume') { st.vol = +query.volume_percent; return null; }
    if (p === '/me/player/devices') return { devices: devices.map(d => ({ ...d, is_active: d.id === st.dev })) };
    if (p === '/me/player/queue' && method === 'GET') return { currently_playing: tracks[st.idx], queue: st.queue.map(i => tracks[(st.idx + i) % tracks.length]) };
    if (p === '/me/player/queue' && method === 'POST') { return null; }
    if (p === '/me/player/recently-played') return { items: tracks.slice(4, 14).map(t => ({ track: t })) };
    if (p === '/me/playlists') return { items: playlists };
    if (p.startsWith('/playlists/')) return { items: tracks.slice(0, 10).map(t => ({ item: t })) };
    if (p.startsWith('/albums/')) return { items: tracks.slice(0, 1) };
    if (p === '/me/tracks/contains') return query.ids.split(',').map(id => st.liked.has(id));
    if (p === '/me/tracks') {
      if (method === 'PUT') { query.ids.split(',').forEach(i => st.liked.add(i)); return null; }
      if (method === 'DELETE') { query.ids.split(',').forEach(i => st.liked.delete(i)); return null; }
      return { items: tracks.filter(t => st.liked.has(t.id)).concat(tracks.slice(6, 12)).map(t => ({ track: t })) };
    }
    if (p === '/search') {
      const q = (query.q || '').toLowerCase();
      const hit = tracks.filter(t => (t.name + ' ' + t.artists[0].name).toLowerCase().includes(q));
      return {
        tracks: { items: (hit.length ? hit : tracks.slice(0, 6)).slice(0, 10) },
        artists: { items: ARTISTS.slice(0, 4).map((n, i) => ({ name: n, uri: 'spotify:artist:a' + i, images: img(i + 1, n.split(' ')[0]), type: 'artist' })) },
        albums: { items: tracks.slice(0, 4).map(t => ({ id: 'al' + t.id, uri: 'spotify:album:' + t.id, name: t.album.name, images: t.album.images, artists: t.artists })) },
        playlists: { items: playlists.slice(0, 4) },
      };
    }
    return null;
  }

  window.Demo = { api };
})();
