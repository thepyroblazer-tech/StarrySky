/* StarrySky main app. Music comes from Android's media controls (whatever Spotify shows on the lock screen),
   or from demo.js on a PC. No Spotify login is needed. */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = ms => { ms = Math.max(0, ms | 0); const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const native = () => window.StarryNative;
  const BLANK = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#1b2638"/><text x="5" y="6.6" font-size="4" text-anchor="middle" fill="#7f8ba0">♪</text></svg>');

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('starrysky:' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('starrysky:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  const S = { demo: false, view: 'now', st: null, art: '', artId: '', seeking: false, volBusy: 0, sleepAt: 0 };

  /* ---------------- music source: phone or demo ---------------- */
  const src = {
    state() {
      if (S.demo) return Demo.state();
      try { return JSON.parse(native().playerState()); } catch (e) { return { has: false }; }
    },
    control(cmd, arg) {
      if (S.demo) Demo.control(cmd, arg);
      else native().control(cmd, arg == null ? '' : String(arg));
    },
    volume() {
      if (S.demo) return Demo.volume();
      try { return JSON.parse(native().volumeGet()); } catch (e) { return null; }
    },
    setVolume(pct) { if (S.demo) Demo.setVolume(pct); else native().volumeSet(String(pct)); },
    open(uri) {
      if (S.demo || !native()) { toast('On the phone this opens Spotify: ' + uri); return; }
      native().openExternal(uri);
    },
  };

  function setState(st) {
    if (!st) return;
    if (st.art) { S.art = st.art; S.artId = st.artId || ''; }
    else if (st.artId !== S.artId) { S.art = ''; S.artId = st.artId || ''; }
    S.st = st; S.st.receivedAt = Date.now();
    render();
  }
  window.onNativePlayer = json => { try { setState(JSON.parse(json)); } catch (e) { console.warn(e); } };
  Demo.onChange(st => { if (S.demo) setState(st); });

  function livePos() {
    const st = S.st; if (!st || !st.has) return 0;
    let p = st.position;
    if (st.playing) p += (Date.now() - (st.positionAt || st.receivedAt)) * (st.speed || 1);
    return Math.max(0, st.duration ? Math.min(p, st.duration) : p);
  }

  /* ---------------- toast & sheet ---------------- */
  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }
  function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false; $('#sheet').scrollTop = 0; }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; }
  $('#sheetBackdrop').onclick = closeSheet;
  function haptic() {
    if (native() && native().haptic) native().haptic();
    else if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* not allowed */ } }
  }

  /* ---------------- setup / main ---------------- */
  function showSetup() { $('#main').hidden = true; $('#setup').hidden = false; }
  function showMain() {
    $('#setup').hidden = true; $('#main').hidden = false;
    $('#demoBadge').hidden = !S.demo; $('#demoCard').hidden = !S.demo;
    go(S.view);
    setState(src.state());
    readVolume();
  }
  $('#demoBtn').onclick = () => { S.demo = true; showMain(); };
  $('#leaveDemoBtn').onclick = () => { S.demo = false; S.art = ''; S.artId = ''; if (native()) showMain(); else showSetup(); };
  $('#hintOpen').onclick = () => { if (native() && native().openSpotify) native().openSpotify(); else src.open('spotify:'); };

  window.onNativeResume = () => {
    if (S.demo) return;
    if (!$('#main').hidden) { setState(src.state()); readVolume(); }
  };

  /* ---------------- navigation ---------------- */
  function go(view) {
    S.view = view;
    $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === view));
    renderMini();
    if (view === 'themes') renderThemes();
  }
  $$('.tabs button').forEach(b => b.onclick = () => go(b.dataset.go));
  $('#mini').onclick = e => { if (!e.target.closest('#miniPlay')) go('now'); };
  window.onNativeBack = () => {
    if (!$('#sheet').hidden) { closeSheet(); return true; }
    if (!$('#main').hidden && S.view !== 'now') { go('now'); return true; }
    return false;
  };

  /* ---------------- rendering ---------------- */
  const likeAction = () => (S.st && S.st.actions || []).find(a => /like|heart|favou?rite|save/i.test(a.name + ' ' + a.id));

  function render() {
    const st = S.st, has = !!(st && st.has);
    $('#hint').hidden = has || S.demo || !native();
    $('#coverSwipe').parentElement.hidden = !$('#hint').hidden;
    $('.swipe-tip').hidden = !has;
    $('#deviceName').textContent = has ? (st.app || 'Music') : 'No music playing';
    $('#title').textContent = has ? (st.title || 'Unknown song') : 'Nothing playing';
    $('#artist').textContent = has ? (st.artist || '') : (native() || S.demo ? 'Start a song in Spotify' : '');
    const img = has && S.art ? S.art : BLANK;
    if ($('#cover').getAttribute('src') !== img) $('#cover').src = img;
    Themes.setArtwork(has && S.art ? S.art : '');
    $('#cover').classList.toggle('spinning', !!(has && st.playing));
    $('#playIcon').innerHTML = has && st.playing ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
    const like = has && likeAction();
    $('#likeBtn').hidden = !like;
    if (like) { $('#likeBtn').title = like.name; $('#likeBtn').classList.toggle('on', /remove|unlike|saved|liked$/i.test(like.name)); }
    $('#moreBtn').style.visibility = has && st.actions && st.actions.length ? 'visible' : 'hidden';
    renderProgress(); renderMini();
  }
  function setPct(input) { input.style.setProperty('--pct', (input.value / input.max * 100) + '%'); }
  function renderProgress() {
    if (S.seeking) return;
    const st = S.st, dur = st && st.has ? st.duration || 0 : 0, pos = livePos();
    $('#seek').value = dur ? Math.round(pos / dur * 1000) : 0; setPct($('#seek'));
    $('#seek').disabled = !dur || st.canSeek === false;
    $('#pos').textContent = fmt(pos); $('#dur').textContent = fmt(dur);
  }
  function renderMini() {
    const st = S.st, has = !!(st && st.has);
    $('#mini').hidden = S.view === 'now' || !has;
    if (!has) return;
    const img = S.art || BLANK; if ($('#miniCover').getAttribute('src') !== img) $('#miniCover').src = img;
    $('#miniTitle').textContent = st.title || ''; $('#miniArtist').textContent = st.artist || '';
    $('#miniPlayPath').setAttribute('d', st.playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5v14l11-7z');
  }
  setInterval(() => { if (!document.hidden && S.st && S.st.playing) renderProgress(); }, 500);

  /* ---------------- controls ---------------- */
  function togglePlay() {
    const st = S.st;
    if (!st || !st.has) { src.open('spotify:'); return; }
    const playing = st.playing;
    st.position = livePos(); st.positionAt = Date.now(); st.playing = !playing; render(); // feels instant
    src.control(playing ? 'pause' : 'play');
  }
  $('#playBtn').onclick = togglePlay;
  $('#miniPlay').onclick = togglePlay;
  $('#nextBtn').onclick = () => src.control('next');
  $('#prevBtn').onclick = () => src.control('prev');
  $('#deviceBtn').onclick = () => src.open('spotify:');
  $('#likeBtn').onclick = () => { const a = likeAction(); if (a) { haptic(); src.control('custom', a.id); toast(a.name); } };
  $('#moreBtn').onclick = () => {
    const acts = (S.st && S.st.actions) || [];
    openSheet('<div class="section-title">From ' + esc(S.st.app || 'the music app') + '</div><div class="rows">' +
      acts.map((a, i) => `<button class="row" data-act="${i}"><div class="act-ic">✦</div><div class="rt"><div class="t1">${esc(a.name)}</div></div></button>`).join('') +
      '</div><button class="btn ghost" id="openApp">Open ' + esc(S.st.app || 'Spotify') + '</button>');
    $$('#sheetBody [data-act]').forEach(b => b.onclick = () => { const a = acts[+b.dataset.act]; closeSheet(); src.control('custom', a.id); toast(a.name); });
    $('#openApp').onclick = () => { closeSheet(); src.open('spotify:'); };
  };

  const seek = $('#seek');
  seek.addEventListener('input', () => {
    S.seeking = true; setPct(seek);
    if (S.st && S.st.duration) $('#pos').textContent = fmt(seek.value / 1000 * S.st.duration);
  });
  seek.addEventListener('change', () => {
    S.seeking = false; if (!S.st || !S.st.duration) return;
    const ms = Math.round(seek.value / 1000 * S.st.duration);
    S.st.position = ms; S.st.positionAt = Date.now();
    src.control('seek', ms);
  });

  const vol = $('#volume');
  function readVolume() {
    if (Date.now() - S.volBusy < 1500) return;
    const v = src.volume(); if (!v || !v.max) return;
    vol.value = Math.round(v.cur / v.max * 100); setPct(vol);
  }
  vol.addEventListener('input', () => { setPct(vol); S.volBusy = Date.now(); src.setVolume(vol.value); });
  setInterval(() => { if (!document.hidden && !$('#main').hidden) readVolume(); }, 2000);

  /* ---------------- swipe the cover to change song ---------------- */
  (function coverSwipe() {
    const sw = $('#coverSwipe'); let sx = null, dx = 0, busy = false;
    const reset = anim => { sw.style.transition = anim ? 'transform .45s cubic-bezier(.2,.9,.3,1.15), opacity .35s' : 'none'; sw.style.transform = ''; sw.style.opacity = ''; };
    sw.addEventListener('pointerdown', e => {
      if (busy || !(S.st && S.st.has)) return;
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
      const oldTitle = S.st && S.st.title, oldArt = S.artId;
      src.control(dir > 0 ? 'next' : 'prev');
      // wait for the new song (and ideally its cover), or give up after a moment
      for (let i = 0; i < 15 && (S.st && S.st.title === oldTitle || S.artId === oldArt); i++) await new Promise(r => setTimeout(r, 100));
      sw.style.transition = 'none'; sw.style.transform = `translateX(${dir > 0 ? 130 : -130}vw) rotate(${dir > 0 ? 25 : -25}deg)`;
      void sw.offsetWidth; // apply the start position before animating in
      reset(true); busy = false;
    };
    sw.addEventListener('pointerup', end); sw.addEventListener('pointercancel', end);
  })();

  /* ---------------- search: hand off to Spotify ---------------- */
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#searchInput').value.trim(); if (!q) return;
    src.open('spotify:search:' + encodeURIComponent(q));
  });
  $$('[data-open]').forEach(b => b.onclick = () => src.open(b.dataset.open));

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
    if (S.sleepAt && Date.now() >= S.sleepAt && !useNativeSleep()) { S.sleepAt = 0; src.control('pause'); toast('Sleep timer: music paused. Good night ✦'); }
    if (!document.hidden) renderSleep();
  }, 1000);
  $('#sleepBtn').onclick = () => {
    const on = Sleep.endsAt() > Date.now();
    const mins = [5, 15, 30, 45, 60, 90];
    openSheet('<div class="section-title">Sleep timer</div><p class="muted small">Pauses the music when the time is up, even if StarrySky is closed.</p><div class="sleep-grid">' +
      mins.map(m => `<button class="chip big" data-min="${m}">${m < 60 ? m + ' min' : (m / 60) + (m === 60 ? ' hour' : ' hours')}</button>`).join('') +
      '<button class="chip big" data-min="song">End of this song</button></div>' +
      (on ? '<button class="btn ghost" id="sleepOff">Turn the timer off</button>' : ''));
    $$('#sheetBody [data-min]').forEach(b => b.onclick = () => {
      let at;
      if (b.dataset.min === 'song') {
        if (!S.st || !S.st.has || !S.st.duration) { toast('Nothing is playing.'); return; }
        at = Date.now() + (S.st.duration - livePos()) + 800;
      } else at = Date.now() + (+b.dataset.min) * 60000;
      Sleep.set(at); closeSheet(); toast('Music will pause in ' + fmt(at - Date.now()));
    });
    const off = $('#sleepOff'); if (off) off.onclick = () => { Sleep.cancel(); closeSheet(); toast('Sleep timer off'); };
  };

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
  function pushAccent() { if (native() && native().setAccent) native().setAccent(Themes.accentHex()); }
  function setTheme(id, scheme) {
    Themes.apply(id, scheme); store.set('theme', Themes.current);
    pushAccent(); renderThemes();
  }
  $$('#motionSeg button').forEach(b => b.onclick = () => { Themes.setMotion(b.dataset.motion); store.set('motion', b.dataset.motion); renderThemes(); });
  $('#spinToggle').onchange = e => { store.set('spin', e.target.checked); document.body.classList.toggle('no-spin', !e.target.checked); };
  window.onThemeColors = () => { pushAccent(); if (S.view === 'themes') renderThemes(); };

  /* ---------------- safe areas from the Android shell ---------------- */
  window.onNativeInsets = (top, bottom) => {
    document.documentElement.style.setProperty('--sat', top + 'px');
    document.documentElement.style.setProperty('--sab', bottom + 'px');
  };

  /* ---------------- boot ---------------- */
  function boot() {
    const saved = store.get('theme') || { id: 'starry', scheme: 'Base' };
    Themes.start($('#sky')); Themes.apply(saved.id, saved.scheme);
    const motion = store.get('motion') || (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'calm' : 'full');
    Themes.setMotion(motion);
    document.body.classList.toggle('no-spin', store.get('spin') === false);
    pushAccent();
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#main').hidden) { setState(src.state()); readVolume(); } });

    if (/[?&]demo\b/.test(location.search)) { S.demo = true; showMain(); return; }
    if (native()) showMain(); else showSetup();
  }
  boot();
})();
