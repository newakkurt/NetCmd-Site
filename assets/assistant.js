/* Komut asistanı: yerel anahtar-kelime eşleştirme (LLM değil). Veri tarayıcıdan çıkmaz. */
(function () {
  'use strict';
  var cfgEl = document.getElementById('as-cfg');
  var inp = document.getElementById('as-in'), go = document.getElementById('as-go'), out = document.getElementById('as-out');
  if (!cfgEl || !inp) return;
  var C = JSON.parse(cfgEl.textContent), data = null;

  function fold(s) {
    return String(s).toLowerCase().replace(/ı/g, 'i').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
      .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا');
  }
  var STOP = {};
  ('ve ile icin bir bu su de da mi mu ben bana gore sonra ardindan et edin yap yapmak goster gosterme listele goruntule kontrol kontrolu ' +
   'the a an to and then of for on in show display list check view me i want how do please get ' +
   'و ثم عرض اعرض اظهر اعرض افحص تحقق من في على الى لي').split(' ').forEach(function (w) { STOP[w] = 1; });

  function tokens(s) {
    return fold(s).split(/[^a-z0-9؀-ۿ]+/).filter(function (w) { return w && w.length > 1 && !STOP[w]; });
  }
  function scoreItem(it, toks) {
    var title = fold(it.t), kw = fold(it.k), sc = 0;
    toks.forEach(function (w) {
      var pre = w.length > 5 ? w.slice(0, 5) : w;
      if (title.indexOf(pre) !== -1) sc += 3;
      else if (kw.indexOf(pre) !== -1) sc += 1;
    });
    return sc;
  }
  function values(q) {
    var v = [], m;
    var re = /\bvlan\s*(\d{1,4})\b/gi; while ((m = re.exec(q))) v.push('VLAN ' + m[1]);
    re = /\b\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?\b/g; while ((m = re.exec(q))) v.push(m[0]);
    re = /\b(?:gi|gig|gigabitethernet|te|ten|eth|ethernet|ge|xe|et|ether|port)[-\s]?[\d/.:-]+\b/gi; while ((m = re.exec(q))) v.push(m[0].trim());
    return v.filter(function (x, i) { return v.indexOf(x) === i; });
  }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }

  function run() {
    var q = inp.value.trim();
    out.textContent = '';
    if (!q || !data) return;
    var clauses = q.split(/\s+(?:ve|ile|sonra|ardından|and|then|ثم|و)\s+|[,;+\n]+/i).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 5);
    var vals = values(q), any = false;
    if (vals.length) {
      var p = el('p'); p.appendChild(el('strong', '', C.t.as_values + ': '));
      vals.forEach(function (x) { p.appendChild(el('span', 'tag', x)); p.appendChild(document.createTextNode(' ')); });
      out.appendChild(p);
    }
    clauses.forEach(function (cl, n) {
      var toks = tokens(cl); if (!toks.length) return;
      var scored = data.map(function (it) { return [scoreItem(it, toks), it]; }).filter(function (x) { return x[0] >= 2; })
        .sort(function (a, b) { return b[0] - a[0]; });
      if (!scored.length) return;
      var top = scored[0][0], picks = scored.filter(function (x, i) { return i < 2 && x[0] >= top * 0.7; });
      picks.forEach(function (pk) {
        any = true;
        var it = pk[1], box = el('div', 'as-step');
        box.appendChild(el('h3', '', C.t.as_step + ' ' + (n + 1) + ': ' + it.t));
        var grid = el('div', 'as-grid');
        Object.keys(C.v).forEach(function (v) {
          if (!it.v[v]) return;
          var d = el('div', 'vend'), h = el('h3', '', C.v[v]); d.appendChild(h);
          d.appendChild(el('pre', '', it.v[v].join('\n'))); grid.appendChild(d);
        });
        box.appendChild(grid);
        var a = el('a', '', C.t.as_open + ' →'); a.href = it.u; var pp = el('p'); pp.appendChild(a); box.appendChild(pp);
        out.appendChild(box);
      });
    });
    if (!any) out.appendChild(el('p', 'msg', C.t.as_none));
  }
  fetch(C.idx).then(function (r) { return r.json(); }).then(function (j) { data = j; if (inp.value) run(); });
  go.addEventListener('click', run);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) { e.preventDefault(); run(); } });
  [].forEach.call(document.querySelectorAll('.as-ex'), function (b) { b.addEventListener('click', function () { inp.value = b.textContent; run(); }); });
})();
