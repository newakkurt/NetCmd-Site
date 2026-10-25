/* Topluluk komutları: onaylı listeyi gösterir, giriş yapmış kullanıcıdan öneri alır. Tüm içerik textContent ile basılır (XSS yok). */
(function () {
  'use strict';
  var C = JSON.parse(document.getElementById('com-cfg').textContent);
  var msg = document.getElementById('com-msg'), form = document.getElementById('com-form'), loginP = document.getElementById('com-login'), list = document.getElementById('com-list');
  function show(t, ok) { msg.textContent = t; msg.className = 'msg ' + (ok ? 'ok' : 'err'); msg.hidden = false; }
  if (!C.url || !C.key || !window.supabase) { show(C.t.com_unavail, false); return; }
  var sb = window.supabase.createClient(C.url, C.key);
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }

  function loadList() {
    sb.from('community_commands').select('id,title,vendor,commands,description,created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(100)
      .then(function (r) {
        list.textContent = '';
        if (r.error) { show(C.t.com_unavail, false); return; }
        if (!r.data || !r.data.length) { list.appendChild(el('p', 'lead', C.t.com_empty)); return; }
        r.data.forEach(function (d) {
          var box = el('div', 'com-item');
          var h = el('h3', '', d.title); box.appendChild(h);
          box.appendChild(el('span', 'tag', C.v[d.vendor] || d.vendor));
          box.appendChild(el('pre', '', d.commands));
          if (d.description) box.appendChild(el('p', '', d.description));
          var b = el('button', 'btn sec', C.t.com_copy); b.type = 'button';
          b.addEventListener('click', function () { if (navigator.clipboard) navigator.clipboard.writeText(d.commands).then(function () { var o = b.textContent; b.textContent = C.t.com_copied; setTimeout(function () { b.textContent = o; }, 1200); }); });
          box.appendChild(b); list.appendChild(box);
        });
      });
  }
  sb.auth.getSession().then(function (r) {
    var s = r.data && r.data.session;
    if (s) { form.hidden = false; } else { loginP.hidden = false; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('c-btn'); btn.disabled = true; msg.hidden = true;
      sb.from('community_commands').insert({
        user_id: s.user.id,
        title: document.getElementById('c-title').value.trim().slice(0, 120),
        vendor: document.getElementById('c-vendor').value,
        commands: document.getElementById('c-cmds').value.trim().slice(0, 2000),
        description: document.getElementById('c-desc').value.trim().slice(0, 600)
      }).then(function (x) {
        btn.disabled = false;
        if (x.error) { show(C.t.com_err, false); return; }
        show(C.t.com_ok, true); form.reset();
      });
    });
  });
  loadList();
})();
