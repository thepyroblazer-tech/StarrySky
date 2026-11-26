/* StarrySky main app: views, player polling, controls, library, search, queue, themes. */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = ms => { ms = Math.max(0, ms | 0); const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const native = () => window.StarryNative;
  const BLANK = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#1b2638"/><text x="5" y="6.6" font-size="4" text-anchor="middle" fill="#7f8ba0">♪</text></svg>');

  const S = {
    demo: false, view: 'now', player: null, fetchedAt: 0, liked: false, likedFor: null,
    seeking: false, volTimer: 0, pollTimer: 0, lib: 'playlists',
  };
  const store = { get: k => Spotify.get(k), set: (k, v) => Spotify.set(k, v) };

  function api(path, opts) { return S.demo ? Demo.api(path, opts) : Spotify.api(path, opts); }

  function pickImage(images, min) {
    if (!images || !images.length) return BLANK;
    const sorted = images.slice().sort((a, b) => (a.width || 0) - (b.width || 0));
    const ok = sorted.find(i => (i.width || 640) >= min);
    return (ok || sorted[sorted.length - 1]).url;
  }
  const trackImg = (t, min) => pickImage(t && (t.album ? t.album.images : t.images), min);
  const artistNames = t => t ? (t.artists || (t.show ? [{ name: t.show.name }] : [])).map(a => a.name).join(', ') : '';

  /* ---------------- toast & errors ---------------- */
  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }
  function handleError(e) {
    if (!e) return;
    if (e.auth) { toast('Your Spotify login expired. Connect again.'); showSetup(); return; }
    if (e.reason === 'PREMIUM_REQUIRED' || (e.status === 403 && /premium/i.test(e.message))) return toast('Controlling playback needs Spotify Premium.');
    if (e.reason === 'NO_ACTIVE_DEVICE' || e.status === 404) { toast('No active device. Open Spotify on your phone, then pick it here.'); return openDevices(); }
    if (e.reason === 'VOLUME_CONTROL_DISALLOW') return toast('This device does not allow volume control from apps.');
    if (e.status === 403) return toast('Spotify refused that (' + e.message + ').');
    toast(e.message || 'Something went wrong.');
    console.warn(e);
  }

  /* ---------------- setup / login ---------------- */
  function showSetup(err) {
    clearInterval(S.pollTimer);
    $('#main').hidden = true; $('#setup').hidden = false;
    $('#redirectUri').textContent = Spotify.redirectUri();
    $('#clientId').value = Spotify.clientId() || store.get('pendingClientId') || '';
    const el = $('#setupError'); el.hidden = !err; el.textContent = err || '';
  }

  function showMain() {
    $('#setup').hidden = true; $('#main').hidden = false;
    $('#demoBadge').hidden = !S.demo;
    $('#accountInfo').textContent = S.demo ? 'Demo mode, not connected to Spotify.' : 'Connected with Client ID ' + (Spotify.clientId() || '').slice(0, 8) + '…';
    $('#logoutBtn').textContent = S.demo ? 'Leave demo' : 'Log out';
    go(S.view);
    refreshPlayer();
    clearInterval(S.pollTimer);
    S.pollTimer = setInterval(() => { if (!document.hidden) refreshPlayer(); }, 3000);
  }

  async function finishAuth(url) {
    try {
      if (await Spotify.handleRedirect(url)) { S.demo = false; showMain(); toast('Connected to Spotify ✦'); }
    } catch (e) { showSetup(e.message); }
  }

  $('#copyRedirect').onclick = () => {
    const t = $('#redirectUri').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copied'), () => toast(t));
  };
  $('#connectBtn').onclick = () => {
    const id = $('#clientId').value.trim();
    if (!/^[0-9a-f]{32}$/i.test(id)) { showSetup('That doesn\'t look like a Client ID (32 letters and numbers).'); return; }
    store.set('pendingClientId', id);
    Spotify.login(id).catch(e => showSetup(e.message));
  };
  $('#demoBtn').onclick = () => { S.demo = true; showMain(); };
  $('#logoutBtn').onclick = () => { if (!S.demo) Spotify.logout(); S.demo = false; S.player = null; renderPlayer(); showSetup(); };

  /* ---------------- navigation ---------------- */
  function go(view) {
    S.view = view;
    $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === view));
    renderMini();
    if (view === 'library') loadLibrary();
    if (view === 'queue') loadQueue();
    if (view === 'themes') renderThemes();
    if (view === 'search') setTimeout(() => { if (!$('#searchInput').value) $('#searchInput').focus(); }, 250);
  }
  $$('.tabs button').forEach(b => b.onclick = () => go(b.dataset.go));
  $('#mini').onclick = e => { if (!e.target.closest('#miniPlay')) go('now'); };

  window.onNativeBack = () => {
    if (!$('#sheet').hidden) { closeSheet(); return true; }
    if (!$('#main').hidden && S.view !== 'now') { go('now'); return true; }
    return false;
  };

  /* ---------------- player ---------------- */
  let refreshing = false;
  async function refreshPlayer() {
    if (refreshing) return; refreshing = true;
    try {
      const p = await api('/me/player', { query: { additional_types: 'episode' } });
      S.player = p; S.fetchedAt = Date.now();
      renderPlayer();
      const t = p && p.item;
      if (t && t.id && t.id !== S.likedFor && t.type !== 'episode') {
        S.likedFor = t.id;
        api('/me/tracks/contains', { query: { ids: t.id } }).then(r => { S.liked = !!(r && r[0]); renderLike(); }).catch(() => {});
      }
    } catch (e) { if (e.auth) handleError(e); }
    finally { refreshing = false; }
  }
  const soon = (ms = 450) => setTimeout(refreshPlayer, ms);

  function livePos() {
    const p = S.player; if (!p || !p.item) return 0;
    const ms = p.progress_ms + (p.is_playing ? Date.now() - S.fetchedAt : 0);
    return Math.min(ms, p.item.duration_ms);
  }

  function setPct(input) { input.style.setProperty('--pct', (input.value / input.max * 100) + '%'); }

  function renderPlayer() {
    const p = S.player, t = p && p.item;
    $('#deviceName').textContent = p && p.device ? p.device.name : 'No device';
    $('#title').textContent = t ? t.name : 'Nothing playing';
    $('#artist').textContent = t ? artistNames(t) : 'Start music in Spotify, or tap the device button';
    const src = t ? pickImage(t.album ? t.album.images : t.images, 600) : BLANK;
    if ($('#cover').getAttribute('src') !== src) $('#cover').src = src;
    Themes.setArtwork(t ? src : '');
    syncWidget();
    $('#cover').classList.toggle('spinning', !!(p && p.is_playing));
    $('#playIcon').innerHTML = p && p.is_playing ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
    $('#shuffleBtn').classList.toggle('on', !!(p && p.shuffle_state));
    $('#repeatBtn').classList.toggle('on', !!(p && p.repeat_state !== 'off'));
    $('#repeatBtn').classList.toggle('one', !!(p && p.repeat_state === 'track'));
    if (p && p.device && p.device.volume_percent != null && !S.volTimer) { $('#volume').value = p.device.volume_percent; setPct($('#volume')); }
    renderLike(); renderProgress(); renderMini();
  }
  function renderLike() { $('#likeBtn').classList.toggle('on', S.liked && !!(S.player && S.player.item)); }
  function renderProgress() {
    if (S.seeking) return;
    const t = S.player && S.player.item, dur = t ? t.duration_ms : 0, pos = livePos();
    $('#seek').value = dur ? Math.round(pos / dur * 1000) : 0; setPct($('#seek'));
    $('#pos').textContent = fmt(pos); $('#dur').textContent = fmt(dur);
  }
  function renderMini() {
    const p = S.player, t = p && p.item;
    $('#mini').hidden = S.view === 'now' || !t;
    if (!t) return;
    const src = trackImg(t, 64); if ($('#miniCover').getAttribute('src') !== src) $('#miniCover').src = src;
    $('#miniTitle').textContent = t.name; $('#miniArtist').textContent = artistNames(t);
    $('#miniPlayPath').setAttribute('d', p.is_playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5v14l11-7z');
  }
  setInterval(() => { if (!document.hidden && S.player && S.player.is_playing) renderProgress(); }, 500);

  /* ---------------- home-screen widget ---------------- */
  let widgetKey = '';
  function syncWidget() {
    if (S.demo || !native() || !native().widgetUpdate) return;
    const p = S.player, t = p && p.item;
    const data = { title: t ? t.name : '', artist: t ? artistNames(t) : '', playing: !!(p && p.is_playing), cover: t ? trackImg(t, 300) : '', accent: Themes.accentHex() };
    const key = JSON.stringify(data);
    if (key === widgetKey) return;
    widgetKey = key; native().widgetUpdate(key);
  }

  /* ---------------- swipe the cover to change song ---------------- */
  (function coverSwipe() {
    const sw = $('#coverSwipe'); let sx = null, dx = 0, busy = false;
    const reset = anim => { sw.style.transition = anim ? 'transform .45s cubic-bezier(.2,.9,.3,1.15), opacity .35s' : 'none'; sw.style.transform = ''; sw.style.opacity = ''; };
    sw.addEventListener('pointerdown', e => {
      if (busy || !(S.player && S.player.item)) return;
      sx = e.clientX; dx = 0; sw.style.transition = 'none';
      try { sw.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    sw.addEventListener('pointermove', e => {
      if (sx == null) return;
      dx = e.clientX - sx;
      sw.style.transform = `translateX(${dx}px) rotate(${dx / 16}deg)`;
      sw.style.opacity = String(1 - Math.min(.45, Math.abs(dx) / 700));
    });
    const end = async () => {
      if (sx == null) return; sx = null;
      const dir = dx < -70 ? 1 : dx > 70 ? -1 : 0; // left = next, right = previous
      if (!dir) { reset(true); return; }
      busy = true; haptic();
      sw.style.transition = 'transform .22s ease-in, opacity .22s';
      sw.style.transform = `translateX(${dir > 0 ? -130 : 130}vw) rotate(${dir > 0 ? -25 : 25}deg)`; sw.style.opacity = '0';
      try { await api(dir > 0 ? '/me/player/next' : '/me/player/previous', { method: 'POST' }); } catch (err) { handleError(err); }
      await new Promise(r => setTimeout(r, 380));
      await refreshPlayer();
      sw.style.transition = 'none'; sw.style.transform = `translateX(${dir > 0 ? 130 : -130}vw) rotate(${dir > 0 ? 25 : -25}deg)`;
      void sw.offsetWidth; // apply the start position before animating in
      reset(true); busy = false;
    };
    sw.addEventListener('pointerup', end); sw.addEventListener('pointercancel', end);
  })();

  /* ---------------- sleep timer ---------------- */
  const useNativeSleep = () => !S.demo && native() && native().sleepSet;
  const Sleep = {
    endsAt() { return useNativeSleep() ? (+native().sleepGet() || 0) : (S.sleepAt || 0); },
    set(at) { if (useNativeSleep()) native().sleepSet(String(Math.round(at))); else S.sleepAt = at; renderSleep(); },
    cancel() { if (useNativeSleep()) native().sleepCancel(); S.sleepAt = 0; renderSleep(); },
  };
  function renderSleep() {
    const left = Sleep.endsAt() - Date.now(), on = left > 0;
    $('#sleepBtn').classList.toggle('on', on);
    $('#sleepLabel').textContent = on ? 'Stops in ' + fmt(left) : 'Sleep timer';
  }
  setInterval(() => {
    if (S.sleepAt && Date.now() >= S.sleepAt && !useNativeSleep()) {
      S.sleepAt = 0; api('/me/player/pause', { method: 'PUT' }).catch(() => {}).finally(() => soon(200)); toast('Sleep timer: music paused. Good night ✦');
    }
    if (!document.hidden) renderSleep();
  }, 1000);
  $('#sleepBtn').onclick = () => {
    const on = Sleep.endsAt() > Date.now();
    const mins = [5, 15, 30, 45, 60, 90];
    openSheet('<div class="section-title">Sleep timer</div><p class="muted small">Pauses Spotify when the time is up, even if StarrySky is closed.</p><div class="sleep-grid">' +
      mins.map(m => `<button class="chip big" data-min="${m}">${m < 60 ? m + ' min' : (m / 60) + (m === 60 ? ' hour' : ' hours')}</button>`).join('') +
      '<button class="chip big" data-min="song">End of this song</button></div>' +
      (on ? '<button class="btn ghost" id="sleepOff">Turn the timer off</button>' : ''));
    $$('#sheetBody [data-min]').forEach(b => b.onclick = () => {
      let at;
      if (b.dataset.min === 'song') {
        const t = S.player && S.player.item;
        if (!t) { toast('Nothing is playing.'); return; }
        at = Date.now() + (t.duration_ms - livePos()) + 800;
      } else at = Date.now() + (+b.dataset.min) * 60000;
      Sleep.set(at); closeSheet(); toast('Music will pause in ' + fmt(at - Date.now()));
    });
    const off = $('#sleepOff'); if (off) off.onclick = () => { Sleep.cancel(); closeSheet(); toast('Sleep timer off'); };
  };

  async function control(fn, optimistic) {
    if (optimistic && S.player) { optimistic(S.player); renderPlayer(); }
    try { await fn(); } catch (e) { handleError(e); }
    soon();
  }

  async function togglePlay() {
    const playing = S.player && S.player.is_playing;
    if (!S.player) { try { await api('/me/player/play', { method: 'PUT' }); } catch (e) { handleError(e); } return soon(); }
    control(() => api(playing ? '/me/player/pause' : '/me/player/play', { method: 'PUT' }),
      p => { p.progress_ms = livePos(); S.fetchedAt = Date.now(); p.is_playing = !playing; });
  }
  $('#playBtn').onclick = togglePlay;
  $('#miniPlay').onclick = togglePlay;
  $('#nextBtn').onclick = () => control(() => api('/me/player/next', { method: 'POST' }));
  $('#prevBtn').onclick = () => control(() => api('/me/player/previous', { method: 'POST' }));
  $('#shuffleBtn').onclick = () => { const on = !(S.player && S.player.shuffle_state); control(() => api('/me/player/shuffle', { method: 'PUT', query: { state: on } }), p => { p.shuffle_state = on; }); };
  $('#repeatBtn').onclick = () => {
    const order = ['off', 'context', 'track'], cur = (S.player && S.player.repeat_state) || 'off';
    const next = order[(order.indexOf(cur) + 1) % 3];
    control(() => api('/me/player/repeat', { method: 'PUT', query: { state: next } }), p => { p.repeat_state = next; });
  };
  $('#likeBtn').onclick = () => {
    const t = S.player && S.player.item; if (!t || !t.id) return;
    const on = !S.liked; S.liked = on; renderLike();
    api('/me/tracks', { method: on ? 'PUT' : 'DELETE', query: { ids: t.id } }).then(() => toast(on ? 'Added to Liked Songs' : 'Removed from Liked Songs')).catch(e => { S.liked = !on; renderLike(); handleError(e); });
  };

  const seek = $('#seek');
  seek.addEventListener('input', () => {
    S.seeking = true; setPct(seek);
    const t = S.player && S.player.item; if (t) $('#pos').textContent = fmt(seek.value / 1000 * t.duration_ms);
  });
  seek.addEventListener('change', () => {
    const t = S.player && S.player.item; S.seeking = false; if (!t) return;
    const ms = Math.round(seek.value / 1000 * t.duration_ms);
    control(() => api('/me/player/seek', { method: 'PUT', query: { position_ms: ms } }), p => { p.progress_ms = ms; S.fetchedAt = Date.now(); });
  });

  const vol = $('#volume');
  vol.addEventListener('input', () => {
    setPct(vol); clearTimeout(S.volTimer);
    S.volTimer = setTimeout(() => {
      api('/me/player/volume', { method: 'PUT', query: { volume_percent: vol.value } }).catch(handleError).finally(() => { setTimeout(() => { S.volTimer = 0; }, 1500); });
    }, 250);
  });

  /* ---------------- devices ---------------- */
  async function openDevices() {
    openSheet('<div class="section-title">Play on</div><div class="loading">Looking for devices</div>');
    try {
      const r = await api('/me/player/devices');
      const list = (r && r.devices) || [];
      const rows = list.map(d => `<button class="row" data-dev="${esc(d.id)}"><img src="${BLANK}" alt=""><div class="rt"><div class="t1">${esc(d.name)}${d.is_active ? ' ✦' : ''}</div><div class="t2">${esc(d.type)}${d.is_active ? ' · playing here' : ''}</div></div></button>`).join('');
      $('#sheetBody').innerHTML = '<div class="section-title">Play on</div>' +
        (rows ? '<div class="rows">' + rows + '</div>' : '<p class="empty">No devices found. Open the Spotify app on your phone and play something for a second, then try again.</p>') +
        '<button class="btn ghost" id="openSpotify">Open the Spotify app</button>';
      $$('#sheetBody [data-dev]').forEach(b => b.onclick = () => {
        closeSheet();
        control(() => api('/me/player', { method: 'PUT', body: { device_ids: [b.dataset.dev], play: true } }));
      });
      $('#openSpotify').onclick = () => { closeSheet(); openSpotifyApp(); };
    } catch (e) { closeSheet(); handleError(e); }
  }
  $('#deviceBtn').onclick = openDevices;
  function openSpotifyApp() { if (native()) native().openExternal('spotify:'); else location.href = 'spotify:'; }

  /* ---------------- sheet ---------------- */
  function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false; $('#sheet').scrollTop = 0; }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; }
  $('#sheetBackdrop').onclick = closeSheet;

  /* ---------------- list helpers ---------------- */
  const PLUS = '<svg viewBox="0 0 24 24" class="ic"><path d="M3 6h12M3 12h12M3 18h7M18 13v8M14 17h8"/></svg>';
  function trackRows(tracks, opts = {}) {
    const cur = S.player && S.player.item && S.player.item.uri;
    return '<div class="rows">' + tracks.map((t, i) => {
      if (!t) return '';
      const row = `
      <div class="row${t.uri === cur ? ' playing' : ''}" data-i="${i}">
        <img src="${esc(trackImg(t, 64))}" alt="" loading="lazy">
        <div class="rt"><div class="t1">${esc(t.name)}</div><div class="t2">${esc(artistNames(t))}</div></div>
        ${opts.noAdd ? '' : `<button class="add" data-q="${i}" title="Add to queue">${PLUS}</button>`}
      </div>`;
      return opts.noAdd ? row : `<div class="swipe-wrap"><div class="swipe-hint">${PLUS}<span>Add to queue</span></div>${row}</div>`;
    }).join('') + '</div>';
  }
  function bindTrackRows(root, tracks, playFn) {
    root.querySelectorAll('.row[data-i]').forEach(r => r.onclick = e => {
      if (r.dataset.swiped) return;
      const i = +r.dataset.i, t = tracks[i];
      if (e.target.closest('[data-q]')) { addToQueue(t); return; }
      playFn(t, i);
    });
    root.querySelectorAll('.swipe-wrap').forEach(w => attachRowSwipe(w, tracks));
  }

  /* Drag a song row to the left to add it to the queue. */
  const QUEUE_PULL = 90;
  function attachRowSwipe(wrap, tracks) {
    const row = wrap.querySelector('.row'); let sx = null, sy = 0, dx = 0, mode = null;
    row.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; dx = 0; mode = null; row.style.transition = 'none'; });
    row.addEventListener('pointermove', e => {
      if (sx == null) return;
      const mx = e.clientX - sx, my = e.clientY - sy;
      if (!mode) {
        if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.4) { mode = 'h'; try { row.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
        else if (Math.abs(my) > 10) mode = 'v';
      }
      if (mode !== 'h') return;
      dx = Math.min(0, mx); if (dx < -QUEUE_PULL) dx = -QUEUE_PULL + (dx + QUEUE_PULL) * .35;
      row.style.transform = `translateX(${dx}px)`;
      const armed = mx < -QUEUE_PULL;
      if (armed && !wrap.classList.contains('armed')) haptic();
      wrap.classList.toggle('armed', armed);
    });
    const end = () => {
      if (mode === 'h') {
        row.dataset.swiped = '1'; setTimeout(() => { delete row.dataset.swiped; }, 60);
        if (wrap.classList.contains('armed')) { addToQueue(tracks[+row.dataset.i]); wrap.classList.add('done'); }
        row.style.transition = 'transform .35s cubic-bezier(.2,.9,.3,1.15)'; row.style.transform = '';
        setTimeout(() => wrap.classList.remove('armed', 'done'), 700);
      }
      sx = null; mode = null;
    };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
  }
  function haptic() {
    if (native() && native().haptic) native().haptic();
    else if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* not allowed */ } }
  }
  function addToQueue(t) {
    api('/me/player/queue', { method: 'POST', query: { uri: t.uri } }).then(() => toast('Added to queue: ' + t.name)).catch(handleError);
  }
  function playUris(tracks, i) {
    const uris = tracks.filter(Boolean).map(t => t.uri).filter(u => u && !u.startsWith('spotify:local'));
    const idx = Math.max(0, uris.indexOf(tracks[i] && tracks[i].uri));
    const start = Math.max(0, idx - 20), slice = uris.slice(start, start + 50);
    control(() => api('/me/player/play', { method: 'PUT', body: { uris: slice, offset: { position: idx - start } } }));
  }
  function playContext(contextUri, trackUri) {
    const body = { context_uri: contextUri }; if (trackUri) body.offset = { uri: trackUri };
    control(() => api('/me/player/play', { method: 'PUT', body }));
  }

  /* Playlist items moved from /tracks to /items (2026 API change); support both shapes. */
  async function playlistTracks(id) {
    let r;
    try { r = await api('/playlists/' + id + '/items', { query: { limit: 100 } }); }
    catch (e) { if (e.status !== 404 && e.status !== 403) throw e; r = await api('/playlists/' + id + '/tracks', { query: { limit: 100 } }); }
    return ((r && r.items) || []).map(x => x.item || x.track).filter(t => t && t.uri);
  }

  async function openCollection(kind, obj) {
    const name = obj.name, img = pickImage(obj.images, 200);
    const sub = kind === 'playlist' ? 'Playlist · ' + esc((obj.owner && obj.owner.display_name) || '') : 'Album · ' + esc(artistNames(obj));
    openSheet(`<div class="sheet-head"><img src="${esc(img)}" alt=""><div><div class="t1">${esc(name)}</div><div class="t2">${sub}</div><button class="btn primary" id="playAll">Play</button></div></div><div id="colTracks" class="loading">Loading songs</div>`);
    $('#playAll').onclick = () => { closeSheet(); playContext(obj.uri); };
    try {
      let tracks;
      if (kind === 'playlist') tracks = await playlistTracks(obj.id);
      else { const r = await api('/albums/' + obj.id + '/tracks', { query: { limit: 50 } }); tracks = ((r && r.items) || []).map(t => ({ ...t, album: { images: obj.images } })); }
      const box = $('#colTracks'); if (!box) return;
      box.className = ''; box.innerHTML = tracks.length ? trackRows(tracks) : '<p class="empty">No songs here.</p>';
      bindTrackRows(box, tracks, t => { closeSheet(); playContext(obj.uri, t.uri); });
    } catch (e) { const box = $('#colTracks'); if (box) { box.className = 'empty'; box.textContent = e.message; } }
  }

  /* ---------------- library ---------------- */
  $$('#libSeg button').forEach(b => b.onclick = () => { S.lib = b.dataset.lib; $$('#libSeg button').forEach(x => x.classList.toggle('on', x === b)); loadLibrary(); });

  async function loadLibrary() {
    const body = $('#libBody'); body.innerHTML = '<div class="loading">Loading</div>';
    try {
      if (S.lib === 'playlists') {
        const r = await api('/me/playlists', { query: { limit: 50 } });
        const items = ((r && r.items) || []).filter(Boolean);
        body.innerHTML = items.length ? '<div class="grid">' + items.map((p, i) => `<button class="tile" data-p="${i}"><img src="${esc(pickImage(p.images, 200))}" alt="" loading="lazy"><div class="t1">${esc(p.name)}</div><div class="t2">${esc((p.owner && p.owner.display_name) || '')}</div></button>`).join('') + '</div>' : '<p class="empty">No playlists yet.</p>';
        body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => openCollection('playlist', items[+b.dataset.p]));
      } else {
        const r = S.lib === 'liked' ? await api('/me/tracks', { query: { limit: 50 } }) : await api('/me/player/recently-played', { query: { limit: 50 } });
        const tracks = ((r && r.items) || []).map(x => x.track || x.item).filter(Boolean);
        body.innerHTML = tracks.length ? trackRows(tracks) : '<p class="empty">Nothing here yet.</p>';
        bindTrackRows(body, tracks, (t, i) => playUris(tracks, i));
      }
    } catch (e) { body.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; if (e.auth) handleError(e); }
  }

  /* ---------------- search ---------------- */
  let searchTimer = 0, searchSeq = 0;
  $('#searchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 380); });
  async function runSearch() {
    const q = $('#searchInput').value.trim(), body = $('#searchBody'), seq = ++searchSeq;
    if (!q) { body.innerHTML = '<p class="muted center">Songs, artists, albums and playlists.</p>'; return; }
    body.innerHTML = '<div class="loading">Searching</div>';
    try {
      const r = await api('/search', { query: { q, type: 'track,artist,album,playlist', limit: 10 } });
      if (seq !== searchSeq) return;
      const tracks = ((r.tracks && r.tracks.items) || []).filter(Boolean);
      const artists = ((r.artists && r.artists.items) || []).filter(Boolean);
      const albums = ((r.albums && r.albums.items) || []).filter(Boolean);
      const pls = ((r.playlists && r.playlists.items) || []).filter(Boolean);
      let html = '';
      if (tracks.length) html += '<div class="section-title">Songs</div><div id="sTracks">' + trackRows(tracks) + '</div>';
      if (artists.length) html += '<div class="section-title">Artists</div><div class="rows">' + artists.slice(0, 5).map((a, i) => `<button class="row round" data-a="${i}"><img src="${esc(pickImage(a.images, 64))}" alt="" loading="lazy"><div class="rt"><div class="t1">${esc(a.name)}</div><div class="t2">Artist · tap to play</div></div></button>`).join('') + '</div>';
      if (albums.length) html += '<div class="section-title">Albums</div><div class="grid">' + albums.slice(0, 6).map((a, i) => `<button class="tile" data-al="${i}"><img src="${esc(pickImage(a.images, 200))}" alt="" loading="lazy"><div class="t1">${esc(a.name)}</div><div class="t2">${esc(artistNames(a))}</div></button>`).join('') + '</div>';
      if (pls.length) html += '<div class="section-title">Playlists</div><div class="grid">' + pls.slice(0, 6).map((p, i) => `<button class="tile" data-pl="${i}"><img src="${esc(pickImage(p.images, 200))}" alt="" loading="lazy"><div class="t1">${esc(p.name)}</div><div class="t2">${esc((p.owner && p.owner.display_name) || '')}</div></button>`).join('') + '</div>';
      body.innerHTML = html || '<p class="empty">No results for “' + esc(q) + '”.</p>';
      const st = $('#sTracks'); if (st) bindTrackRows(st, tracks, (t, i) => playUris(tracks, i));
      body.querySelectorAll('[data-a]').forEach(b => b.onclick = () => playContext(artists[+b.dataset.a].uri));
      body.querySelectorAll('[data-al]').forEach(b => b.onclick = () => openCollection('album', albums[+b.dataset.al]));
      body.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => openCollection('playlist', pls[+b.dataset.pl]));
    } catch (e) { if (seq === searchSeq) body.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; }
  }

  /* ---------------- queue ---------------- */
  async function loadQueue() {
    const body = $('#queueBody'); body.innerHTML = '<div class="loading">Loading queue</div>';
    try {
      const r = await api('/me/player/queue');
      const now = r && r.currently_playing, q = ((r && r.queue) || []).filter(Boolean);
      if (!now && !q.length) { body.innerHTML = '<p class="empty">The queue is empty. Play something first.</p>'; return; }
      body.innerHTML = (now ? '<div class="section-title">Now playing</div>' + trackRows([now], { noAdd: true }) : '') +
        (q.length ? '<div class="section-title">Next up</div><div id="qList">' + trackRows(q, { noAdd: true }) + '</div>' : '');
      const ql = $('#qList'); if (ql) bindTrackRows(ql, q, () => toast('Use Next to skip ahead. Spotify does not let apps reorder the queue.'));
    } catch (e) { body.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; }
  }

  /* ---------------- themes ---------------- */
  function renderThemes() {
    const cur = Themes.current;
    $('#themeList').innerHTML = Object.entries(Themes.THEMES).map(([id, th]) => `
      <button class="theme-card${cur.id === id ? ' on' : ''}" data-theme="${id}" style="background:${Themes.previewFor(id, id === 'starry' ? cur.scheme : null)}">
        <span class="tc-sub">${esc(th.sub)}</span><span>${esc(th.name)}</span></button>`).join('');
    $('#schemeList').innerHTML = Object.entries(Themes.STARRY).map(([name, s]) => `
      <button class="scheme${cur.id === 'starry' && cur.scheme === name ? ' on' : ''}" data-scheme="${esc(name)}"><i style="background:linear-gradient(180deg,${s.top},${s.bottom})"></i>${esc(name)}</button>`).join('');
    $$('#themeList [data-theme]').forEach(b => b.onclick = () => setTheme(b.dataset.theme, cur.scheme));
    $$('#schemeList [data-scheme]').forEach(b => b.onclick = () => setTheme('starry', b.dataset.scheme));
    $$('#motionSeg button').forEach(b => b.classList.toggle('on', b.dataset.motion === Themes.motion));
    $('#spinToggle').checked = store.get('spin') !== false;
  }
  function setTheme(id, scheme) {
    Themes.apply(id, scheme); store.set('theme', Themes.current);
    if (native() && native().setBarColor) native().setBarColor(getComputedStyle(document.documentElement).getPropertyValue('--card-solid').trim());
    renderThemes();
  }
  $$('#motionSeg button').forEach(b => b.onclick = () => { Themes.setMotion(b.dataset.motion); store.set('motion', b.dataset.motion); renderThemes(); });
  $('#spinToggle').onchange = e => { store.set('spin', e.target.checked); document.body.classList.toggle('no-spin', !e.target.checked); };

  /* ---------------- safe areas from the Android shell ---------------- */
  window.onNativeInsets = (top, bottom) => {
    document.documentElement.style.setProperty('--sat', top + 'px');
    document.documentElement.style.setProperty('--sab', bottom + 'px');
  };
  window.onNativeAuth = url => finishAuth(url);
  window.onThemeColors = () => { if (S.view === 'themes') renderThemes(); };
  window.onNativeResume = () => { if (!$('#main').hidden) refreshPlayer(); };

  /* ---------------- boot ---------------- */
  function boot() {
    const saved = store.get('theme') || { id: 'starry', scheme: 'Base' };
    Themes.start($('#sky')); Themes.apply(saved.id, saved.scheme);
    const motion = store.get('motion') || (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'calm' : 'full');
    Themes.setMotion(motion);
    document.body.classList.toggle('no-spin', store.get('spin') === false);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#main').hidden) refreshPlayer(); });

    const pending = native() && native().takePendingAuth ? native().takePendingAuth() : '';
    if (pending) { finishAuth(pending); return; }
    if (/[?&](code|error)=/.test(location.search)) {
      const url = location.href; history.replaceState(null, '', location.pathname);
      finishAuth(url); return;
    }
    if (/[?&]demo\b/.test(location.search)) { S.demo = true; showMain(); return; }
    if (Spotify.loggedIn()) showMain(); else showSetup();
  }
  boot();
})();
