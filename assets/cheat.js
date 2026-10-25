/* Cheat-sheet: platform sütunlarını aç/kapat, Markdown indir, PDF (yazdır). */
(function () {
  'use strict';
  var tbl = document.getElementById('cheat');
  if (!tbl) return;
  var chks = [].slice.call(document.querySelectorAll('.vchk'));
  function visible() { return chks.filter(function (c) { return c.checked; }).map(function (c) { return c.value; }); }
  function apply() {
    var vs = visible();
    [].forEach.call(tbl.querySelectorAll('[data-v]'), function (el) { el.hidden = vs.indexOf(el.getAttribute('data-v')) === -1; });
    [].forEach.call(tbl.querySelectorAll('tr.catrow th'), function (th) { th.colSpan = vs.length + 1; });
  }
  chks.forEach(function (c) { c.addEventListener('change', apply); });
  apply();
  var md = document.getElementById('ch-md');
  if (md) md.addEventListener('click', function () {
    var vs = visible();
    var heads = [].map.call(tbl.querySelectorAll('thead th'), function (th) { return th; }).filter(function (th, i) { return i === 0 || vs.indexOf(th.getAttribute('data-v')) !== -1; });
    var out = ['# NetCmd cheat-sheet', '', '| ' + heads.map(function (h) { return h.textContent; }).join(' | ') + ' |', '|' + heads.map(function () { return '---|'; }).join('')];
    [].forEach.call(tbl.querySelectorAll('tbody tr'), function (tr) {
      if (tr.classList.contains('catrow')) { out.push('| **' + tr.textContent.trim().replace(/\|/g, '/') + '** |' + heads.slice(1).map(function () { return ' |'; }).join('')); return; }
      var cells = [].filter.call(tr.children, function (td, i) { return i === 0 || vs.indexOf(td.getAttribute('data-v')) !== -1; });
      out.push('| ' + cells.map(function (td, i) {
        if (i === 0) return td.textContent.trim().replace(/\|/g, '/');
        var code = td.querySelector('code'); if (!code) return '—';
        return code.innerHTML.split(/<br\s*\/?>/i).map(function (x) { var t = document.createElement('div'); t.innerHTML = x; return '`' + t.textContent.replace(/\|/g, '\\|') + '`'; }).join('<br>');
      }).join(' | ') + ' |');
    });
    var b = new Blob([out.join('\n') + '\n'], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = md.getAttribute('data-name') || 'cheatsheet.md';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  var pdf = document.getElementById('ch-pdf');
  if (pdf) pdf.addEventListener('click', function () { window.print(); });
})();
