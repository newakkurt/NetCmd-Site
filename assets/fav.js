/* Komut favorileri (Premium üyelere). Plan bilgisi Supabase'den okunur ve 12 saat önbelleğe alınır.
   Not: bu özellik yalnızca kullanım kolaylığıdır; veriler yalnızca bu tarayıcıda (localStorage) tutulur. */
(function () {
  'use strict';
  var me = document.currentScript;
  var URL_ = me && me.getAttribute('data-url'), KEY = me && me.getAttribute('data-key');
  var L = { tr: { fav: 'Favoriler', add: 'Favorilere ekle', del: 'Favoriden çıkar' }, en: { fav: 'Favorites', add: 'Add to favorites', del: 'Remove from favorites' }, ar: { fav: 'المفضلة', add: 'أضف إلى المفضلة', del: 'أزل من المفضلة' } };
  var lang = (document.documentElement.lang || 'tr').slice(0, 2);
  var TX = L[lang] || L.tr;
  function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* kapalı */ } }
  function hasSession() {
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^sb-.*-auth-token$/.test(k)) return true; } } catch (e) { return false; }
    return false;
  }
  function checkPlan(cb) {
    var c = get('netcmd.plan');
    if (c && Date.now() - c.t < 12 * 3600 * 1000) { cb(!!c.p); return; }
    if (!hasSession() || !URL_ || !KEY) { set('netcmd.plan', { p: false, t: Date.now() }); cb(false); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = function () {
      var sb = window.supabase.createClient(URL_, KEY);
      sb.auth.getSession().then(function (r) {
        var ses = r.data && r.data.session;
        if (!ses) { set('netcmd.plan', { p: false, t: Date.now() }); cb(false); return; }
        sb.from('profiles').select('is_premium,premium_until').eq('id', ses.user.id).maybeSingle().then(function (p) {
          var d = p.data || {};
          var ok = !!d.is_premium && (!d.premium_until || new Date(d.premium_until) > new Date());
          set('netcmd.plan', { p: ok, t: Date.now() }); cb(ok);
        });
      }).catch(function () { cb(false); });
    };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }
  function favs() { return get('netcmd.favs') || []; }
  function toggle(slug) {
    var f = favs(), i = f.indexOf(slug);
    if (i === -1) f.push(slug); else f.splice(i, 1);
    set('netcmd.favs', f);
    return i === -1;
  }
  function slugOf(a) { var m = /\/cmd\/([^\/]+)\/?$/.exec(a.getAttribute('href') || ''); return m && m[1]; }
  function starBtn(slug) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fav';
    function paint() { var on = favs().indexOf(slug) !== -1; b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.title = on ? TX.del : TX.add; b.setAttribute('aria-label', b.title); }
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggle(slug); paint(); refresh(); });
    paint();
    return b;
  }
  var chip = null;
  function refresh() {
    var cards = document.querySelectorAll('.cmd-card');
    var f = favs();
    cards.forEach(function (c) { var a = c.querySelector('a'); var sl = a && slugOf(a); c.setAttribute('data-fav', sl && f.indexOf(sl) !== -1 ? '1' : '0'); });
    if (chip) chip.textContent = '★ ' + TX.fav + ' (' + f.length + ')';
    var q = document.getElementById('q');
    if (q) q.dispatchEvent(new Event('input'));
  }
  function init() {
    var cards = document.querySelectorAll('.cmd-card');
    cards.forEach(function (c) { var a = c.querySelector('a'); var sl = a && slugOf(a); if (sl) c.appendChild(starBtn(sl)); });
    var chips = document.querySelector('p.chips');
    if (cards.length && chips) {
      chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'tag chip favchip'; chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', function () { window.__favOnly = !window.__favOnly; chip.setAttribute('aria-pressed', window.__favOnly ? 'true' : 'false'); refresh(); });
      chips.insertBefore(chip, chips.firstChild);
    }
    var m = /\/cmd\/([^\/]+)\/$/.exec(location.pathname);
    var h1 = document.querySelector('main h1');
    if (m && h1) h1.appendChild(starBtn(m[1]));
    refresh();
  }
  checkPlan(function (ok) { if (ok) init(); });
})();
