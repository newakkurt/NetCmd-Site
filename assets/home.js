/* Ana sayfa: komut arama/filtreleme ve terminal yazma efekti. */
(function () {
  'use strict';

  /* ---------- arama ---------- */
  var q = document.getElementById('q');
  var cnt = document.getElementById('cnt');
  var none = document.getElementById('none');
  if (q) {
    var cards = [].slice.call(document.querySelectorAll('.cmd-card'));
    var sections = [].slice.call(document.querySelectorAll('section.cat'));
    var total = cards.length;
    var fmt = cnt ? cnt.getAttribute('data-fmt') : '';
    var update = function () {
      var term = q.value.trim().toLowerCase();
      var words = term ? term.split(/\s+/) : [];
      var shown = 0;
      cards.forEach(function (c) {
        var hay = c.getAttribute('data-s') || '';
        var ok = words.every(function (w) { return hay.indexOf(w) !== -1; });
        if (window.__favOnly && c.getAttribute('data-fav') !== '1') ok = false;
        c.hidden = !ok;
        if (ok) shown++;
      });
      sections.forEach(function (s) {
        var any = s.querySelector('.cmd-card:not([hidden])');
        s.hidden = !any;
      });
      if (cnt) cnt.textContent = fmt.replace('{n}', shown).replace('{t}', total);
      if (none) none.hidden = shown !== 0;
    };
    q.addEventListener('input', update);
    update();
  }

  /* ---------- terminal yazma efekti ---------- */
  var tp = document.getElementById('tp');
  var tc = document.getElementById('tc');
  if (!tp || !tc) return;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var script = [
    { p: 'SW-CISCO#', c: 'show vlan brief' },
    { p: '<HUAWEI>', c: 'display vlan' },
    { p: 'ARUBA#', c: 'show vlan' },
    { p: 'SW-CISCO#', c: 'show ip ospf neighbor' },
    { p: '<HUAWEI>', c: 'display ospf peer brief' },
    { p: 'ARUBA#', c: 'show ip ospf neighbors' },
    { p: 'SW-CISCO#', c: 'show port-security' },
    { p: '<HUAWEI>', c: 'display port-security interface GigabitEthernet 0/0/5' }
  ];
  if (reduce) { tp.textContent = script[0].p; tc.textContent = script[0].c; return; }
  var i = 0;
  function typeLine() {
    var s = script[i % script.length];
    tp.textContent = s.p;
    tc.textContent = '';
    var n = 0;
    var t = setInterval(function () {
      n++;
      tc.textContent = s.c.slice(0, n);
      if (n >= s.c.length) {
        clearInterval(t);
        setTimeout(eraseLine, 1600);
      }
    }, 55);
  }
  function eraseLine() {
    var s = script[i % script.length];
    var n = s.c.length;
    var t = setInterval(function () {
      n -= 2;
      if (n <= 0) {
        n = 0;
        clearInterval(t);
        tc.textContent = '';
        i++;
        setTimeout(typeLine, 280);
        return;
      }
      tc.textContent = s.c.slice(0, n);
    }, 22);
  }
  typeLine();
})();
