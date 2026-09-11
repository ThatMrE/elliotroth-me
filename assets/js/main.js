/* main.js — wiring. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function buildRail() {
    var list = document.getElementById('rail-list');
    if (!list) return;
    var secs = Array.prototype.slice.call(document.querySelectorAll('main .sec'));
    list.innerHTML = secs.map(function (s) {
      var h = s.querySelector('h2');
      var label = h ? h.textContent.replace(/^\s*\d+\s*/, '').trim() : s.id;
      return '<li><a href="#' + s.id + '" data-sec="' + s.id + '"><span>' + label + '</span><i></i></a></li>';
    }).join('');
  }

  function observeSections() {
    var links = {};
    Array.prototype.forEach.call(document.querySelectorAll('.rail a'), function (a) {
      links[a.getAttribute('data-sec')] = a;
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
        if (links[id]) links[id].setAttribute('aria-current', 'true');
        if (window.Culture) window.Culture.feed(0.03, 'sec:' + id);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('main .sec'), function (s) { io.observe(s); });
  }

  function observeReveals() {
    if (reduced) {
      Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (n) { n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en, i) {
        if (!en.isIntersecting) return;
        setTimeout(function () { en.target.classList.add('is-in'); }, Math.min(i * 45, 300));
        obs.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (n) { io.observe(n); });
  }

  function wireHud() {
    var meter = document.getElementById('hud-meter');
    if (meter) {
      meter.addEventListener('click', function () {
        if (window.Culture) window.Culture.feed(0.04, 'feed');
        if (window.Petri) window.Petri.splash(5);
      });
    }
    var moon = document.getElementById('btn-moon');
    if (moon) {
      moon.addEventListener('click', function () {
        if (!window.Culture) return;
        window.Culture.toggleMoon();
      });
    }
    var motion = document.getElementById('btn-motion');
    if (motion) {
      motion.addEventListener('click', function () {
        if (!window.Petri) return;
        if (window.Petri.isRunning()) {
          window.Petri.pause();
          motion.textContent = '▶';
          motion.setAttribute('aria-pressed', 'true');
          motion.title = 'Resume the culture';
        } else {
          window.Petri.resume();
          motion.textContent = '❚❚';
          motion.setAttribute('aria-pressed', 'false');
          motion.title = 'Pause the culture';
        }
      });
      if (reduced) { motion.textContent = '▶'; motion.title = 'Resume the culture'; }
    }
  }

  function wireKonami() {
    var seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    var pos = 0;
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === seq[pos] || e.key.toLowerCase() === seq[pos]) {
        pos++;
        if (pos === seq.length) {
          pos = 0;
          if (window.Culture) window.Culture.feed(0.5, 'feed');
          if (window.Petri) window.Petri.splash(24);
          if (window.Bench) { window.Bench.open(); window.Bench.print('someone spiked the medium. OD ' + window.Culture.od().toFixed(2) + '.', 't-warn'); }
        }
      } else {
        pos = (e.key === seq[0]) ? 1 : 0;
      }
    });
  }

  function pauseWhenHidden() {
    document.addEventListener('visibilitychange', function () {
      if (!window.Petri) return;
      if (document.hidden) window.Petri.pause();
      else {
        var motion = document.getElementById('btn-motion');
        if (motion && motion.getAttribute('aria-pressed') !== 'true') window.Petri.resume();
      }
    });
    var hero = document.querySelector('.hero');
    if (!hero || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      if (!window.Petri) return;
      var motion = document.getElementById('btn-motion');
      var manuallyPaused = motion && motion.getAttribute('aria-pressed') === 'true';
      entries.forEach(function (en) {
        if (en.isIntersecting) { if (!manuallyPaused) window.Petri.resume(); }
        else window.Petri.pause();
      });
    }, { threshold: 0.02 }).observe(hero);
  }

  function start() {
    if (window.Culture) window.Culture.init();
    if (window.Petri) window.Petri.init(document.getElementById('dish'));
    if (window.Culture) {
      window.Culture.setMoon(window.Culture.get().moon);
      if (window.Petri) {
        window.Petri.setDensity(window.Culture.od());
        window.Petri.contaminate(window.Culture.get().contaminated);
        window.Petri.repalette();
      }
    }
    if (window.Bench) window.Bench.init();

    buildRail();
    wireHud();
    wireKonami();
    pauseWhenHidden();

    var boot = window.Render ? window.Render.boot() : Promise.resolve();
    boot.then(function () {
      observeSections();
      observeReveals();
      if (location.hash && location.hash.length > 1) {
        var t = document.querySelector(location.hash);
        if (t) t.scrollIntoView();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
