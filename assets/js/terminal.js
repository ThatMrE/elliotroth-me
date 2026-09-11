/* terminal.js — the bench terminal.
   Not decoration: `grep` really does search every record on the site. */
(function (global) {
  'use strict';

  var out, input, form, panel, btn, closeBtn;
  var history = [], hIdx = -1;
  var COLLECTIONS = ['work', 'press', 'awards', 'talks', 'teaching', 'writing', 'artifacts', 'communities'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function D() { return (global.Render && global.Render.data()) || {}; }

  function print(text, cls) {
    if (!out) return;
    var line = document.createElement('div');
    if (cls) line.className = cls;
    line.innerHTML = text;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
  }
  function printRaw(text, cls) { print(esc(text), cls); }

  function link(url, label) {
    if (!/^https?:\/\//i.test(url || '')) return esc(label || url || '');
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label || url) + '</a>';
  }

  function titleOf(rec) { return rec.title || rec.name || rec.org || '(untitled)'; }
  function idOf(rec, i, coll) { return rec.id || (coll + '-' + i); }

  function allRecords() {
    var list = [];
    COLLECTIONS.forEach(function (c) {
      (D()[c] || []).forEach(function (rec, i) {
        list.push({ coll: c, id: idOf(rec, i, c), rec: rec });
      });
    });
    return list;
  }

  var BANNER = [
    '   ╭─────────────────────────────────────────────╮',
    '   │  bench terminal · elliotroth.me             │',
    '   │  everything on this page is greppable       │',
    '   ╰─────────────────────────────────────────────╯',
    'type `help` for commands. `grep algae` is a good start.'
  ].join('\n');

  var HELP = [
    'help                  this',
    'whoami                the short version',
    'ls [collection]       ' + COLLECTIONS.join(' | '),
    'grep <term>           search every record on the site',
    'cat <id>              print one record in full',
    'open <id>             open that record\'s link in a new tab',
    'contact               how to reach him',
    'cv                    condensed CV dump',
    '',
    'od                    culture density + growth phase',
    'feed                  feed the culture',
    'passage               dilute into fresh medium, keep the count',
    'moon                  toggle lunar palette (needs OD 0.60)',
    'contaminate           you probably should not (needs OD 1.20)',
    'decontaminate         autoclave everything',
    '',
    'clear                 wipe the scrollback',
    'exit                  close the terminal'
  ].join('\n');

  function cmdLs(arg) {
    if (!arg) {
      printRaw(COLLECTIONS.map(function (c) {
        return c.padEnd(14) + String((D()[c] || []).length).padStart(3) + ' records';
      }).join('\n'));
      return;
    }
    var coll = D()[arg];
    if (!coll) { printRaw('ls: no such collection: ' + arg + '. try: ' + COLLECTIONS.join(', '), 't-err'); return; }
    printRaw(coll.length + ' records in ' + arg, 't-dim');
    coll.forEach(function (rec, i) {
      var id = idOf(rec, i, arg);
      var meta = rec.year || rec.outlet || rec.role || rec.start || '';
      print('<span class="t-dim">' + esc(String(id).padEnd(28)) + '</span>'
        + esc(titleOf(rec)) + (meta ? ' <span class="t-dim">· ' + esc(meta) + '</span>' : ''));
    });
  }

  function cmdGrep(term) {
    if (!term) { printRaw('usage: grep <term>', 't-warn'); return; }
    var needle = term.toLowerCase();
    var hits = allRecords().filter(function (r) {
      return JSON.stringify(r.rec).toLowerCase().indexOf(needle) !== -1;
    });
    if (!hits.length) { printRaw('no hits for "' + term + '". the culture is sterile here.', 't-warn'); return; }
    printRaw(hits.length + ' hit' + (hits.length === 1 ? '' : 's') + ' for "' + term + '"', 't-ok');
    hits.slice(0, 40).forEach(function (h) {
      var url = h.rec.url;
      print('<span class="t-dim">' + esc(h.coll.padEnd(12)) + '</span>'
        + (url ? link(url, titleOf(h.rec)) : esc(titleOf(h.rec)))
        + ' <span class="t-dim">[' + esc(h.id) + ']</span>');
    });
    if (hits.length > 40) printRaw('… ' + (hits.length - 40) + ' more. narrow it down.', 't-dim');
    if (global.Culture) global.Culture.feed(0.02, 'grep:' + needle);
  }

  function findRecord(id) {
    if (!id) return null;
    var key = id.toLowerCase();
    var all = allRecords();
    for (var i = 0; i < all.length; i++) if (String(all[i].id).toLowerCase() === key) return all[i];
    for (var j = 0; j < all.length; j++) if (String(all[j].id).toLowerCase().indexOf(key) === 0) return all[j];
    return null;
  }

  function cmdCat(id) {
    var f = findRecord(id);
    if (!f) { printRaw('cat: ' + (id || '') + ': no such record. try `ls` or `grep`.', 't-err'); return; }
    var r = f.rec;
    printRaw('── ' + f.coll + ' / ' + f.id + ' ' + '─'.repeat(Math.max(0, 30 - f.coll.length - String(f.id).length)), 't-dim');
    Object.keys(r).forEach(function (k) {
      if (k === 'id') return;
      var v = r[k];
      if (v == null || v === '') return;
      if (Array.isArray(v)) {
        if (!v.length) return;
        printRaw(k.padEnd(12) + ' ' + v.join(', '));
      } else if (k === 'url') {
        print('<span>' + esc(k.padEnd(12)) + ' </span>' + link(String(v)));
      } else {
        printRaw(k.padEnd(12) + ' ' + v);
      }
    });
    if (global.Culture) global.Culture.feed(0.015, 'cat:' + f.id);
  }

  function cmdOpen(id) {
    var f = findRecord(id);
    if (!f) { printRaw('open: ' + (id || '') + ': no such record.', 't-err'); return; }
    var url = f.rec.url;
    if (!/^https?:\/\//i.test(url || '')) { printRaw('open: ' + f.id + ' has no link on file.', 't-warn'); return; }
    window.open(url, '_blank', 'noopener');
    print('opening ' + link(url), 't-ok');
    if (global.Culture) global.Culture.feed(0.02, 'open:' + f.id);
  }

  function cmdWhoami() {
    var p = D().profile || {};
    printRaw(p.name || 'Elliot Roth', 't-echo');
    printRaw(p.strapline || '');
    printRaw('');
    printRaw(p.objective || '');
    printRaw('');
    var counts = COLLECTIONS.map(function (c) { return (D()[c] || []).length + ' ' + c; }).join(' · ');
    printRaw(counts, 't-dim');
  }

  function cmdCv() {
    var work = (D().work || []).slice().sort(function (a, b) { return String(b.start).localeCompare(String(a.start)); });
    work.forEach(function (r) {
      printRaw((r.start + '—' + (r.end || 'now')).padEnd(18) + r.org + ' · ' + r.role);
    });
    var ed = ((D().profile || {}).education || [])[0];
    if (ed) { printRaw(''); printRaw(ed.years.padEnd(18) + ed.degree + ', ' + ed.school); }
  }

  function cmdContact() {
    var p = D().profile || {};
    if (p.email) print('email   ' + '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>');
    (p.links || []).forEach(function (l) { print(String(l.label || '').padEnd(8) + ' ' + link(l.url, l.url)); });
  }

  function cmdOd() {
    if (!global.Culture) return;
    var s = global.Culture.get();
    printRaw('OD600        ' + s.od.toFixed(3));
    printRaw('phase        ' + global.Culture.phase());
    printRaw('passage      ' + s.passage);
    printRaw('palette      ' + (s.moon ? 'lunar regolith' : 'wet bench'));
    printRaw('contaminated ' + (s.contaminated ? 'yes — and honestly it looks better' : 'no'));
  }

  function cmdChangelog() {
    var c = D().changelog || {};
    var entries = c.entries || [];
    if (!entries.length) { printRaw('no runs recorded yet.', 't-dim'); return; }
    entries.slice(0, 12).forEach(function (e) {
      printRaw(e.date + '  [' + (e.agent || 'curator') + ']  ' + e.summary);
    });
  }

  var JOKES = {
    'sudo': 'nice try. this is a community lab — we use consensus.',
    'rm': 'absolutely not.',
    'exit()': 'this is a bench, not a REPL.',
    'vim': 'you are already trapped in a petri dish. one cage at a time.',
    'make': 'make: *** No rule to make target. Have you tried growing it?',
    'npm': 'npm ERR! this project is grown, not installed.',
    'pip': 'pipette, surely.',
    'ping': 'pong. (the algae are fine.)',
    'top': 'PID 1  spirulina  99.8% CPU'
  };

  function run(raw) {
    var line = String(raw || '').trim();
    if (!line) return;
    print('<span class="t-dim">bench&gt;</span> <span class="t-echo">' + esc(line) + '</span>');
    history.unshift(line); hIdx = -1;

    var parts = line.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var rest = parts.slice(1).join(' ');

    switch (cmd) {
      case 'help': case '?': printRaw(HELP); break;
      case 'whoami': case 'who': cmdWhoami(); break;
      case 'ls': case 'dir': cmdLs(rest.toLowerCase()); break;
      case 'grep': case 'find': case 'search': cmdGrep(rest); break;
      case 'cat': case 'show': cmdCat(rest); break;
      case 'open': case 'xdg-open': cmdOpen(rest); break;
      case 'cv': case 'resume': cmdCv(); break;
      case 'contact': case 'email': cmdContact(); break;
      case 'changelog': case 'log': cmdChangelog(); break;
      case 'od': case 'status': cmdOd(); break;
      case 'feed':
        if (global.Culture) {
          global.Culture.feed(0.05, 'feed');
          if (global.Petri) global.Petri.splash(6);
          printRaw('fed. OD now ' + global.Culture.od().toFixed(3), 't-ok');
        }
        break;
      case 'passage':
        if (global.Culture) printRaw('diluted 1:4 into fresh medium. passage ' + global.Culture.passage() + '.', 't-ok');
        break;
      case 'moon':
        if (!global.Culture) break;
        if (global.Culture.toggleMoon()) printRaw('palette: ' + (global.Culture.get().moon ? 'lunar regolith' : 'wet bench'), 't-ok');
        else printRaw('moon mode needs OD 0.60. grow first.', 't-warn');
        break;
      case 'contaminate':
        if (!global.Culture) break;
        if (global.Culture.setContaminated(true)) {
          if (global.Petri) global.Petri.contaminate(true);
          printRaw('mCherry-tagged something is loose in the dish. this is on you.', 't-warn');
        } else {
          printRaw('nothing to contaminate yet — a culture this thin has no competition. grow to OD 1.20.', 't-warn');
        }
        break;
      case 'decontaminate': case 'autoclave': case 'bleach':
        if (global.Culture) global.Culture.setContaminated(false);
        printRaw('121 °C, 15 psi, 20 minutes. clean.', 't-ok');
        break;
      case 'reseed': case 'streak':
        if (global.Petri) global.Petri.reseed();
        printRaw('fresh plate, four-quadrant streak.', 't-ok');
        break;
      case 'reset':
        if (global.Culture) global.Culture.reset();
        printRaw('culture reset to inoculum.', 't-ok');
        break;
      case 'clear': case 'cls': out.innerHTML = ''; break;
      case 'exit': case 'quit': case 'close': api.close(); break;
      default:
        if (JOKES[cmd]) { printRaw(JOKES[cmd], 't-warn'); break; }
        printRaw(cmd + ': command not found. `help` lists what works.', 't-err');
    }
  }

  var api = {
    print: function (msg, cls) { printRaw(msg, cls); },
    run: run,
    open: function () {
      if (!panel) return;
      panel.hidden = false;
      document.body.classList.add('term-open');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      if (!out.childElementCount) { printRaw(BANNER, 't-ok'); }
      setTimeout(function () { input.focus(); }, 30);
      if (global.Culture) global.Culture.feed(0.03, 'terminal-open');
    },
    close: function () {
      if (!panel) return;
      panel.hidden = true;
      document.body.classList.remove('term-open');
      if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    },
    toggle: function () { panel.hidden ? api.open() : api.close(); },
    init: function () {
      panel = document.getElementById('terminal');
      out = document.getElementById('term-out');
      input = document.getElementById('term-in');
      form = document.getElementById('term-form');
      btn = document.getElementById('btn-term');
      closeBtn = document.getElementById('term-close');
      if (!panel || !form) return;

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        run(input.value);
        input.value = '';
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (hIdx < history.length - 1) hIdx++;
          input.value = history[hIdx] || '';
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (hIdx > 0) { hIdx--; input.value = history[hIdx] || ''; }
          else { hIdx = -1; input.value = ''; }
        } else if (e.key === 'Escape') {
          api.close();
        }
      });
      if (btn) btn.addEventListener('click', api.toggle);
      if (closeBtn) closeBtn.addEventListener('click', api.close);

      document.addEventListener('keydown', function (e) {
        var t = e.target;
        var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          api.open();
        }
      });
    }
  };

  global.Bench = api;
})(window);
