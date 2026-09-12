/* render.js — pulls /data/*.json and builds every section.
   The agent only ever edits the JSON; this file decides what it looks like. */
(function (global) {
  'use strict';

  var DATA = {};
  var FILES = ['profile', 'work', 'artifacts', 'workbench', 'press', 'awards', 'talks', 'teaching', 'writing', 'communities', 'changelog'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(u) {
    if (!u) return null;
    var s = String(u).trim();
    return /^https?:\/\//i.test(s) ? s : null;
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function monthYear(s) {
    if (!s) return '';
    var p = String(s).split('-');
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return p[1] ? M[(+p[1] - 1) % 12] + ' ' + p[0] : p[0];
  }
  function yearOf(s) { return s ? +String(s).split('-')[0] : null; }


  /* ---------- org marks ----------
     A real logo file, if one has been dropped into assets/logos/ and named in
     the role's "logo" field, is painted through a CSS mask so it comes out as a
     flat single-colour shape whatever the source artwork looks like. With no
     file, a monogram stands in — a designed placeholder, not a fake logo. */

  var MONO_SKIP = /^(inc|inc\.|llc|ltd|the|group|labs?|co|company|corp|and|&|\+)$/i;

  function monogram(name) {
    var words = String(name || '').split(/[\s+&]+/).filter(function (w) {
      return w && !MONO_SKIP.test(w.replace(/[^\w.]/g, ''));
    });
    if (!words.length) words = [String(name || '?')];
    /* One significant word gives one letter, which reads as a typo rather than
       a mark — take two from the word itself instead. */
    var letters = words.length === 1
      ? words[0].slice(0, 2)
      : words.slice(0, 2).map(function (w) { return w.charAt(0); }).join('');
    return letters.toUpperCase() || '?';
  }

  function orgMark(org, logo, extraClass) {
    var cls = 'mark' + (extraClass ? ' ' + extraClass : '');
    var url = logo && /^[\w./-]+$/.test(logo) ? logo : null;
    if (url) {
      return '<span class="' + cls + ' mark--img" role="img" aria-label="' + esc(org) + '" '
        + 'style="--mark-src:url(&quot;' + esc(url) + '&quot;)"></span>';
    }
    return '<span class="' + cls + ' mark--mono" aria-hidden="true">' + esc(monogram(org)) + '</span>';
  }

  /* ---------- hero + bio ---------- */

  function renderProfile() {
    var p = DATA.profile || {};
    var strap = document.querySelector('[data-bind="strapline"]');
    if (strap) strap.textContent = p.strapline || '';
    var obj = document.querySelector('[data-bind="objective"]');
    if (obj) obj.textContent = p.objective || '';
    var bio = document.querySelector('[data-bind="longBio"]');
    if (bio) bio.textContent = p.longBio || '';

    var linkHtml = (p.links || []).map(function (l) {
      var u = safeUrl(l.url);
      return u ? '<li><a href="' + esc(u) + '" rel="noopener">' + esc(l.label) + '</a></li>' : '';
    }).join('');
    if (p.email) linkHtml += '<li><a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a></li>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-bind="links"]'), function (n) { n.innerHTML = linkHtml; });

    var facts = document.querySelector('[data-bind="facts"]');
    if (facts) {
      var ed = (p.education || [])[0];
      var rows = [
        ['Based', p.location],
        ['Education', ed ? ed.degree + ', ' + ed.school + ' (' + ed.years + ')' : null],
        ['Also', ed ? ed.notes : null],
        ['Reach', p.email]
      ];
      facts.innerHTML = rows.filter(function (r) { return r[1]; }).map(function (r) {
        var val = r[0] === 'Reach'
          ? '<a href="mailto:' + esc(r[1]) + '">' + esc(r[1]) + '</a>'
          : esc(r[1]);
        return '<div><dt>' + esc(r[0]) + '</dt><dd>' + val + '</dd></div>';
      }).join('');
    }

    var gen = document.querySelector('[data-bind="genotype"]');
    if (gen) {
      gen.innerHTML = (p.genotype || []).map(function (g) {
        return '<span class="trait" data-class="' + esc(g.class) + '">' + esc(g.trait) + '</span>';
      }).join('');
    }
  }

  /* ---------- impact over time: a timeline you scrub ----------
     One series, so no legend — the axis title names it. Each role is a rounded
     bar spanning the years it ran, at the height it earned. The scrub reveals
     them left to right and pulls the experience it reaches into the panel. */

  function renderCurve() {
    var host = document.getElementById('curve');
    var roles = (DATA.work || []).slice().sort(function (a, b) {
      return String(a.start).localeCompare(String(b.start));
    });
    if (!host || !roles.length) return;

    var VW = 1000, VH = 330, PL = 52, PR = 26, PT = 36, PB = 42;
    /* A bare year means different things at each end of a span: "started 2016"
       is no earlier than that January, "ended 2016" is no later than that
       December. Treating both as January shortens a bar by up to a year. */
    function decimalYear(v, isEnd) {
      if (!v) return null;
      var q = String(v).split('-');
      if (q[1]) return +q[0] + (+q[1] - 1) / 12;
      return isEnd ? +q[0] + 11 / 12 : +q[0];
    }
    var now = new Date();
    var nowDec = now.getFullYear() + now.getMonth() / 12;
    var decs = roles.map(function (r) { return decimalYear(r.start); });
    var minY = Math.floor(Math.min.apply(null, decs));
    var maxY = Math.ceil(nowDec);
    var span = Math.max(1, maxY - minY);

    function X(y) { return PL + ((y - minY) / span) * (VW - PL - PR); }
    function Y(v) { return (VH - PB) - (Math.max(0, Math.min(100, v)) / 100) * (VH - PB - PT); }
    function yearAt(px) { return minY + ((px - PL) / (VW - PL - PR)) * span; }

    var bars = roles.map(function (r) {
      var x1 = X(decimalYear(r.start));
      var x2 = X(r.end ? decimalYear(r.end, true) : nowDec);
      return { r: r, x1: x1, x2: Math.max(x2, x1 + 9), y: Y(r.impact) };
    });

    var xTicks = [];
    for (var t = minY; t <= maxY; t += 2) xTicks.push(t);
    if (xTicks[xTicks.length - 1] !== maxY) xTicks.push(maxY);
    var yTicks = [0, 25, 50, 75, 100];

    host.innerHTML =
      '<svg viewBox="0 0 ' + VW + ' ' + VH + '" role="img" aria-label="Impact of each role over time, ' + minY + ' to ' + maxY + '">'
      + '<defs><clipPath id="revealClip"><rect id="revealRect" x="0" y="0" width="' + VW + '" height="' + VH + '"/></clipPath></defs>'
      + yTicks.map(function (v) {
          return '<line class="grid-line" x1="' + PL + '" y1="' + Y(v).toFixed(1) + '" x2="' + (VW - PR) + '" y2="' + Y(v).toFixed(1) + '"/>'
            + '<text class="axis-lab" x="' + (PL - 8) + '" y="' + (Y(v) + 3).toFixed(1) + '" text-anchor="end">' + v + '</text>';
        }).join('')
      + '<text class="axis-lab" x="' + PL + '" y="' + (PT - 8) + '">impact</text>'
      + xTicks.map(function (t) {
          return '<text class="axis-lab" x="' + X(t).toFixed(1) + '" y="' + (VH - PB + 16) + '" text-anchor="middle">' + t + '</text>';
        }).join('')
      + '<g clip-path="url(#revealClip)">'
      + bars.map(function (b) {
          return '<g class="bar' + (b.r.current ? ' is-current' : '') + '" tabindex="0" role="button" '
            + 'data-role="' + esc(b.r.id) + '" data-x="' + b.x1.toFixed(1) + '" '
            + 'aria-label="' + esc(b.r.org + ', ' + b.r.role + ', impact ' + b.r.impact + ' of 100') + '">'
            + '<rect class="bar__hit" x="' + (b.x1 - 6).toFixed(1) + '" y="' + (b.y - 11).toFixed(1) + '" width="' + (b.x2 - b.x1 + 12).toFixed(1) + '" height="22"/>'
            + '<rect class="bar__span" x="' + b.x1.toFixed(1) + '" y="' + (b.y - 3).toFixed(1) + '" width="' + (b.x2 - b.x1).toFixed(1) + '" height="6" rx="3"/>'
            + '<circle class="bar__dot" cx="' + b.x1.toFixed(1) + '" cy="' + b.y.toFixed(1) + '" r="4.5"/>'
            + '<text class="bar__lab" x="' + (b.x1 + 9).toFixed(1) + '" y="' + (b.y - 9).toFixed(1) + '">' + esc(b.r.org) + '</text>'
            + '</g>';
        }).join('')
      + '</g>'
      + '<line class="playhead" id="playhead" x1="0" y1="' + PT + '" x2="0" y2="' + (VH - PB) + '"/>'
      + '</svg>'
      + '<div class="scrub">'
      + '<input type="range" id="scrub" min="0" max="1000" value="1000" step="1" aria-label="Scrub the timeline">'
      + '</div>'
      + '<div class="nowcard" id="nowcard"></div>';

    var svg = host.querySelector('svg');
    var rect = host.querySelector('#revealRect');
    var head = host.querySelector('#playhead');
    var input = host.querySelector('#scrub');
    var card = host.querySelector('#nowcard');
    var groups = Array.prototype.slice.call(host.querySelectorAll('.bar'));
    var X0 = PL, X1 = X(nowDec);
    var shownId = null;

    function reachedAt(px) {
      var started = bars.filter(function (b) { return b.x1 <= px + 0.5; });
      if (!started.length) return null;
      /* Prefer something actually running at this point on the timeline —
         otherwise the far right shows a role that has already ended as though
         it were current. Among the live ones, the most recently begun is the
         one the playhead just reached. Fall back to the last thing started,
         for the gaps where nothing overlaps. */
      var live = started.filter(function (b) { return b.x2 >= px - 0.5; });
      var pool = live.length ? live : started;
      return pool[pool.length - 1].r;
    }

    function paintCard(r) {
      if (!r) { card.innerHTML = '<p class="nowcard__idle">Before the first culture.</p>'; shownId = null; return; }
      if (r.id === shownId) return;
      shownId = r.id;
      var when = monthYear(r.start) + ' — ' + (r.end ? monthYear(r.end) : 'now');
      card.innerHTML =
        '<p class="nowcard__meta"><span class="nowcard__when">' + esc(when) + '</span>'
        + '<span class="nowcard__impact">impact ' + esc(r.impact) + '<span>/100</span></span></p>'
        + '<h3 class="nowcard__org">' + orgMark(r.org, r.logo, 'mark--lg') + esc(r.org) + '<span>' + esc(r.role) + '</span></h3>'
        + '<p class="nowcard__tag">' + esc(r.tagline) + '</p>'
        + '<p class="nowcard__why"><span>what earns it</span> ' + esc(r.impactNote) + '</p>';
      card.classList.remove('is-in');
      void card.offsetWidth;
      card.classList.add('is-in');
    }

    function apply(t) {
      var px = X0 + t * (X1 - X0);
      rect.setAttribute('width', px.toFixed(1));
      head.setAttribute('x1', px.toFixed(1));
      head.setAttribute('x2', px.toFixed(1));
      head.style.opacity = t >= 0.999 ? 0 : 1;
      var r = reachedAt(px);
      groups.forEach(function (g) {
        g.classList.toggle('is-live', !!r && g.getAttribute('data-role') === r.id && t < 0.999);
      });
      paintCard(r);
      var dec = Math.max(minY, Math.min(maxY, yearAt(px)));
      var yr = Math.floor(dec);
      var mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Math.min(11, Math.floor((dec - yr) * 12))];
      input.setAttribute('aria-valuetext', mo + ' ' + yr + (r ? ', ' + r.org + ', ' + r.role + ', impact ' + r.impact + ' of 100' : ''));
    }

    input.addEventListener('input', function () {
      apply(+input.value / 1000);
      if (global.Culture) global.Culture.feed(0.02, 'scrub');
    });
    apply(1);

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && 'IntersectionObserver' in window) {
      var played = false;
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (en) {
          if (!en.isIntersecting || played) return;
          played = true; obs.disconnect();
          var t0 = performance.now(), dur = 2200;
          (function step(nowT) {
            var k = Math.min(1, (nowT - t0) / dur);
            var eased = 1 - Math.pow(1 - k, 3);
            input.value = Math.round(eased * 1000);
            apply(eased);
            if (k < 1) requestAnimationFrame(step);
          })(t0);
        });
      }, { threshold: 0.35 }).observe(host);
      apply(0);
      input.value = 0;
    }

    svg.addEventListener('click', function (e) {
      var g = e.target.closest('.bar');
      if (g) openRole(g.getAttribute('data-role'));
    });
    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var g = e.target.closest('.bar');
      if (g) { e.preventDefault(); openRole(g.getAttribute('data-role')); }
    });
  }

  function openRole(id) {
    var li = document.querySelector('.role[data-id="' + CSS.escape(id) + '"]');
    if (!li) return;
    if (!li.classList.contains('is-open')) li.querySelector('.role__btn').click();
    li.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- roles ---------- */

  function renderRoles() {
    var host = document.getElementById('roles');
    if (!host) return;
    var roles = (DATA.work || []).slice().sort(function (a, b) {
      return String(b.start).localeCompare(String(a.start));
    });
    host.innerHTML = roles.map(function (r, i) {
      var when = monthYear(r.start) + ' — ' + (r.end ? monthYear(r.end) : 'now');
      var url = safeUrl(r.url);
      return '<li class="role' + (r.current ? ' is-current' : '') + '" data-id="' + esc(r.id) + '">'
        + '<h3 style="margin:0"><button class="role__btn" type="button" aria-expanded="false" aria-controls="panel-' + esc(r.id) + '">'
        + '<span class="role__when">' + esc(when) + '</span>'
        + '<span class="role__id">' + orgMark(r.org, r.logo) + '<span><span class="role__org">' + esc(r.org) + '</span><span class="role__role">' + esc(r.role) + '</span></span></span>'
        + '<span class="role__kind">' + esc(r.kind) + '</span>'
        + '</button></h3>'
        + '<div class="role__panel" id="panel-' + esc(r.id) + '">'
        + '<p>' + esc(r.tagline) + '</p>'
        + '<ul>' + (r.highlights || []).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>'
        + '<div class="role__tags">' + (r.tags || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('')
        + (url ? ' <a href="' + esc(url) + '" rel="noopener" style="font-family:var(--mono);font-size:.7rem">visit →</a>' : '')
        + '</div></div></li>';
    }).join('');

    host.addEventListener('click', function (e) {
      var btn = e.target.closest('.role__btn');
      if (!btn) return;
      var li = btn.closest('.role');
      var open = li.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && global.Culture) global.Culture.feed(0.02, 'role:' + li.dataset.id);
    });
  }

  /* ---------- artifacts ---------- */

  function renderArtifacts() {
    var host = document.getElementById('artifacts');
    if (!host) return;
    var items = (DATA.artifacts || []).slice().sort(function (a, b) {
      return (b.year || 0) - (a.year || 0) || String(a.name).localeCompare(String(b.name));
    });
    host.innerHTML = items.map(function (a) {
      var url = safeUrl(a.url);
      var name = url
        ? '<a href="' + esc(url) + '" rel="noopener">' + esc(a.name) + '</a>'
        : esc(a.name);
      return '<article class="art reveal" data-class="' + esc(a.class) + '">'
        + '<p class="art__meta"><span><span class="art__dot"></span> ' + esc(a.org) + '</span><span>' + esc(a.year) + '</span></p>'
        + '<h3 class="art__name">' + name + '</h3>'
        + '<p class="art__blurb">' + esc(a.blurb) + '</p>'
        + '</article>';
    }).join('');
  }


  /* ---------- in vitro (built with Claude) ---------- */

  var wbFilter = 'all';

  function renderWorkbench() {
    var host = document.getElementById('workbench');
    var filters = document.getElementById('wb-filters');
    var count = document.getElementById('wb-count');
    if (!host) return;

    /* Openable work first — a visitor can do something with those. */
    var items = (DATA.workbench || []).slice().sort(function (a, b) {
      var pa = a.visibility === 'public' ? 0 : 1, pb = b.visibility === 'public' ? 0 : 1;
      return pa - pb || (b.year || 0) - (a.year || 0) || String(a.name).localeCompare(String(b.name));
    });
    if (count) count.textContent = '(' + items.length + ')';

    var kinds = {};
    items.forEach(function (w) { kinds[w.kind || 'tool'] = (kinds[w.kind || 'tool'] || 0) + 1; });
    if (filters) {
      filters.innerHTML = ['all'].concat(Object.keys(kinds).sort()).map(function (k) {
        var n = k === 'all' ? items.length : kinds[k];
        return '<button type="button" data-filter="' + esc(k) + '" aria-pressed="' + (k === wbFilter) + '">'
          + esc(k) + ' <span style="opacity:.55">' + n + '</span></button>';
      }).join('');
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-filter]');
        if (!b) return;
        wbFilter = b.getAttribute('data-filter');
        Array.prototype.forEach.call(filters.querySelectorAll('button'), function (x) {
          x.setAttribute('aria-pressed', x.getAttribute('data-filter') === wbFilter ? 'true' : 'false');
        });
        Array.prototype.forEach.call(host.querySelectorAll('.wb'), function (card) {
          card.hidden = !(wbFilter === 'all' || card.getAttribute('data-kind') === wbFilter);
        });
        collapse('workbench', 6, 'pieces');
        if (global.Culture) global.Culture.feed(0.015, 'wbfilter:' + wbFilter);
      });
    }

    host.innerHTML = items.map(function (w) {
      var url = safeUrl(w.url);
      /* A private artifact's link only resolves for people it has been shared
         with. Rather than hand a visitor a door they cannot open, private
         entries render as plain text with a marker. */
      var isPublic = w.visibility === 'public' && url;
      var title = isPublic
        ? '<a href="' + esc(url) + '" rel="noopener" data-id="' + esc(w.id) + '">' + esc(w.name) + '</a>'
        : esc(w.name);
      var lock = isPublic ? '' : '<span class="wb__lock" title="Private — not shared publicly">private</span>';
      return '<article class="wb reveal" data-kind="' + esc(w.kind || 'tool') + '">'
        + '<p class="wb__meta"><span class="wb__tags"><span class="wb__kind">' + esc(w.kind || 'tool') + '</span>' + lock + '</span>'
        + '<span>' + esc(w.year || '') + '</span></p>'
        + '<h3 class="wb__name">' + title + '</h3>'
        + '<p class="wb__blurb">' + esc(w.blurb) + '</p>'
        + '</article>';
    }).join('');

    host.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-id]');
      if (a && global.Culture) global.Culture.feed(0.02, 'wb:' + a.getAttribute('data-id'));
    });
  }

  /* ---------- press ---------- */

  var pressFilter = 'all';

  function renderPress() {
    var host = document.getElementById('press');
    var filters = document.getElementById('press-filters');
    var count = document.getElementById('press-count');
    if (!host) return;

    var items = (DATA.press || []).slice().sort(function (a, b) {
      return (b.year || 0) - (a.year || 0) || String(a.outlet).localeCompare(String(b.outlet));
    });

    if (count) count.textContent = '(' + items.length + ' and counting)';

    var kinds = {};
    items.forEach(function (p) { kinds[p.type || 'article'] = (kinds[p.type || 'article'] || 0) + 1; });
    if (filters) {
      filters.innerHTML = ['all'].concat(Object.keys(kinds).sort()).map(function (k) {
        var n = k === 'all' ? items.length : kinds[k];
        return '<button type="button" data-filter="' + esc(k) + '" aria-pressed="' + (k === pressFilter) + '">'
          + esc(k) + ' <span style="opacity:.55">' + n + '</span></button>';
      }).join('');
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-filter]');
        if (!b) return;
        pressFilter = b.getAttribute('data-filter');
        Array.prototype.forEach.call(filters.querySelectorAll('button'), function (x) {
          x.setAttribute('aria-pressed', x.getAttribute('data-filter') === pressFilter ? 'true' : 'false');
        });
        applyPressFilter();
        collapse('press', 8, 'items');
        if (global.Culture) global.Culture.feed(0.015, 'filter:' + pressFilter);
      });
    }

    host.innerHTML = items.map(function (p) {
      var url = safeUrl(p.url);
      var tail = (p.year || '') + (p.new ? ' <span class="press__new">NEW</span>' : '');
      var inner = '<span class="press__outlet">' + esc(p.outlet) + '</span>'
        + '<span class="press__title">' + esc(p.title) + '</span>'
        + '<span class="press__tail">' + tail + '</span>';
      return '<li data-type="' + esc(p.type || 'article') + '">'
        + (url
            ? '<a href="' + esc(url) + '" rel="noopener" data-id="' + esc(p.id) + '">' + inner + '</a>'
            : '<span class="press__row" style="display:grid;grid-template-columns:10.5rem 1fr auto;gap:1.2rem;padding:.95rem 0">' + inner + '</span>')
        + '</li>';
    }).join('');

    host.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-id]');
      if (a && global.Culture) global.Culture.feed(0.02, 'press:' + a.getAttribute('data-id'));
    });
  }

  function applyPressFilter() {
    Array.prototype.forEach.call(document.querySelectorAll('#press li'), function (li) {
      li.hidden = !(pressFilter === 'all' || li.getAttribute('data-type') === pressFilter);
    });
  }

  /* ---------- awards / talks / teaching / writing / communities ---------- */

  function renderAwards() {
    var host = document.getElementById('awards-list');
    if (!host) return;
    var items = (DATA.awards || []).slice().sort(function (a, b) { return (b.year || 0) - (a.year || 0); });
    host.innerHTML = items.map(function (a) {
      var url = safeUrl(a.url);
      var inner = '<span class="award__year">' + esc(a.year || '') + '</span><span>' + esc(a.title) + '</span>';
      return '<li class="reveal">' + (url ? '<a href="' + esc(url) + '" rel="noopener">' + inner + '</a>' : '<span>' + inner + '</span>') + '</li>';
    }).join('');
  }

  function plainList(hostId, items, mapper) {
    var host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = (items || []).map(mapper).join('');
  }

  function renderLists() {
    var talks = (DATA.talks || []).slice().sort(function (a, b) { return (b.year || 0) - (a.year || 0); });
    plainList('talks', talks, function (t) {
      var url = safeUrl(t.url);
      var label = esc(t.title);
      var years = t.years && t.years.length > 1 ? t.years.join(', ') : (t.year || '—');
      return '<li><span>' + (url ? '<a href="' + esc(url) + '" rel="noopener">' + label + '</a>' : label)
        + '<br><span class="meta">' + esc(t.venue || '') + '</span></span>'
        + '<span class="meta">' + esc(years) + '</span></li>';
    });

    plainList('teaching', DATA.teaching, function (t) {
      var url = safeUrl(t.url);
      return '<li><span>' + (url ? '<a href="' + esc(url) + '" rel="noopener">' + esc(t.title) + '</a>' : esc(t.title)) + '</span>'
        + '<span class="meta">' + esc(t.role) + '</span></li>';
    });

    plainList('writing', DATA.writing, function (w) {
      var url = safeUrl(w.url);
      return '<li><span>' + (url ? '<a href="' + esc(url) + '" rel="noopener">' + esc(w.title) + '</a>' : esc(w.title)) + '</span>'
        + '<span class="meta">' + esc(w.outlet) + ' ' + esc(w.year || '') + '</span></li>';
    });

    var cloud = document.getElementById('communities');
    if (cloud) {
      cloud.innerHTML = (DATA.communities || []).map(function (c) {
        var url = safeUrl(c.url);
        return url ? '<a href="' + esc(url) + '" rel="noopener">' + esc(c.name) + '</a>'
                   : '<a aria-disabled="true">' + esc(c.name) + '</a>';
      }).join('');
    }
  }


  /* ---------- collapse: recent up front, the rest behind a toggle ----------
     Every long list is already sorted newest-first, so "the first N children"
     is the same as "the most recent N". Collapsing is done by marking overflow
     items rather than slicing the DOM, so filtering and expanding compose:
     re-running after a filter re-picks which items count as overflow. */

  var COLLAPSED = {};

  function collapse(hostId, keep, noun) {
    var host = document.getElementById(hostId);
    if (!host) return;
    var sec = host.closest('.sec');
    if (!sec) return;
    if (COLLAPSED[hostId] === undefined) COLLAPSED[hostId] = true;

    var kids = Array.prototype.filter.call(host.children, function (el) {
      return !el.hasAttribute('hidden');   /* a filter may have excluded it */
    });
    kids.forEach(function (el, i) { el.classList.toggle('is-extra', i >= keep); });
    Array.prototype.forEach.call(host.children, function (el) {
      if (el.hasAttribute('hidden')) el.classList.remove('is-extra');
    });

    var extra = kids.length - keep;
    var btn = sec.querySelector('.more[data-for="' + hostId + '"]');
    if (extra <= 0) { if (btn) btn.remove(); host.removeAttribute('data-collapsed'); return; }

    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'more';
      btn.setAttribute('data-for', hostId);
      host.insertAdjacentElement('afterend', btn);
      btn.addEventListener('click', function () {
        COLLAPSED[hostId] = !COLLAPSED[hostId];
        collapse(hostId, keep, noun);
        if (COLLAPSED[hostId]) {
          host.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (global.Culture) {
          global.Culture.feed(0.02, 'expand:' + hostId);
        }
      });
    }
    var open = !COLLAPSED[hostId];
    host.setAttribute('data-collapsed', open ? 'false' : 'true');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.innerHTML = open
      ? '<span class="more__sign">&minus;</span> show fewer'
      : '<span class="more__sign">+</span> ' + extra + ' more ' + esc(noun);
  }

  /* ---------- boot ---------- */

  function fetchAll() {
    return Promise.all(FILES.map(function (f) {
      return fetch('data/' + f + '.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(f + ': ' + r.status); return r.json(); })
        .then(function (j) { DATA[f] = j; })
        .catch(function (err) { DATA[f] = Array.isArray(DATA[f]) ? DATA[f] : []; console.warn('[render]', err.message); });
    }));
  }

  global.Render = {
    data: function () { return DATA; },
    boot: function () {
      return fetchAll().then(function () {
        renderProfile();
        renderRoles();
        renderCurve();
        renderArtifacts();
        renderWorkbench();
        renderPress();
        renderAwards();
        renderLists();

        /* Lead with what is current; everything else is one click away. */
        collapse('roles', 5, 'roles');
        collapse('artifacts', 6, 'things');
        collapse('workbench', 6, 'pieces');
        collapse('press', 8, 'items');
        collapse('awards-list', 6, 'awards');
        collapse('talks', 8, 'talks');
        collapse('communities', 12, 'communities');

        return DATA;
      });
    },
    openRole: openRole
  };
})(window);
