/* StarrySky animated backgrounds.
 * StarryNight colours/motion follow the StarryNight Spicetify theme (b-chen00, MIT).
 * Everything is drawn on one <canvas>; animation pauses while the app is hidden. */
(function () {
  'use strict';

  // StarryNight schemes, mapped from the theme's color.ini (top = sidebar-alt, bottom = sidebar).
  const STARRY = {
    'Base':         { top: '#000000', bottom: '#142b44', star: '#ffffff', glow: '#ffffff', shoot: '#ffffff', accent: '#FFF3C4', card: '#152238', text: '#ffffff', sub: '#ADB5BD' },
    'Cotton Candy': { top: '#ff71b2', bottom: '#509be1', star: '#ffffff', glow: '#ffffff', shoot: '#ffffff', accent: '#d3e9ff', card: '#9f45b0', text: '#ffffff', sub: '#fff4f4' },
    'Forest':       { top: '#000000', bottom: '#14442b', star: '#ffffff', glow: '#ffffff', shoot: '#ffffff', accent: '#c4c6ff', card: '#011502', text: '#ffffff', sub: '#ADB5BD' },
    'Galaxy':       { top: '#00076f', bottom: '#b133c9', star: '#ffffff', glow: '#ffffff', shoot: '#ffffff', accent: '#FFF3C4', card: '#9f45b0', text: '#ffe4f2', sub: '#ffffff' },
    'Orange':       { top: '#000000', bottom: '#e69138', star: '#ffe234', glow: '#fff3ad', shoot: '#fff099', accent: '#fbe39b', card: '#c37728', text: '#ffffff', sub: '#ffffff' },
    'Sky':          { top: '#1e48a9', bottom: '#62cff4', star: '#ffffff', glow: '#ffffff', shoot: '#ffffff', accent: '#FFF3C4', card: '#6b94f5', text: '#ffffff', sub: '#040a18' },
    'Sunrise':      { top: '#FFAE41', bottom: '#F83D41', star: '#ffffff', glow: '#ffffff', shoot: '#ffffff', accent: '#FFF3C4', card: '#C49C48', text: '#ffffff', sub: '#E0E0E0' },
  };

  const THEMES = {
    starry: { name: 'StarryNight', sub: 'Your PC theme', preview: s => `linear-gradient(180deg, ${s.top}, ${s.bottom})` },
    aurora: { name: 'Aurora', sub: 'Northern lights', colors: { accent: '#7CF5C8', card: '#0b2233', text: '#ffffff', sub: '#a9c6d6' },
              preview: () => 'linear-gradient(160deg, #020611 10%, #0b5f55 45%, #3a1f7a 80%, #06142a)' },
    rain:   { name: 'Rain', sub: 'Drops on glass', colors: { accent: '#9CC9FF', card: '#0f2340', text: '#ffffff', sub: '#9fb3cc' },
              preview: () => 'linear-gradient(180deg, #050b1a, #13305a 70%, #2a3f66)' },
    lava:   { name: 'Lava lamp', sub: 'Warm glowing blobs', colors: { accent: '#FFB36B', card: '#3a0d1c', text: '#ffffff', sub: '#e7b9a6' },
              preview: () => 'radial-gradient(circle at 30% 70%, #ff5f3c, transparent 45%), radial-gradient(circle at 75% 30%, #ff3c7a, transparent 45%), #1a0510' },
  };

  const rnd = (a, b) => a + Math.random() * (b - a);
  const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };
  const luminance = h => { const [r, g, b] = hexToRgb(h).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

  function sprite(size, stops) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
  }

  /* ---------------- renderers ---------------- */

  function Starry(s) {
    let W, H, stars = [], shooting = [], nextShoot = 0, bg, starSprite, headSprite;
    return {
      resize(w, h) {
        W = w; H = h;
        bg = document.createElement('canvas'); bg.width = w; bg.height = h;
        const g = bg.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, s.top); gr.addColorStop(1, s.bottom); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        starSprite = sprite(32, [[0, rgba(s.star, 1)], [0.12, rgba(s.star, 1)], [0.3, rgba(s.glow, .35)], [1, rgba(s.glow, 0)]]);
        headSprite = sprite(48, [[0, rgba(s.shoot, 1)], [0.12, rgba(s.shoot, 1)], [0.35, rgba(s.shoot, .3)], [1, rgba(s.shoot, 0)]]);
        const count = Math.min(380, Math.round((w * h) / (7000 * View.dpr * View.dpr)));
        stars = Array.from({ length: count }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          r: rnd(.35, 1) * View.dpr * (Math.random() < .12 ? 1.9 : 1),
          ph: Math.random() * 6.28, sp: rnd(.6, 1.8),
        }));
      },
      frame(t, dt, speed) {
        const c = View.ctx; c.drawImage(bg, 0, 0);
        for (const st of stars) {
          const a = .45 + .55 * (0.5 + 0.5 * Math.sin(st.ph + t * st.sp * speed));
          const d = st.r * 9; c.globalAlpha = a; c.drawImage(starSprite, st.x - d / 2, st.y - d / 2, d, d);
        }
        c.globalAlpha = 1;
        // shooting stars: 315deg heading (down-left), 1500 css px over 3s, fade after 70%
        if (speed > 0 && t > nextShoot) {
          shooting.push({ x: rnd(.3, 1.15) * W, y: rnd(-.1, .45) * H, age: 0 });
          nextShoot = t + rnd(2.5, 7) / speed;
        }
        const k = View.dpr, len = 300 * k;
        shooting = shooting.filter(sh => (sh.age += dt * speed) < 3);
        for (const sh of shooting) {
          const p = sh.age / 3, dist = p * 1500 * k;
          const x = sh.x - dist * .7071, y = sh.y + dist * .7071;
          const a = p < .7 ? 1 : 1 - (p - .7) / .3;
          const tx = x + len * .7071, ty = y - len * .7071;
          const gr = c.createLinearGradient(x, y, tx, ty);
          gr.addColorStop(0, rgba(s.shoot, a)); gr.addColorStop(1, rgba(s.shoot, 0));
          c.strokeStyle = gr; c.lineWidth = 1.2 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke();
          c.globalAlpha = a; const d = 14 * k; c.drawImage(headSprite, x - d / 2, y - d / 2, d, d); c.globalAlpha = 1;
        }
      },
    };
  }

  function Aurora() {
    let W, H, bg, curtains = [];
    const ribbons = [
      { col: '#36f5b0', base: .30, amp: .07, f: 1.6, s: .18, h: .30, ph: 0 },
      { col: '#2bd2ff', base: .40, amp: .06, f: 2.3, s: -.13, h: .22, ph: 2 },
      { col: '#a35cff', base: .22, amp: .05, f: 1.1, s: .09, h: .26, ph: 4 },
    ];
    return {
      resize(w, h) {
        W = w; H = h;
        bg = document.createElement('canvas'); bg.width = w; bg.height = h;
        const g = bg.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#020611'); gr.addColorStop(.6, '#061428'); gr.addColorStop(1, '#0a1f2e');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < Math.min(160, w * h / 12000); i++) {
          g.fillStyle = `rgba(255,255,255,${rnd(.15, .7)})`; const r = rnd(.3, 1.1) * View.dpr;
          g.beginPath(); g.arc(Math.random() * w, Math.random() * h * .8, r, 0, 6.28); g.fill();
        }
        // one vertical light-curtain sprite per ribbon, stretched per column
        curtains = ribbons.map(rb => {
          const c = document.createElement('canvas'); c.width = 4; c.height = 256;
          const g2 = c.getContext('2d'); const gr2 = g2.createLinearGradient(0, 0, 0, 256);
          gr2.addColorStop(0, rgba(rb.col, 0)); gr2.addColorStop(.25, rgba(rb.col, .55));
          gr2.addColorStop(.5, rgba(rb.col, .25)); gr2.addColorStop(1, rgba(rb.col, 0));
          g2.fillStyle = gr2; g2.fillRect(0, 0, 4, 256); return c;
        });
      },
      frame(t, dt, speed) {
        const c = View.ctx; c.drawImage(bg, 0, 0);
        c.globalCompositeOperation = 'lighter';
        const step = 5 * View.dpr, tt = t * speed;
        ribbons.forEach((rb, i) => {
          for (let x = 0; x < W; x += step) {
            const u = x / W;
            const y = H * (rb.base + rb.amp * Math.sin(u * rb.f * 6.28 + tt * rb.s * 6.28 + rb.ph) + rb.amp * .5 * Math.sin(u * 9 - tt * .7 + rb.ph));
            const hh = H * rb.h * (.75 + .25 * Math.sin(u * 13 + tt * 1.3 + rb.ph));
            c.globalAlpha = .2 + .22 * (0.5 + 0.5 * Math.sin(u * 21 + tt * 2.1 + i));
            c.drawImage(curtains[i], x - step * .5, y - hh * .25, step * 2, hh);
          }
        });
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      },
    };
  }

  function Rain() {
    let W, H, bg, streaks = [], drops = [], dropSprite;
    const newDrop = (anywhere) => ({ x: Math.random() * W, y: anywhere ? Math.random() * H : -20, r: rnd(2, 7) * View.dpr, vy: 0, wait: rnd(0, 4) });
    return {
      resize(w, h) {
        W = w; H = h;
        bg = document.createElement('canvas'); bg.width = w; bg.height = h;
        const g = bg.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#050b1a'); gr.addColorStop(.7, '#13305a'); gr.addColorStop(1, '#22385e');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        // blurred city lights behind the glass
        const cols = ['#ffb86b', '#6bc8ff', '#ff7aa8', '#fff1a8', '#7affd1'];
        for (let i = 0; i < 26; i++) {
          const x = Math.random() * w, y = h * rnd(.45, 1), r = rnd(20, 70) * View.dpr;
          const rg = g.createRadialGradient(x, y, 0, x, y, r); const col = cols[i % cols.length];
          rg.addColorStop(0, rgba(col, rnd(.12, .3))); rg.addColorStop(1, rgba(col, 0));
          g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        dropSprite = sprite(64, [[0, 'rgba(255,255,255,.05)'], [.55, 'rgba(180,210,255,.12)'], [.8, 'rgba(255,255,255,.45)'], [.9, 'rgba(10,20,40,.35)'], [1, 'rgba(10,20,40,0)']]);
        streaks = Array.from({ length: Math.min(140, w / (3 * View.dpr)) }, () => ({ x: Math.random() * w, y: Math.random() * h, l: rnd(10, 26) * View.dpr, v: rnd(700, 1100) * View.dpr, a: rnd(.08, .25) }));
        drops = Array.from({ length: 46 }, () => newDrop(true));
      },
      frame(t, dt, speed) {
        const c = View.ctx; c.drawImage(bg, 0, 0);
        c.strokeStyle = '#cfe3ff'; c.lineWidth = View.dpr;
        for (const s of streaks) {
          s.y += s.v * dt * speed; s.x -= s.v * .08 * dt * speed;
          if (s.y > H) { s.y = -s.l; s.x = Math.random() * W * 1.1; }
          c.globalAlpha = s.a; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.l * .08, s.y + s.l); c.stroke();
        }
        c.globalAlpha = 1;
        for (const d of drops) {
          if (d.wait > 0) d.wait -= dt * speed;
          else { d.vy = Math.min(d.vy + 60 * View.dpr * dt, (40 + d.r * 18)); d.y += d.vy * dt * speed; if (Math.random() < .01) { d.wait = rnd(.3, 2); d.vy = 0; } }
          if (d.y - d.r * 3 > H) Object.assign(d, newDrop(false));
          const sz = d.r * 2.6;
          if (d.vy > 0) { c.globalAlpha = .18; c.drawImage(dropSprite, d.x - sz * .25, d.y - sz * 1.6, sz * .5, sz * 1.4); c.globalAlpha = 1; }
          c.drawImage(dropSprite, d.x - sz / 2, d.y - sz / 2, sz, sz * 1.1);
        }
      },
    };
  }

  function Lava() {
    let W, H, low, lg, bg;
    const cols = ['#ff5f3c', '#ff9a3c', '#ff3c7a', '#ffcf5c', '#ff6a2a', '#e8366b', '#ffb347'];
    const blobs = cols.map((col, i) => ({ col, fx: rnd(.04, .09), fy: rnd(.03, .07), ph: i * 1.7, r: rnd(.16, .3) }));
    return {
      resize(w, h) {
        W = w; H = h;
        low = document.createElement('canvas'); low.width = Math.max(40, Math.round(w / 8)); low.height = Math.max(60, Math.round(h / 8));
        lg = low.getContext('2d');
        bg = lg.createLinearGradient(0, 0, 0, low.height); bg.addColorStop(0, '#12040a'); bg.addColorStop(1, '#2a0816');
      },
      frame(t, dt, speed) {
        const lw = low.width, lh = low.height, tt = t * speed, m = Math.min(lw, lh);
        lg.globalCompositeOperation = 'source-over'; lg.fillStyle = bg; lg.fillRect(0, 0, lw, lh);
        lg.globalCompositeOperation = 'lighter';
        for (const b of blobs) {
          const x = lw * (.5 + .38 * Math.sin(tt * b.fx * 6.28 + b.ph));
          const y = lh * (.5 + .42 * Math.sin(tt * b.fy * 6.28 + b.ph * 1.3));
          const r = m * b.r * (1 + .12 * Math.sin(tt * .8 + b.ph)) * 1.6;
          const g = lg.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, rgba(b.col, .85)); g.addColorStop(.45, rgba(b.col, .35)); g.addColorStop(1, rgba(b.col, 0));
          lg.fillStyle = g; lg.fillRect(x - r, y - r, r * 2, r * 2);
        }
        const c = View.ctx; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(low, 0, 0, W, H);
      },
    };
  }

  /* ---------------- engine ---------------- */

  const View = { ctx: null, canvas: null, dpr: 1 };
  let renderer = null, current = { id: 'starry', scheme: 'Base' }, motion = 'full', last = 0, clock = 0, raf = 0, dirty = true;

  function resize() {
    if (!View.canvas) return;
    View.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * View.dpr), h = Math.round(innerHeight * View.dpr);
    View.canvas.width = w; View.canvas.height = h;
    renderer && renderer.resize(w, h); dirty = true;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (document.hidden || !renderer) return;
    const speed = motion === 'off' ? 0 : motion === 'calm' ? .45 : 1;
    if (speed === 0 && !dirty) return;
    clock += dt * (speed || 1);
    renderer.frame(clock, speed ? dt : 0, speed); dirty = false;
  }

  function colorsFor(id, scheme) {
    if (id === 'starry') return STARRY[scheme] || STARRY.Base;
    return THEMES[id].colors;
  }

  function applyTokens(col) {
    const r = document.documentElement.style;
    r.setProperty('--accent', col.accent);
    r.setProperty('--accent-ink', luminance(col.accent) > .5 ? '#000000' : '#ffffff');
    r.setProperty('--text', col.text);
    r.setProperty('--sub', col.sub);
    r.setProperty('--card', rgba(col.card, .55));
    r.setProperty('--card-solid', col.card);
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = col.top || col.card;
  }

  window.Themes = {
    STARRY, THEMES,
    start(canvas) {
      View.canvas = canvas; View.ctx = canvas.getContext('2d', { alpha: false });
      addEventListener('resize', resize);
      document.addEventListener('visibilitychange', () => { last = 0; dirty = true; });
      resize(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    },
    apply(id, scheme) {
      if (!THEMES[id]) id = 'starry';
      if (id === 'starry' && !STARRY[scheme]) scheme = 'Base';
      current = { id, scheme };
      const col = colorsFor(id, scheme);
      applyTokens(col);
      renderer = id === 'starry' ? Starry(col) : id === 'aurora' ? Aurora() : id === 'rain' ? Rain() : Lava();
      resize();
    },
    setMotion(m) { motion = m; dirty = true; },
    get current() { return current; },
    get motion() { return motion; },
    previewFor(id, scheme) { return id === 'starry' ? THEMES.starry.preview(STARRY[scheme] || STARRY.Base) : THEMES[id].preview(); },
  };
})();
