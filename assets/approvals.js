/* NetCmd admin approval center. The Edge Function is the authorization boundary. */
(function () {
  'use strict';
  var C = window.NETCMD_APPROVALS;
  var root = document.getElementById('approval-center');
  var list = document.getElementById('approval-list');
  var msg = document.getElementById('approval-msg');
  if (!C || !root || !list || !window.supabase) return;
  var sb;
  try { sb = window.supabase.createClient(C.url, C.key); } catch (_) { return; }
  var labels = C.labels || {};
  function show(text, ok) {
    msg.textContent = text;
    msg.className = 'msg ' + (ok ? 'ok' : 'err');
    msg.hidden = false;
  }
  function el(tag, text, cls) {
    var node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (cls) node.className = cls;
    return node;
  }
  function date(value) {
    try { return new Date(value).toLocaleString(C.lang === 'tr' ? 'tr-TR' : (C.lang === 'ar' ? 'ar' : 'en-GB')); }
    catch (_) { return value || '—'; }
  }
  function render(rows, session) {
    list.replaceChildren();
    if (!rows.length) { list.appendChild(el('p', labels.approval_empty)); return; }
    rows.forEach(function (item) {
      var card = el('article', null, 'card');
      var head = el('div', null, 'row');
      head.appendChild(el('strong', '#' + item.id));
      head.appendChild(el('span', labels.approval_pending, 'tag'));
      card.appendChild(head);
      var table = document.createElement('div');
      table.className = 'tablewrap';
      var details = document.createElement('table');
      [
        [labels.approval_user, item.user_id],
        [labels.approval_ref, item.reference],
        [labels.approval_date, date(item.created_at)]
      ].forEach(function (pair) {
        var tr = document.createElement('tr');
        tr.appendChild(el('th', pair[0]));
        tr.appendChild(el('td', pair[1]));
        details.appendChild(tr);
      });
      table.appendChild(details); card.appendChild(table);
      var noteLabel = el('label', labels.approval_note);
      var note = document.createElement('textarea'); note.rows = 2; note.maxLength = 500;
      noteLabel.appendChild(note); card.appendChild(noteLabel);
      var actions = el('div', null, 'row');
      var daysLabel = el('label', labels.approval_days);
      var days = document.createElement('input'); days.type = 'number'; days.min = '1'; days.max = '1095'; days.value = '30'; days.style.maxWidth = '120px';
      daysLabel.appendChild(days); actions.appendChild(daysLabel);
      var approve = el('button', labels.approval_approve, 'btn');
      var reject = el('button', labels.approval_reject, 'btn sec');
      function decide(action) {
        if (!window.confirm(labels.approval_confirm)) return;
        approve.disabled = reject.disabled = true;
        show(labels.approval_working, true);
        fetch(C.api, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + session.access_token, 'apikey': C.key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action, request_id: item.id, days: Number(days.value), note: note.value })
        }).then(function (r) {
          return r.json().then(function (data) { if (!r.ok) throw new Error(data.error || 'request_failed'); return data; });
        }).then(function (data) {
          if (!data || !data.success) throw new Error(data && data.error || 'request_failed');
          show(labels.approval_done, true);
          load();
        }).catch(function (err) {
          approve.disabled = reject.disabled = false;
          show(err.message === 'not_authorized' ? labels.approval_denied : labels.approval_load_error, false);
        });
      }
      approve.addEventListener('click', function () { decide('approve'); });
      reject.addEventListener('click', function () { decide('reject'); });
      actions.appendChild(approve); actions.appendChild(reject); card.appendChild(actions);
      list.appendChild(card);
    });
  }
  var activeSession;
  function load() {
    if (!activeSession) return;
    fetch(C.api, { headers: { 'Authorization': 'Bearer ' + activeSession.access_token, 'apikey': C.key } })
      .then(function (r) {
        return r.json().then(function (data) {
          if (r.status === 403) { root.hidden = true; return null; }
          if (!r.ok) throw new Error(data.error || 'load_failed');
          return data;
        });
      })
      .then(function (data) {
        if (!data) return;
        root.hidden = false; msg.hidden = true;
        render(data.requests || [], activeSession);
      })
      .catch(function () { show(labels.approval_load_error, false); });
  }
  sb.auth.getSession().then(function (r) {
    activeSession = r.data && r.data.session;
    if (activeSession) load();
  });
  sb.auth.onAuthStateChange(function (_event, session) {
    activeSession = session;
    if (session) load(); else root.hidden = true;
  });
})();