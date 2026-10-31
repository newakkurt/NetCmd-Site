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

  /* ---- çerezsiz arama kaydı: yalnızca sorgu, dil ve sonuç sayısı (kimlik/IP yok). DNT/GPC'ye saygılı. ---- */
  var SBURL = me && me.getAttribute('data-url'), SBKEY = me && me.getAttribute('data-key');
  var logged = {}, logCount = 0, logTimer = null;
  function noTrack() { return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true; }
  function logSearch(q, hits) {
    q = q.trim().toLowerCase().replace(/\s+/g, ' ');
    if (q.length < 3 || q.length > 80 || logged[q] || logCount >= 15 || noTrack() || !SBURL || !SBKEY) return;
    if (/@|\d{4,}|https?:/.test(q)) return;   // e-posta, uzun sayı (IP/seri no) ve URL kaydetme
    logged[q] = 1; logCount++;
    try {
      fetch(SBURL + '/rest/v1/search_log', { method: 'POST', keepalive: true,
        headers: { apikey: SBKEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ q: q, lang: lang, hits: hits }) }).catch(function () {});
    } catch (e) {}
    try {
      if (!hits) { if (window.plausible) window.plausible('Search Miss', { props: { q: q } }); if (window.umami) window.umami.track('search-miss', { q: q }); }
    } catch (e) {}
  }

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
    if (data && words.length) { clearTimeout(logTimer); (function (q, h) { logTimer = setTimeout(function () { logSearch(q, h); }, 1500); })(inp.value, shown.length); }
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


/* NetCmd UX layer: accessible copy controls and a small local recent-command history.
   History stores only command slugs/titles in this browser; no network request is made. */
(function () {
  'use strict';
  var lang = (document.documentElement.lang || 'en').slice(0, 2);
  var words = {
    tr: {copy:'Kopyala', copied:'Kopyalandı', failed:'Kopyalanamadı', recent:'Son kullanılan komutlar', clear:'Geçmişi temizle', empty:'Henüz komut açmadın.'},
    en: {copy:'Copy', copied:'Copied', failed:'Copy failed', recent:'Recently viewed commands', clear:'Clear history', empty:'No commands viewed yet.'},
    ar: {copy:'نسخ', copied:'تم النسخ', failed:'تعذر النسخ', recent:'الأوامر التي شاهدتها مؤخراً', clear:'مسح السجل', empty:'لم تفتح أي أوامر بعد.'}
  };
  var tx = words[lang] || words.en;
  var key = 'netcmd.recent.v1';
  function read() { try { var v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v.slice(0, 12) : []; } catch (e) { return []; } }
  function write(v) { try { localStorage.setItem(key, JSON.stringify(v.slice(0, 12))); } catch (e) {} }
  function slugFrom(url) {
    var m = /\/(?:tr|en|ar)\/cmd\/([^/]+)\/?(?:[?#].*)?$/.exec(url || '');
    return m ? m[1] : '';
  }
  function record(slug, title) {
    if (!slug) return;
    var a = read().filter(function (x) { return x && x.slug !== slug; });
    a.unshift({slug: slug, title: String(title || slug).slice(0, 140), at: Date.now()});
    write(a);
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var slug = slugFrom(a.getAttribute('href'));
    if (slug) record(slug, a.textContent.trim());
  });

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); }
      catch (err) { reject(err); }
      ta.remove();
    });
  }
  document.querySelectorAll('main pre').forEach(function (pre) {
    if (pre.querySelector('.nc-copy')) return;
    var code = pre.querySelector('code') || pre;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'hbtn nc-copy'; btn.textContent = tx.copy;
    btn.style.cssText = 'float:inline-end;position:relative;z-index:1;margin:6px 8px 0 0';
    btn.addEventListener('click', function () {
      copyText(code.innerText || code.textContent || '').then(function () {
        btn.textContent = tx.copied; btn.setAttribute('aria-live', 'polite');
        setTimeout(function () { btn.textContent = tx.copy; }, 1400);
      }).catch(function () { btn.textContent = tx.failed; setTimeout(function () { btn.textContent = tx.copy; }, 1600); });
    });
    pre.insertBefore(btn, pre.firstChild);
  });

  var currentSlug = slugFrom(location.pathname);
  if (currentSlug) { var currentTitle = (document.querySelector('main h1') || {}).textContent || currentSlug; record(currentSlug, currentTitle.trim()); }

  var main = document.querySelector('main');
  if (main && /^\/(tr|en|ar)\/$/.test(location.pathname)) {
    var history = read();
    var section = document.createElement('section');
    section.className = 'nc-recent';
    section.style.cssText = 'margin:18px 0;padding:12px 14px;border:1px solid var(--bd);border-radius:10px;background:var(--card)';
    var heading = document.createElement('div');
    heading.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between';
    var h = document.createElement('h2'); h.textContent = tx.recent; h.style.margin = '0';
    var clear = document.createElement('button'); clear.type = 'button'; clear.className = 'hbtn'; clear.textContent = tx.clear;
    heading.appendChild(h); heading.appendChild(clear); section.appendChild(heading);
    var list = document.createElement('ul'); list.className = 'cl';
    if (!history.length) { var empty = document.createElement('li'); empty.textContent = tx.empty; list.appendChild(empty); }
    history.forEach(function (item) {
      if (!item || !item.slug) return;
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = '/' + lang + '/cmd/' + encodeURIComponent(item.slug) + '/';
      a.textContent = item.title || item.slug; li.appendChild(a); list.appendChild(li);
    });
    section.appendChild(list);
    clear.addEventListener('click', function () { write([]); list.textContent = ''; var li = document.createElement('li'); li.textContent = tx.empty; list.appendChild(li); });
    main.insertBefore(section, main.firstChild);
  }
})();
