/* culture.js — the site is a culture you are growing.
   Every interaction feeds it. Density changes how the page looks and what
   it will let you play with. It never hides content: OD gates toys, not text. */
(function (global) {
  'use strict';

  var KEY = 'elliotroth.culture.v1';
  var state = { od: 0.02, passage: 1, moon: false, contaminated: false, seen: {}, fed: 0 };
  var els = {};
  var listeners = [];

  var PHASES = [
    { at: 0.00, name: 'lag phase' },
    { at: 0.12, name: 'early log' },
    { at: 0.35, name: 'log phase' },
    { at: 0.60, name: 'mid log' },
    { at: 0.95, name: 'late log' },
    { at: 1.30, name: 'stationary' },
    { at: 1.75, name: 'overgrown' }
  ];

  var UNLOCKS = [
    { at: 0.15, id: 'terminal',  note: 'bench terminal online — press / to open it' },
    { at: 0.60, id: 'moon',      note: 'moon mode available — lunar regolith palette' },
    { at: 1.20, id: 'contam',    note: 'stationary phase. the terminal will now accept `contaminate`, if you are curious' }
  ];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var v = JSON.parse(raw);
        if (v && typeof v.od === 'number' && isFinite(v.od)) {
          state.od = Math.min(2.2, Math.max(0.02, v.od));
          state.passage = Math.max(1, v.passage | 0 || 1);
          state.moon = !!v.moon;
          state.contaminated = !!v.contaminated;
          state.seen = v.seen && typeof v.seen === 'object' ? v.seen : {};
          state.fed = v.fed | 0;
        }
      }
    } catch (e) { /* private mode, blocked storage — fine, start fresh */ }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* no-op */ }
  }

  function phase() {
    var p = PHASES[0];
    for (var i = 0; i < PHASES.length; i++) if (state.od >= PHASES[i].at) p = PHASES[i];
    return p.name;
  }

  function paint() {
    if (els.value) els.value.textContent = state.od.toFixed(2);
    if (els.fill) els.fill.style.width = Math.min(100, (state.od / 2.0) * 100).toFixed(1) + '%';
    if (els.phase) els.phase.textContent = phase();
    var passEl = document.querySelector('[data-bind="passage"]');
    if (passEl) passEl.textContent = state.passage;

    var moonBtn = document.getElementById('btn-moon');
    if (moonBtn) {
      var unlocked = state.od >= 0.60;
      moonBtn.disabled = !unlocked;
      moonBtn.classList.toggle('is-locked', !unlocked);
      moonBtn.classList.toggle('is-on', state.moon);
      moonBtn.title = unlocked
        ? (state.moon ? 'Back to the wet lab' : 'Moon mode')
        : 'Locked until OD 0.60';
    }
    var termBtn = document.getElementById('btn-term');
    if (termBtn) termBtn.classList.toggle('is-ready', state.od >= 0.15 && state.od < 0.30);

    document.documentElement.dataset.mode = state.moon ? 'moon' : 'bench';
    document.documentElement.dataset.contaminated = state.contaminated ? 'true' : 'false';

    if (global.Petri) {
      global.Petri.setDensity(state.od);
      global.Petri.contaminate(state.contaminated);
    }
  }

  function announce(msg, tone) {
    if (global.Bench && global.Bench.print) global.Bench.print(msg, tone || 't-ok');
  }

  function checkUnlocks(before) {
    for (var i = 0; i < UNLOCKS.length; i++) {
      var u = UNLOCKS[i];
      if (before < u.at && state.od >= u.at) {
        /* Unlocks offer toys. They never redecorate the page uninvited —
           contamination is something you have to ask for. */
        announce('[' + u.at.toFixed(2) + ' OD] ' + u.note, u.id === 'contam' ? 't-warn' : 't-ok');
        toast(u.note);
      }
    }
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('culture-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'culture-toast';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:16px;bottom:128px;z-index:80;max-width:min(340px,calc(100vw - 32px));' +
        'font-family:var(--mono);font-size:.72rem;line-height:1.5;padding:.6rem .8rem;border-radius:8px;' +
        'border:1px solid var(--accent);background:color-mix(in srgb, var(--bg-2) 92%, transparent);' +
        'color:var(--accent);backdrop-filter:blur(10px);opacity:0;transition:opacity .35s,transform .35s;transform:translateY(8px)';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = 'none'; });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, 4200);
  }

  var api = {
    init: function () {
      load();
      els.value = document.getElementById('hud-value');
      els.fill = document.getElementById('hud-fill');
      els.phase = document.getElementById('hud-phase');
      paint();
      return state;
    },
    get: function () { return state; },
    od: function () { return state.od; },
    phase: phase,
    /* Feed the culture. `id` de-duplicates one-time events so scrolling twice
       through the same section does not farm density. */
    feed: function (amount, id) {
      if (id && id !== 'inoculate' && id !== 'feed') {
        if (state.seen[id]) return state.od;
        state.seen[id] = 1;
      }
      var before = state.od;
      state.od = Math.min(2.2, state.od + amount);
      state.fed++;
      checkUnlocks(before);
      paint(); save();
      for (var i = 0; i < listeners.length; i++) listeners[i](state);
      return state.od;
    },
    setMoon: function (on) {
      if (state.od < 0.60) return false;
      state.moon = !!on;
      paint(); save();
      if (global.Petri) global.Petri.repalette();
      return true;
    },
    toggleMoon: function () { return api.setMoon(!state.moon); },
    canContaminate: function () { return state.od >= 1.20; },
    setContaminated: function (on) {
      if (on && state.od < 1.20) return false;
      state.contaminated = !!on;
      paint(); save();
      if (global.Petri) { global.Petri.contaminate(state.contaminated); global.Petri.repalette(); }
      return true;
    },
    /* Passage the culture: dilute back into fresh medium, keep the count. */
    passage: function () {
      state.passage++;
      state.od = Math.max(0.02, state.od * 0.25);
      state.seen = {};
      state.contaminated = false;
      paint(); save();
      if (global.Petri) { global.Petri.reseed(); global.Petri.repalette(); }
      return state.passage;
    },
    reset: function () {
      state = { od: 0.02, passage: 1, moon: false, contaminated: false, seen: {}, fed: 0 };
      paint(); save();
      if (global.Petri) { global.Petri.reseed(); global.Petri.repalette(); }
    },
    onChange: function (fn) { listeners.push(fn); }
  };

  global.Culture = api;
})(window);
