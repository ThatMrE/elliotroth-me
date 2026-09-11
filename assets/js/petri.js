/* petri.js — Gray-Scott reaction-diffusion running in the hero.
   It is a real simulation: two chemicals, U and V, diffusing and reacting.
   Seeded like a four-quadrant streak plate. Drag to inoculate. */
(function (global) {
  'use strict';

  var canvas, ctx, img, data32, buf;
  var W = 0, H = 0;                 // simulation grid
  var A, B, A2, B2, C, C2;          // U, V and a "contaminant" marker field
  var lutR = new Uint8Array(256), lutG = new Uint8Array(256), lutB = new Uint8Array(256);
  var lutCR = new Uint8Array(256), lutCG = new Uint8Array(256), lutCB = new Uint8Array(256);
  var running = false, raf = null, reduced = false, contaminated = false;
  var params = { f: 0.0545, k: 0.0620, dA: 1.0, dB: 0.5, dt: 1.0, steps: 6 };
  var pointer = { down: false, x: 0, y: 0 };

  function clampInt(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v | 0; }

  function allocate(w, h) {
    W = w; H = h;
    var n = W * H;
    A = new Float32Array(n); B = new Float32Array(n);
    A2 = new Float32Array(n); B2 = new Float32Array(n);
    C = new Float32Array(n); C2 = new Float32Array(n);
    for (var i = 0; i < n; i++) { A[i] = 1; B[i] = 0; }
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    buf = new ArrayBuffer(img.data.length);
    data32 = new Uint32Array(buf);
  }

  function blob(cx, cy, r, amount, contam) {
    var r2 = r * r;
    for (var y = -r; y <= r; y++) {
      for (var x = -r; x <= r; x++) {
        if (x * x + y * y > r2) continue;
        var px = ((cx + x) % W + W) % W, py = ((cy + y) % H + H) % H;
        var i = py * W + px;
        B[i] = Math.min(1, B[i] + amount);
        A[i] = Math.max(0, A[i] - amount * 0.5);
        if (contam) C[i] = 1;
      }
    }
  }

  /* Four-quadrant streak plate: dense first streak, progressively diluted. */
  function seedStreakPlate() {
    var quad = 4, i, q;
    for (q = 0; q < quad; q++) {
      var count = Math.max(3, Math.round(26 / (q + 1)));
      var baseAngle = (q / quad) * Math.PI * 2 + 0.4;
      for (i = 0; i < count; i++) {
        var t = i / count;
        var ang = baseAngle + t * 1.15;
        var rad = (0.16 + 0.3 * t) * Math.min(W, H);
        var cx = Math.round(W / 2 + Math.cos(ang) * rad * 1.55);
        var cy = Math.round(H / 2 + Math.sin(ang) * rad);
        blob(cx, cy, 2 + Math.round(Math.random() * 2), 0.9, false);
      }
    }
    for (i = 0; i < 12; i++) {
      blob(Math.round(Math.random() * W), Math.round(Math.random() * H), 2, 0.75, false);
    }
  }

  function parseColor(str, fallback) {
    var m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(str || '');
    if (m) return [+m[1], +m[2], +m[3]];
    m = /^#([0-9a-f]{6})$/i.exec((str || '').trim());
    if (m) { var v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
    return fallback;
  }

  function ramp(lr, lg, lb, lo, mid, hi) {
    for (var i = 0; i < 256; i++) {
      var t = i / 255, r, g, b;
      if (t < 0.55) {
        var u = t / 0.55;
        r = lo[0] + (mid[0] - lo[0]) * u; g = lo[1] + (mid[1] - lo[1]) * u; b = lo[2] + (mid[2] - lo[2]) * u;
      } else {
        var v = (t - 0.55) / 0.45;
        r = mid[0] + (hi[0] - mid[0]) * v; g = mid[1] + (hi[1] - mid[1]) * v; b = mid[2] + (hi[2] - mid[2]) * v;
      }
      lr[i] = r | 0; lg[i] = g | 0; lb[i] = b | 0;
    }
  }

  function buildPalette() {
    var cs = getComputedStyle(document.documentElement);
    var bg = parseColor(cs.getPropertyValue('--bg'), [5, 16, 13]);
    var acc = parseColor(cs.getPropertyValue('--algae'), [61, 239, 164]);
    var dim = parseColor(cs.getPropertyValue('--algae-dim'), [31, 169, 116]);
    var cher = parseColor(cs.getPropertyValue('--cherry'), [255, 95, 162]);
    ramp(lutR, lutG, lutB, bg, [dim[0] * 0.55 | 0, dim[1] * 0.55 | 0, dim[2] * 0.55 | 0], acc);
    ramp(lutCR, lutCG, lutCB, bg, [cher[0] * 0.4 | 0, cher[1] * 0.4 | 0, cher[2] * 0.4 | 0], cher);
  }

  function step() {
    var f = params.f, k = params.k, dA = params.dA, dB = params.dB, dt = params.dt;
    var x, y, i, up, dn, lf, rt;
    for (y = 0; y < H; y++) {
      var yUp = (y === 0 ? H - 1 : y - 1) * W;
      var yDn = (y === H - 1 ? 0 : y + 1) * W;
      var yc = y * W;
      for (x = 0; x < W; x++) {
        i = yc + x;
        lf = yc + (x === 0 ? W - 1 : x - 1);
        rt = yc + (x === W - 1 ? 0 : x + 1);
        up = yUp + x; dn = yDn + x;
        var a = A[i], b = B[i];
        var lapA = (A[lf] + A[rt] + A[up] + A[dn]) * 0.2
                 + (A[yUp + (x === 0 ? W - 1 : x - 1)] + A[yUp + (x === W - 1 ? 0 : x + 1)]
                  + A[yDn + (x === 0 ? W - 1 : x - 1)] + A[yDn + (x === W - 1 ? 0 : x + 1)]) * 0.05
                 - a;
        var lapB = (B[lf] + B[rt] + B[up] + B[dn]) * 0.2
                 + (B[yUp + (x === 0 ? W - 1 : x - 1)] + B[yUp + (x === W - 1 ? 0 : x + 1)]
                  + B[yDn + (x === 0 ? W - 1 : x - 1)] + B[yDn + (x === W - 1 ? 0 : x + 1)]) * 0.05
                 - b;
        var abb = a * b * b;
        var na = a + (dA * lapA - abb + f * (1 - a)) * dt;
        var nb = b + (dB * lapB + abb - (k + f) * b) * dt;
        A2[i] = na < 0 ? 0 : na > 1 ? 1 : na;
        B2[i] = nb < 0 ? 0 : nb > 1 ? 1 : nb;
        if (contaminated) {
          var lc = (C[lf] + C[rt] + C[up] + C[dn]) * 0.25 - C[i];
          var nc = C[i] + lc * 0.16;
          C2[i] = nc < 0 ? 0 : nc > 1 ? 1 : nc;
        } else {
          C2[i] = C[i] * 0.96;
        }
      }
    }
    var t;
    t = A; A = A2; A2 = t;
    t = B; B = B2; B2 = t;
    t = C; C = C2; C2 = t;
  }

  function draw() {
    var n = W * H, i, v, idx, c;
    for (i = 0; i < n; i++) {
      v = B[i] * 3.2; if (v > 1) v = 1;
      idx = (v * 255) | 0;
      c = C[i];
      var r, g, b;
      if (c > 0.02) {
        r = lutR[idx] + (lutCR[idx] - lutR[idx]) * c;
        g = lutG[idx] + (lutCG[idx] - lutG[idx]) * c;
        b = lutB[idx] + (lutCB[idx] - lutB[idx]) * c;
      } else { r = lutR[idx]; g = lutG[idx]; b = lutB[idx]; }
      data32[i] = (255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
    }
    img.data.set(new Uint8ClampedArray(buf));
    ctx.putImageData(img, 0, 0);
  }

  function frame() {
    if (!running) return;
    for (var s = 0; s < params.steps; s++) step();
    if (pointer.down) blob(pointer.x, pointer.y, 3, 0.6, contaminated);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function toGrid(e) {
    var r = canvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    pointer.x = clampInt(cx / r.width * W, 0, W - 1);
    pointer.y = clampInt(cy / r.height * H, 0, H - 1);
  }

  function bindPointer() {
    var host = canvas.parentElement || canvas;
    host.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('a,button,kbd')) return;
      pointer.down = true; toGrid(e); blob(pointer.x, pointer.y, 4, 0.9, contaminated);
      if (global.Culture) global.Culture.feed(0.012, 'inoculate');
      if (!running && !reduced) api.resume();
    });
    window.addEventListener('pointermove', function (e) { if (pointer.down) toGrid(e); });
    window.addEventListener('pointerup', function () { pointer.down = false; });
    window.addEventListener('pointercancel', function () { pointer.down = false; });
  }

  var api = {
    init: function (el) {
      canvas = el;
      if (!canvas || !canvas.getContext) return false;
      ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return false;
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      var rect = canvas.getBoundingClientRect();
      var aspect = (rect.height || 700) / (rect.width || 1200);
      var w = clampInt(window.innerWidth < 700 ? 120 : 180, 80, 200);
      var h = clampInt(w * aspect, 60, 220);
      allocate(w, h);
      buildPalette();
      seedStreakPlate();
      bindPointer();

      if (reduced) {
        for (var i = 0; i < 900; i++) step();
        draw();
      } else {
        running = true;
        raf = requestAnimationFrame(frame);
      }
      return true;
    },
    pause: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = null; },
    resume: function () { if (running || reduced) return; running = true; raf = requestAnimationFrame(frame); },
    isRunning: function () { return running; },
    repalette: function () { buildPalette(); if (!running) draw(); },
    /* Density shifts the feed/kill point: sparse spots -> dense coral -> mitosis. */
    setDensity: function (od) {
      var t = Math.min(1, Math.max(0, od / 1.6));
      params.f = 0.0300 + 0.0280 * t;
      params.k = 0.0590 + 0.0070 * t;
    },
    contaminate: function (on) {
      contaminated = !!on;
      if (on) {
        for (var i = 0; i < 6; i++) {
          blob(Math.round(Math.random() * W), Math.round(Math.random() * H), 3, 1, true);
        }
      }
    },
    splash: function (n) {
      for (var i = 0; i < (n || 8); i++) {
        blob(Math.round(Math.random() * W), Math.round(Math.random() * H), 3, 0.9, contaminated);
      }
      if (!running && !reduced) api.resume();
    },
    reseed: function () {
      var n = W * H;
      for (var i = 0; i < n; i++) { A[i] = 1; B[i] = 0; C[i] = 0; }
      seedStreakPlate();
      if (!running) { for (var s = 0; s < 400; s++) step(); draw(); }
    }
  };

  global.Petri = api;
})(window);
