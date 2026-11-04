/* NetCmd bekleme listesi: e-posta + ürün + dil, Supabase REST (yalnızca insert izni; bkz. supabase/waitlist.sql). */
(function () {
  'use strict';
  var d = document.getElementById('wl-data');
  var f = document.getElementById('wl-form');
  if (!d || !f) return;
  var C;
  try { C = JSON.parse(d.textContent); } catch (e) { return; }
  var msg = document.getElementById('wl-msg');
  var input = document.getElementById('wl-email');
  var busy = false;

  function show(text, ok) {
    msg.className = 'msg ' + (ok ? 'ok' : 'err');
    msg.textContent = text;
  }

  f.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (busy) return;
    var email = String(input.value || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) { show(C.err, false); return; }
    if (!C.url || !C.key) { show(C.err, false); return; }
    busy = true;
    fetch(C.url + '/rest/v1/waitlist', {
      method: 'POST',
      headers: { apikey: C.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email: email, product: C.product || 'all', lang: C.lang || 'tr' })
    }).then(function (r) {
      // 409 = bu e-posta bu ürün için zaten kayıtlı; kullanıcı açısından başarı
      if (r.ok || r.status === 409) { show(C.ok, true); input.value = ''; }
      else show(C.err, false);
    }).catch(function () { show(C.err, false); }).then(function () { busy = false; });
  });
})();
