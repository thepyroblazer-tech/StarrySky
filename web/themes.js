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
    fireflies: { name: 'Fireflies', sub: 'Summer night glow', colors: { accent: '#E8FF8A', card: '#0d2418', text: '#ffffff', sub: '#a8c4b0' },
              preview: () => 'radial-gradient(circle at 28% 40%, rgba(232,255,138,.95) 0 2px, rgba(232,255,138,.25) 3px, transparent 9px), radial-gradient(circle at 70% 62%, rgba(232,255,138,.9) 0 2px, rgba(232,255,138,.2) 3px, transparent 8px), radial-gradient(circle at 52% 28%, rgba(232,255,138,.7) 0 1px, transparent 6px), linear-gradient(180deg, #02060a, #0b2a1c)' },
    snow:   { name: 'Snowfall', sub: 'Quiet winter night', colors: { accent: '#DCEBFF', card: '#1a2a40', text: '#ffffff', sub: '#a9b9cf' },
              preview: () => 'radial-gradient(circle at 20% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 62% 48%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 82% 22%, #fff 0 2px, transparent 3px), radial-gradient(circle at 40% 70%, #fff 0 1.5px, transparent 2.5px), linear-gradient(180deg, #0b1220, #2b3d5a 80%, #c9d6e8)' },
    cover:  { name: 'Album glow', sub: 'Colours from the song', preview: () => `radial-gradient(circle at 30% 35%, ${coverPalette[0]}, transparent 60%), radial-gradient(circle at 75% 70%, ${coverPalette[1]}, transparent 60%), ${mix(coverPalette[2], '#000000', .7)}` },
  };

  const DEFAULT_PALETTE = ['#6b5cff', '#ff5fa2', '#2bd2ff', '#ffd36b'];
  let coverPalette = DEFAULT_PALETTE.slice();
  let artworkUrl = '';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };
  const luminance = h => { const [r, g, b] = hexToRgb(h).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function mix(a, b, t) { const x = hexToRgb(a), y = hexToRgb(b); return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }

  /** Picks up to 4 vivid, distinct colours from an image. Throws if the image can't be read (cross-origin). */
  function extractPalette(img) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data, buckets = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0, lum = (mx + mn) / 510;
      if (lum < .08 || lum > .95) continue;
      const key = (r >> 5) << 6 | (gg >> 5) << 3 | (b >> 5);
      const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, w: 0 };
      e.r += r; e.g += gg; e.b += b; e.n++; e.w += .25 + sat * sat; buckets.set(key, e);
    }
    const ranked = [...buckets.values()].sort((a, b) => b.w - a.w).map(e => [e.r / e.n, e.g / e.n, e.b / e.n]);
    const out = [];
    for (const c2 of ranked) {
      if (out.every(o => Math.hypot(o[0] - c2[0], o[1] - c2[1], o[2] - c2[2]) > 60)) out.push(c2);
      if (out.length === 4) break;
    }
    while (out.length < 4) out.push(hexToRgb(DEFAULT_PALETTE[out.length]));
    return out.map(c3 => toHex(c3[0], c3[1], c3[2]));
  }
  function paletteColors(p) {
    let accent = p.slice().sort((a, b) => { const s = h => { const [r, g, bb] = hexToRgb(h); const mx = Math.max(r, g, bb); return mx ? (mx - Math.min(r, g, bb)) / mx : 0; }; return s(b) - s(a); })[0];
    while (luminance(accent) < .5) accent = mix(accent, '#ffffff', .25);
    return { accent, card: mix(p[0], '#000000', .72), text: '#ffffff', sub: mix(accent, '#ffffff', .6), top: mix(p[0], '#000000', .8) };
  }

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

  function Fireflies() {
    let W, H, bg, glow, flies = [];
    return {
      resize(w, h) {
        W = w; H = h; const k = View.dpr;
        bg = document.createElement('canvas'); bg.width = w; bg.height = h;
        const g = bg.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#02060a'); gr.addColorStop(.55, '#071a12'); gr.addColorStop(1, '#0b2a1c');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < Math.min(90, w * h / 20000); i++) {
          g.fillStyle = `rgba(255,255,255,${rnd(.1, .5)})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h * .45, rnd(.3, .9) * k, 0, 6.28); g.fill();
        }
        // dark meadow with grass blades
        g.fillStyle = '#020805'; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 20 * k) g.lineTo(x, h * .86 + Math.sin(x / (90 * k)) * 14 * k + Math.sin(x / (37 * k)) * 6 * k);
        g.lineTo(w, h); g.closePath(); g.fill();
        g.strokeStyle = '#020805'; g.lineWidth = 1.6 * k;
        for (let i = 0; i < w / (3 * k); i++) {
          const x = Math.random() * w, base = h * .87 + Math.sin(x / (90 * k)) * 14 * k, len = rnd(14, 46) * k;
          g.beginPath(); g.moveTo(x, base + 6 * k); g.quadraticCurveTo(x + rnd(-6, 6) * k, base - len * .5, x + rnd(-12, 12) * k, base - len); g.stroke();
        }
        glow = sprite(64, [[0, 'rgba(250,255,200,1)'], [.08, 'rgba(232,255,138,1)'], [.25, 'rgba(200,255,90,.35)'], [1, 'rgba(160,255,60,0)']]);
        const n = Math.min(70, Math.round(w * h / (9000 * k * k)));
        flies = Array.from({ length: n }, () => ({ x: Math.random() * w, y: h * rnd(.2, .95), a: Math.random() * 6.28, v: rnd(12, 30) * k, ph: Math.random() * 6.28, sp: rnd(.5, 1.3), s: rnd(.7, 1.3) }));
      },
      frame(t, dt, speed) {
        const c = View.ctx; c.drawImage(bg, 0, 0); c.globalCompositeOperation = 'lighter';
        for (const f of flies) {
          f.a += Math.sin(t * .7 + f.ph) * 1.2 * dt * speed;
          f.x += Math.cos(f.a) * f.v * dt * speed; f.y += Math.sin(f.a) * f.v * .6 * dt * speed;
          if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
          if (f.y < H * .15) f.a = Math.abs(f.a); if (f.y > H * .97) f.a = -Math.abs(f.a);
          const pulse = Math.pow(Math.max(0, Math.sin(t * f.sp + f.ph)), 3);
          c.globalAlpha = .12 + .88 * pulse; const d = (16 + 26 * pulse) * f.s * View.dpr;
          c.drawImage(glow, f.x - d / 2, f.y - d / 2, d, d);
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      },
    };
  }

  function Snow() {
    let W, H, bg, bank, flake, flakes = [];
    return {
      resize(w, h) {
        W = w; H = h; const k = View.dpr;
        bg = document.createElement('canvas'); bg.width = w; bg.height = h;
        const g = bg.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#0b1220'); gr.addColorStop(.6, '#1b2b44'); gr.addColorStop(1, '#2b3d5a');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        const mx = w * .78, my = h * .12, mr = 160 * k, mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
        mg.addColorStop(0, 'rgba(235,242,255,.9)'); mg.addColorStop(.12, 'rgba(235,242,255,.75)'); mg.addColorStop(.14, 'rgba(200,215,240,.18)'); mg.addColorStop(1, 'rgba(200,215,240,0)');
        g.fillStyle = mg; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
        bank = document.createElement('canvas'); bank.width = w; bank.height = h;
        const b = bank.getContext('2d'); b.beginPath(); b.moveTo(0, h);
        for (let x = 0; x <= w; x += 16 * k) b.lineTo(x, h * .9 + Math.sin(x / (120 * k)) * 12 * k + Math.sin(x / (45 * k)) * 4 * k);
        b.lineTo(w, h); b.closePath();
        const bgr = b.createLinearGradient(0, h * .86, 0, h); bgr.addColorStop(0, '#e8f0fb'); bgr.addColorStop(1, '#9fb2cc');
        b.fillStyle = bgr; b.fill();
        flake = sprite(32, [[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]);
        const n = Math.min(240, Math.round(w * h / (4500 * k * k)));
        flakes = Array.from({ length: n }, () => {
          const layer = Math.random(); // 0 = far, 1 = near
          return { x: Math.random() * w, y: Math.random() * h, r: (.6 + layer * 2.8) * k, v: (18 + layer * 70) * k, a: .35 + layer * .6, ph: Math.random() * 6.28, sw: rnd(.4, 1.2), amp: (6 + layer * 18) * k };
        });
      },
      frame(t, dt, speed) {
        const c = View.ctx; c.drawImage(bg, 0, 0);
        const wind = (12 * Math.sin(t * .11) + 8 * Math.sin(t * .37)) * View.dpr;
        for (const f of flakes) {
          f.y += f.v * dt * speed; f.x += (wind * (f.r / View.dpr) * .4 + Math.cos(t * f.sw + f.ph) * f.amp * .6) * dt * speed;
          if (f.y > H + 10) { f.y = -10; f.x = Math.random() * W; }
          if (f.x > W + 10) f.x = -10; if (f.x < -10) f.x = W + 10;
          c.globalAlpha = f.a; const d = f.r * 4; c.drawImage(flake, f.x - d / 2, f.y - d / 2, d, d);
        }
        c.globalAlpha = 1; c.drawImage(bank, 0, 0);
      },
    };
  }

  /** Album glow: the cover art, hugely blurred, with drifting blobs in its own colours. */
  function Cover() {
    let W, H, low, lg, art = null, oldArt = null, fade = 1, motes = [], mote;
    let pal = coverPalette.slice();
    const blobs = [0, 1, 2, 3, 0, 1].map((ci, i) => ({ ci, fx: rnd(.03, .07), fy: rnd(.025, .06), ph: i * 1.9, r: rnd(.2, .34) }));
    function blurred(img) {
      const c = document.createElement('canvas'); c.width = c.height = 12;
      const g = c.getContext('2d'); try { g.drawImage(img, 0, 0, 12, 12); } catch (e) { return null; }
      return c;
    }
    return {
      resize(w, h) {
        W = w; H = h;
        low = document.createElement('canvas'); low.width = Math.max(40, Math.round(w / 8)); low.height = Math.max(60, Math.round(h / 8));
        lg = low.getContext('2d');
        mote = sprite(32, [[0, 'rgba(255,255,255,.9)'], [.3, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]);
        motes = Array.from({ length: 40 }, () => ({ x: Math.random() * w, y: Math.random() * h, v: rnd(6, 18) * View.dpr, s: rnd(.5, 1.4), ph: Math.random() * 6.28 }));
      },
      setArt(img, palette) { oldArt = art; art = img ? blurred(img) : null; fade = 0; pal = palette; },
      frame(t, dt, speed) {
        const lw = low.width, lh = low.height, tt = t * speed, m = Math.min(lw, lh);
        fade = Math.min(1, fade + dt * .8 + (speed ? 0 : 1));
        lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1;
        lg.fillStyle = mix(pal[0], '#000000', .82); lg.fillRect(0, 0, lw, lh);
        // cover art stretched to fill (aspect-crop), cross-fading from the previous song
        const drawArt = (a, alpha) => { if (!a) return; lg.globalAlpha = alpha; const sz = Math.max(lw, lh) * 1.2; lg.drawImage(a, (lw - sz) / 2, (lh - sz) / 2, sz, sz); };
        drawArt(oldArt, .55 * (1 - fade)); drawArt(art, .55 * fade);
        lg.globalAlpha = 1; lg.globalCompositeOperation = 'lighter';
        for (const b of blobs) {
          const x = lw * (.5 + .4 * Math.sin(tt * b.fx * 6.28 + b.ph)), y = lh * (.5 + .42 * Math.sin(tt * b.fy * 6.28 + b.ph * 1.3));
          const r = m * b.r * 1.7, g = lg.createRadialGradient(x, y, 0, x, y, r), col = pal[b.ci];
          g.addColorStop(0, rgba(col, .45)); g.addColorStop(1, rgba(col, 0)); lg.fillStyle = g; lg.fillRect(x - r, y - r, r * 2, r * 2);
        }
        lg.globalCompositeOperation = 'source-over';
        // darken a little so text stays readable
        lg.fillStyle = 'rgba(0,0,0,.28)'; lg.fillRect(0, 0, lw, lh);
        const c = View.ctx; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(low, 0, 0, W, H);
        c.globalCompositeOperation = 'lighter';
        for (const p of motes) {
          p.y -= p.v * dt * speed; p.x += Math.sin(tt * .5 + p.ph) * 6 * dt * speed;
          if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
          c.globalAlpha = .25 + .25 * Math.sin(tt * 1.3 + p.ph); const d = 10 * p.s * View.dpr; c.drawImage(mote, p.x - d / 2, p.y - d / 2, d, d);
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      },
    };
  }

  let artSeq = 0;
  function loadArtwork(url) {
    const seq = ++artSeq;
    if (!url) { coverArtReady(null, DEFAULT_PALETTE.slice(), seq); return; }
    const tryLoad = cors => {
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';
      img.onload = () => {
        let p = DEFAULT_PALETTE.slice();
        try { p = extractPalette(img); } catch (e) { /* cross-origin image: keep default colours */ }
        coverArtReady(img, p, seq);
      };
      img.onerror = () => { if (cors) tryLoad(false); else coverArtReady(null, DEFAULT_PALETTE.slice(), seq); };
      img.src = url;
    };
    tryLoad(!url.startsWith('data:'));
  }
  function coverArtReady(img, palette, seq) {
    if (seq !== artSeq) return;
    coverPalette = palette;
    if (current.id === 'cover' && renderer && renderer.setArt) {
      renderer.setArt(img, palette); applyTokens(paletteColors(palette)); dirty = true;
      if (window.onThemeColors) window.onThemeColors();
    }
    lastArtImg = img;
  }
  let lastArtImg = null;

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
    if (id === 'cover') return paletteColors(coverPalette);
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
      const make = { starry: () => Starry(col), aurora: Aurora, rain: Rain, lava: Lava, fireflies: Fireflies, snow: Snow, cover: Cover }[id];
      renderer = make();
      resize();
      if (id === 'cover') renderer.setArt(lastArtImg, coverPalette);
    },
    /** Tell the themes which album cover is showing (used by Album glow). */
    setArtwork(url) {
      if (url === artworkUrl) return;
      artworkUrl = url; loadArtwork(url);
    },
    setMotion(m) { motion = m; dirty = true; },
    get current() { return current; },
    get motion() { return motion; },
    previewFor(id, scheme) { return id === 'starry' ? THEMES.starry.preview(STARRY[scheme] || STARRY.Base) : THEMES[id].preview(); },
    accentHex() { return colorsFor(current.id, current.scheme).accent; },
    cardHex() { return colorsFor(current.id, current.scheme).card; },
  };
})();
