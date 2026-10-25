/* Tema (koyu/açık) + Ctrl+K hızlı arama. Veriler yalnızca yerel arama indeksinden gelir. */
(function () {
  'use strict';
  var root = document.documentElement;
  var lang = (root.lang || 'tr').slice(0, 2);
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---- tema ---- */
  var tb = document.getElementById('theme-btn');
  if (tb) tb.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var nxt = cur === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', nxt);
    store('netcmd.theme', nxt);
    try { root.style.colorScheme = nxt; } catch (e) {}
  });

  /* ---- hızlı arama ---- */
  var me = document.currentScript;
  var idxUrl = me && me.getAttribute('data-idx');
  var PH = { tr: ['Komut ara: vlan, ospf, show ip route…', 'Sonuç yok', '↑↓ gezin · Enter aç · Esc kapat'],
             en: ['Search commands: vlan, ospf, show ip route…', 'No results', '↑↓ navigate · Enter open · Esc close'],
             ar: ['ابحث عن أمر: vlan, ospf, show ip route…', 'لا نتائج', '↑↓ تنقل · Enter فتح · Esc إغلاق'] };
  var TX = PH[lang] || PH.tr;
  var data = null, ov = null, inp = null, list = null, sel = 0, shown = [], loading = false;

  function load(cb) {
    if (data) { cb(); return; }
    if (loading || !idxUrl) return;
    loading = true;
    fetch(idxUrl).then(function (r) { return r.json(); }).then(function (j) { data = j; loading = false; cb(); })
      .catch(function () { loading = false; });
  }
  function build() {
    ov = document.createElement('div');
    ov.id = 'qs-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.hidden = true;
    var box = document.createElement('div'); box.id = 'qs-box';
    inp = document.createElement('input'); inp.id = 'qs-in'; inp.type = 'search'; inp.autocomplete = 'off'; inp.placeholder = TX[0]; inp.setAttribute('aria-label', TX[0]);
    list = document.createElement('ul'); list.id = 'qs-list';
    var hint = document.createElement('div'); hint.id = 'qs-hint'; hint.textContent = TX[2];
    box.appendChild(inp); box.appendChild(list); box.appendChild(hint); ov.appendChild(box); document.body.appendChild(ov);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    inp.addEventListener('input', render);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); mark(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (shown[sel]) location.href = shown[sel].u; }
      else if (e.key === 'Escape') close();
    });
  }
  function mark() {
    [].forEach.call(list.children, function (li, i) { li.className = i === sel ? 'on' : ''; if (i === sel && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' }); });
  }
  function render() {
    var words = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    shown = [];
    if (data) {
      var scored = [];
      data.forEach(function (d) {
        var ok = words.every(function (w) { return d.s.indexOf(w) !== -1; });
        if (!ok && words.length) return;
        var sc = 0, tl = d.t.toLowerCase();
        words.forEach(function (w) { if (tl.indexOf(w) === 0) sc += 3; else if (tl.indexOf(w) !== -1) sc += 2; else sc += 1; });
        scored.push([sc, d]);
      });
      scored.sort(function (a, b) { return b[0] - a[0]; });
      shown = scored.slice(0, 12).map(function (x) { return x[1]; });
    }
    list.textContent = '';
    if (!shown.length) { var n = document.createElement('li'); n.style.padding = '10px 16px'; n.textContent = TX[1]; list.appendChild(n); return; }
    shown.forEach(function (d) {
      var li = document.createElement('li'), a = document.createElement('a'), sm = document.createElement('small');
      a.href = d.u; a.textContent = d.t; sm.textContent = d.c + (d.k ? '  ·  ' + d.k : ''); a.appendChild(sm); li.appendChild(a); list.appendChild(li);
    });
    sel = 0; mark();
  }
  function open() {
    if (!ov) build();
    ov.hidden = false; inp.value = ''; inp.focus();
    load(render); render();
  }
  function close() { if (ov) ov.hidden = true; }
  var qb = document.getElementById('qs-open');
  if (qb) qb.addEventListener('click', open);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (ov && !ov.hidden) close(); else open(); }
    else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); open(); }
  });
})();
