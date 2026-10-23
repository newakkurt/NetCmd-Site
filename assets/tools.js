/* NetCmd araçları: tüm işlem tarayıcıda yapılır, hiçbir veri sunucuya gönderilmez. */
(function () {
  'use strict';
  var NL = window.NetLib;
  var app = document.getElementById('app');
  var dataEl = document.getElementById('tool-data');
  if (!app || !dataEl || !NL) return;
  var D = JSON.parse(dataEl.textContent);
  var T = D.t;
  var tool = app.getAttribute('data-tool');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function fmt(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }
  function code(text) { return '<pre dir="ltr"><code>' + esc(text) + '</code></pre>'; }

  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function bindCopy(btn, getText) {
    btn.addEventListener('click', function () {
      var old = btn.textContent;
      var done = function () { btn.textContent = T.t_copied; setTimeout(function () { btn.textContent = old; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(getText()).then(done);
    });
  }
  function actions(prefix, name) {
    return '<p class="row"><button class="btn sec" type="button" id="' + prefix + '-copy">' + esc(T.t_copy) + '</button> ' +
      '<button class="btn sec" type="button" id="' + prefix + '-dl" data-name="' + esc(name) + '">' + esc(T.t_download) + '</button></p>';
  }
  function wireActions(prefix, getText) {
    bindCopy($(prefix + '-copy'), getText);
    $(prefix + '-dl').addEventListener('click', function () { download($(prefix + '-dl').getAttribute('data-name'), getText()); });
  }
  function vendorSelect(id, withAll) {
    return '<select id="' + id + '">' + (withAll ? '<option value="all">' + esc(T.t_lab_vendor_all) + '</option>' : '') +
      '<option value="cisco">Cisco IOS</option><option value="huawei">Huawei VRP</option><option value="aruba">Aruba</option></select>';
  }

  /* ---------- 1) Komut laboratuvarı ---------- */
  function initLab() {
    var S = D.scenarios;
    app.innerHTML =
      '<p class="note">' + esc(T.t_lab_note) + '</p>' +
      '<div class="row"><label for="lab-v">' + esc(T.t_vendor) + '</label>' + vendorSelect('lab-v', true) +
      '<label for="lab-s">' + esc(T.t_lab_pick) + '</label><select id="lab-s"></select></div>' +
      '<div id="lab-body"></div>';
    var vSel = $('lab-v'), sSel = $('lab-s'), body = $('lab-body');
    function fillList() {
      var v = vSel.value, html = '';
      S.forEach(function (s, i) { if (v === 'all' || s.vendor === v) html += '<option value="' + i + '">' + esc(s.title) + '</option>'; });
      sSel.innerHTML = html;
      show();
    }
    function show() {
      if (sSel.value === '') { body.innerHTML = ''; return; }
      var s = S[parseInt(sSel.value, 10)];
      body.innerHTML =
        '<div class="vend"><h3>' + esc(s.vendor) + ' <small>' + esc(T.t_lab_cmd) + '</small></h3>' + code(s.cmd + '\n' + s.output) + '</div>' +
        '<h2>' + esc(T.t_lab_question) + '</h2><p>' + esc(s.question) + '</p>' +
        '<label for="lab-my">' + esc(T.t_lab_your) + '</label><textarea id="lab-my" rows="3"></textarea>' +
        '<p class="row"><button class="btn" type="button" id="lab-show">' + esc(T.t_lab_show) + '</button></p>' +
        '<div class="note" id="lab-ans" hidden><strong>' + esc(T.t_lab_answer) + '</strong><br>' + esc(s.answer).replace(/\n/g, '<br>') + '</div>';
      $('lab-show').addEventListener('click', function () {
        var a = $('lab-ans'); a.hidden = !a.hidden;
        this.textContent = a.hidden ? T.t_lab_show : T.t_lab_hide;
      });
    }
    vSel.addEventListener('change', fillList);
    sSel.addEventListener('change', show);
    fillList();
  }

  /* ---------- 2) Ansible / Netmiko üreticisi ---------- */
  function initGenerator() {
    app.innerHTML =
      '<p class="note">' + esc(T.t_gen_readonly_note) + '</p>' +
      '<div class="row"><label for="g-fmt">' + esc(T.t_gen_format) + '</label>' +
      '<select id="g-fmt"><option value="netmiko">Python (Netmiko)</option><option value="ansible">Ansible</option></select>' +
      '<label for="g-plat">' + esc(T.t_gen_platform) + '</label>' +
      '<select id="g-plat"><option value="cisco">Cisco IOS / IOS-XE</option><option value="huawei">Huawei VRP</option>' +
      '<option value="aruba_s">Aruba AOS-S</option><option value="aruba_cx">Aruba AOS-CX</option></select></div>' +
      '<label for="g-hosts">' + esc(T.t_gen_hosts) + '</label><textarea id="g-hosts" rows="4" dir="ltr" placeholder="' + esc(T.t_gen_hosts_ph) + '"></textarea>' +
      '<h2>' + esc(T.t_gen_checks) + '</h2><div id="g-checks" class="checks" dir="ltr"></div>' +
      '<label for="g-custom">' + esc(T.t_gen_custom) + '</label><textarea id="g-custom" rows="3" dir="ltr" placeholder="' + esc(T.t_gen_custom_ph) + '"></textarea>' +
      '<p class="lead">' + esc(T.t_gen_creds) + '</p>' +
      '<p><button class="btn" type="button" id="g-go">' + esc(T.t_gen_generate) + '</button></p>' +
      '<div id="g-msg" class="msg" hidden></div><div id="g-out"></div>';
    var plat = $('g-plat'), checks = $('g-checks'), msg = $('g-msg'), out = $('g-out');

    function family() { return NL.PLATFORMS[plat.value].family; }
    function drawChecks() {
      var list = NL.CHECKS[family()], html = '';
      list.forEach(function (c, i) {
        html += '<label class="chk"><input type="checkbox" value="' + esc(c) + '"' + (i < 6 ? ' checked' : '') + '> ' + esc(c) + '</label>';
      });
      checks.innerHTML = html;
    }
    function setMsg(t, ok) { msg.textContent = t; msg.className = 'msg ' + (ok ? 'ok' : 'err'); msg.hidden = !t; }
    plat.addEventListener('change', drawChecks);
    drawChecks();

    $('g-go').addEventListener('click', function () {
      out.innerHTML = ''; setMsg('', true);
      var fmtSel = $('g-fmt').value, p = plat.value, P = NL.PLATFORMS[p];
      if (fmtSel === 'netmiko' && !P.netmiko) { setMsg(T.t_gen_aoscx_note, false); return; }
      if (fmtSel === 'ansible' && !P.ansibleOs) { setMsg(T.t_gen_aoss_note, false); return; }
      var hosts = $('g-hosts').value.split(/[\s,;]+/).filter(Boolean)
        .filter(function (h) { return /^[A-Za-z0-9][A-Za-z0-9._:\-]*$/.test(h); });
      if (!hosts.length) { setMsg(T.t_gen_no_hosts, false); return; }
      var cmds = [].slice.call(checks.querySelectorAll('input:checked')).map(function (i) { return i.value; });
      var rejected = [];
      $('g-custom').value.split(/\r?\n/).forEach(function (l) {
        var t = l.trim(); if (!t) return;
        if (NL.classify(family(), t).kind === 'read') { if (cmds.indexOf(t) < 0) cmds.push(t); } else rejected.push(t);
      });
      if (!cmds.length) { setMsg(T.t_gen_no_checks, false); return; }
      var html = '';
      if (rejected.length) html += '<div class="msg err">' + esc(T.t_gen_rejected) + '<br><code dir="ltr">' + esc(rejected.join(' | ')) + '</code></div>';
      if (fmtSel === 'netmiko') {
        var py = NL.buildNetmiko(p, hosts, cmds);
        html += '<h2>' + esc(T.t_gen_script) + ' <small>collect.py</small></h2>' + actions('o1', 'collect.py') + code(py) +
          '<p class="lead">' + esc(T.t_gen_run_nm) + '</p>' + code('pip install netmiko\nexport NET_USER=...\nexport NET_PASS=...\npython3 collect.py');
        out.innerHTML = html;
        wireActions('o1', function () { return py; });
      } else {
        var an = NL.buildAnsible(p, hosts, cmds);
        html += '<h2>' + esc(T.t_gen_inventory) + ' <small>inventory.yml</small></h2>' + actions('o1', 'inventory.yml') + code(an.inventory) +
          '<h2>' + esc(T.t_gen_playbook) + ' <small>playbook.yml</small></h2>' + actions('o2', 'playbook.yml') + code(an.playbook) +
          '<p class="lead">' + esc(T.t_gen_run_an) + '</p>' + code('export NET_USER=...\nexport NET_PASS=...\nansible-playbook -i inventory.yml playbook.yml');
        out.innerHTML = html;
        wireActions('o1', function () { return an.inventory; });
        wireActions('o2', function () { return an.playbook; });
      }
      out.insertAdjacentHTML('beforeend', '<div class="note">' + esc(T.t_gen_verify) + '</div>');
    });
  }

  /* ---------- 3) Güvenli değişiklik kontrolü ---------- */
  function initSafe() {
    app.innerHTML =
      '<div class="row"><label for="s-v">' + esc(T.t_vendor) + '</label>' + vendorSelect('s-v', false) + '</div>' +
      '<label for="s-in">' + esc(T.t_safe_input) + '</label>' +
      '<textarea id="s-in" rows="9" dir="ltr" placeholder="' + esc(T.t_safe_input_ph) + '"></textarea>' +
      '<p><button class="btn" type="button" id="s-go">' + esc(T.t_safe_analyze) + '</button></p><div id="s-out"></div>';
    $('s-go').addEventListener('click', function () {
      var v = $('s-v').value, a = NL.analyzeChange(v, $('s-in').value), out = $('s-out');
      if (!a.rows.length) { out.innerHTML = ''; return; }
      var c = a.counts;
      var html = '<div class="msg ' + (a.changing ? 'err' : 'ok') + '">' +
        esc(a.changing ? T.t_safe_changes : T.t_safe_readonly) + '</div>' +
        '<p>' + esc(fmt(T.t_safe_summary, { n: c.total, r: c.read, c: c.config, d: c.danger, s: c.state })) + '</p>';
      html += '<table><tr><th>' + esc(T.t_safe_col_cmd) + '</th><th>' + esc(T.t_safe_col_kind) + '</th><th>' + esc(T.t_safe_col_risk) +
        '</th><th>' + esc(T.t_safe_col_rb) + '</th><th>' + esc(T.t_safe_col_note) + '</th></tr>';
      a.rows.forEach(function (r) {
        var notes = r.notes.map(function (n) { return T['t_note_' + n] || n; }).join(' ');
        html += '<tr><td><code dir="ltr">' + esc(r.cmd) + '</code></td><td>' + esc(T['t_kind_' + r.kind]) + '</td>' +
          '<td><span class="risk risk-' + r.risk + '">' + esc(T['t_risk_' + r.risk]) + '</span></td>' +
          '<td>' + (r.rollback ? '<code dir="ltr">' + esc(r.rollback) + '</code>' : '—') + '</td><td>' + esc(notes) + '</td></tr>';
      });
      html += '</table>';
      if (a.changing) {
        var pre = NL.precheckCommands(v).join('\n');
        var rb = a.rollback.length ? a.rollback.join('\n') : '—';
        html += '<h2>' + esc(T.t_cl_title) + '</h2><div class="grid">' +
          card(T.t_cl_pre, [T.t_cl_pre1, T.t_cl_pre2, T.t_cl_pre3]) +
          card(T.t_cl_approval, [T.t_cl_ap1, T.t_cl_ap2]) +
          card(T.t_cl_backup, [T.t_cl_bk1, T.t_cl_bk2]) +
          card(T.t_cl_rollback, [T.t_cl_rb1, T.t_cl_rb2]) +
          card(T.t_cl_post, [T.t_cl_po1, T.t_cl_po2, T.t_cl_po3]) + '</div>' +
          '<h2>' + esc(T.t_cl_backupcmd) + '</h2>' + code(NL.backupCommand(v)) +
          '<h2>' + esc(T.t_cl_precmds) + '</h2>' + code(pre) +
          '<h2>' + esc(T.t_cl_rbcmds) + '</h2>' + code(rb) +
          '<div class="note">' + esc(T.t_note_rollback_approx) + '</div>';
      }
      out.innerHTML = html;
    });
    function card(title, items) {
      return '<div class="card"><strong>' + esc(title) + '</strong><ul class="cl">' +
        items.map(function (i) { return '<li><label><input type="checkbox"> ' + esc(i) + '</label></li>'; }).join('') + '</ul></div>';
    }
  }

  /* ---------- 4) Config karşılaştırma ---------- */
  function diffSummaryHtml(res) {
    var cats = ['vlan', 'trunk', 'acl', 'port', 'other'], html = '';
    if (!res.changes.length) return '<div class="msg ok">' + esc(T.t_diff_nochange) + '</div>';
    html += '<p>' + cats.map(function (k) {
      return '<span class="tag">' + esc(T['t_diff_cat_' + k]) + ': ' + res.counts[k] + '</span>';
    }).join(' ') + '</p>';
    cats.forEach(function (k) {
      var list = res.changes.filter(function (c) { return c.category === k; });
      if (!list.length) return;
      html += '<h3>' + esc(T['t_diff_cat_' + k]) + '</h3>';
      list.forEach(function (c) {
        html += '<div class="vend"><h3><span dir="ltr">' + esc(c.key) + '</span> <small>' + esc(T['t_diff_' + c.status]) + '</small></h3><pre dir="ltr">';
        c.removed.forEach(function (l) { html += '<span class="del">- ' + esc(l) + '</span>\n'; });
        c.added.forEach(function (l) { html += '<span class="add">+ ' + esc(l) + '</span>\n'; });
        if (!c.removed.length && !c.added.length) html += ' ';
        html += '</pre></div>';
      });
    });
    return html;
  }
  function rawDiffHtml(a, b) {
    var d = NL.lineDiff(a, b), keep = {}, out = [], i;
    d.forEach(function (x, idx) {
      if (x.t !== ' ') for (i = Math.max(0, idx - 2); i <= Math.min(d.length - 1, idx + 2); i++) keep[i] = true;
    });
    var last = -2;
    d.forEach(function (x, idx) {
      if (!keep[idx]) return;
      if (idx !== last + 1) out.push('<span class="sep">…</span>');
      var cls = x.t === '+' ? 'add' : (x.t === '-' ? 'del' : '');
      out.push('<span class="' + cls + '">' + esc(x.t + ' ' + x.s) + '</span>');
      last = idx;
    });
    return '<pre dir="ltr">' + (out.join('\n') || ' ') + '</pre>';
  }
  function initDiff() {
    app.innerHTML =
      '<div class="two"><div><label for="d-old">' + esc(T.t_diff_old) + '</label><textarea id="d-old" rows="12" dir="ltr"></textarea></div>' +
      '<div><label for="d-new">' + esc(T.t_diff_new) + '</label><textarea id="d-new" rows="12" dir="ltr"></textarea></div></div>' +
      '<p><button class="btn" type="button" id="d-go">' + esc(T.t_diff_run) + '</button></p><div id="d-out"></div>';
    $('d-go').addEventListener('click', function () {
      var a = $('d-old').value, b = $('d-new').value;
      var res = NL.diffConfigs(a, b);
      $('d-out').innerHTML = '<h2>' + esc(T.t_diff_summary) + '</h2>' + diffSummaryHtml(res) +
        '<details><summary>' + esc(T.t_diff_raw) + '</summary>' + rawDiffHtml(a, b) + '</details>';
    });
  }

  /* ---------- 5) Otomatik ağ raporu ---------- */
  function initReport() {
    function area(id, label, ph, rows) {
      return '<label for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '" rows="' + (rows || 6) + '" dir="ltr" placeholder="' + esc(ph || '') + '"></textarea>';
    }
    app.innerHTML =
      area('r-reach', T.t_rep_reach, T.t_rep_reach_ph) + area('r-ports', T.t_rep_ports, T.t_rep_ports_ph) +
      area('r-err', T.t_rep_errors, T.t_rep_errors_ph) +
      '<div class="two"><div>' + area('r-old', T.t_rep_old, '', 6) + '</div><div>' + area('r-new', T.t_rep_new, '', 6) + '</div></div>' +
      '<p><button class="btn" type="button" id="r-go">' + esc(T.t_rep_gen) + '</button></p><div id="r-out"></div>';

    $('r-go').addEventListener('click', function () {
      var reach = NL.parseReachability($('r-reach').value.trim() ? $('r-reach').value : '');
      var ports = NL.parsePortStatus($('r-ports').value);
      var errs = NL.parseErrors($('r-err').value);
      var hasCfg = $('r-old').value.trim() && $('r-new').value.trim();
      var cfg = hasCfg ? NL.diffConfigs($('r-old').value, $('r-new').value) : null;
      var md = [], html = '', attention = false;
      var now = new Date().toISOString().replace('T', ' ').slice(0, 16);
      md.push('# ' + T.t_rep_title, '', T.t_rep_generated + ': ' + now, '');

      // erişilebilirlik
      html += '<h2>' + esc(T.t_rep_s_reach) + '</h2>'; md.push('## ' + T.t_rep_s_reach, '');
      if (!reach.length) { html += '<p class="lead">' + esc(T.t_rep_nodata) + '</p>'; md.push(T.t_rep_nodata, ''); }
      else {
        html += '<table><tr><th>' + esc(T.t_rep_host) + '</th><th>' + esc(T.t_rep_loss) + '</th><th>' + esc(T.t_rep_status) + '</th></tr>';
        md.push('| ' + T.t_rep_host + ' | ' + T.t_rep_loss + ' | ' + T.t_rep_status + ' |', '|---|---|---|');
        reach.forEach(function (r) {
          if (r.status !== 'up') attention = true;
          var loss = r.loss === null ? '—' : r.loss + '%';
          html += '<tr><td dir="ltr">' + esc(r.host) + '</td><td>' + esc(loss) + '</td><td><span class="risk risk-' + (r.status === 'up' ? 'none' : (r.status === 'degraded' ? 'medium' : 'high')) + '">' + esc(T['t_rep_' + r.status]) + '</span></td></tr>';
          md.push('| ' + r.host + ' | ' + loss + ' | ' + T['t_rep_' + r.status] + ' |');
        });
        html += '</table>'; md.push('');
      }

      // port durumu
      html += '<h2>' + esc(T.t_rep_s_ports) + '</h2>'; md.push('## ' + T.t_rep_s_ports, '');
      if (!ports.counts.total) { html += '<p class="lead">' + esc(T.t_rep_nodata) + '</p>'; md.push(T.t_rep_nodata, ''); }
      else {
        var pc = ports.counts;
        var line = T.t_rep_total + ': ' + pc.total + ' · ' + T.t_rep_connected + ': ' + pc.connected + ' · ' + T.t_rep_notconnect + ': ' + pc.notconnect +
          ' · ' + T.t_rep_disabled + ': ' + pc.disabled + ' · ' + T.t_rep_errdisabled + ': ' + pc.errdisabled;
        html += '<p>' + esc(line) + '</p>'; md.push(line, '');
        if (pc.errdisabled) {
          attention = true;
          var names = ports.ports.filter(function (p) { return p.state === 'errdisabled'; }).map(function (p) { return p.name; }).join(', ');
          html += '<div class="msg err">' + esc(T.t_rep_errdisabled + ': ' + names) + '</div>'; md.push('**' + T.t_rep_errdisabled + ':** ' + names, '');
        }
      }

      // hata sayaçları
      html += '<h2>' + esc(T.t_rep_s_err) + '</h2>'; md.push('## ' + T.t_rep_s_err, '');
      if (!$('r-err').value.trim()) { html += '<p class="lead">' + esc(T.t_rep_nodata) + '</p>'; md.push(T.t_rep_nodata, ''); }
      else if (!errs.length) { html += '<div class="msg ok">' + esc(T.t_rep_noerrors) + '</div>'; md.push(T.t_rep_noerrors, ''); }
      else {
        attention = true;
        html += '<table><tr><th>' + esc(T.t_rep_iface) + '</th><th>' + esc(T.t_rep_errs) + '</th></tr>';
        md.push('| ' + T.t_rep_iface + ' | ' + T.t_rep_errs + ' |', '|---|---|');
        errs.slice(0, 15).forEach(function (e) {
          html += '<tr><td dir="ltr">' + esc(e.name) + '</td><td>' + e.errors + '</td></tr>';
          md.push('| ' + e.name + ' | ' + e.errors + ' |');
        });
        html += '</table>'; md.push('');
      }

      // config farkları
      html += '<h2>' + esc(T.t_rep_s_cfg) + '</h2>'; md.push('## ' + T.t_rep_s_cfg, '');
      if (!cfg) { html += '<p class="lead">' + esc(T.t_rep_nodata) + '</p>'; md.push(T.t_rep_nodata, ''); }
      else if (!cfg.changes.length) { html += '<div class="msg ok">' + esc(T.t_diff_nochange) + '</div>'; md.push(T.t_diff_nochange, ''); }
      else {
        attention = true;
        html += diffSummaryHtml(cfg);
        ['vlan', 'trunk', 'acl', 'port', 'other'].forEach(function (k) {
          var list = cfg.changes.filter(function (c) { return c.category === k; });
          if (!list.length) return;
          md.push('### ' + T['t_diff_cat_' + k], '');
          list.forEach(function (c) {
            md.push('- `' + c.key + '` (' + T['t_diff_' + c.status] + ')');
            c.removed.forEach(function (l) { md.push('  - `- ' + l + '`'); });
            c.added.forEach(function (l) { md.push('  - `+ ' + l + '`'); });
          });
          md.push('');
        });
      }

      var overall = attention ? T.t_rep_overall_attn : T.t_rep_overall_ok;
      html = '<div class="msg ' + (attention ? 'err' : 'ok') + '"><strong>' + esc(overall) + '</strong></div>' + html;
      md.splice(4, 0, '**' + overall + '**', '');
      var mdText = md.join('\n');
      $('r-out').innerHTML = '<h2>' + esc(T.t_rep_title) + '</h2>' + html +
        '<p class="row"><button class="btn sec" type="button" id="r-copy">' + esc(T.t_rep_md) + '</button> ' +
        '<button class="btn sec" type="button" id="r-dl">' + esc(T.t_download) + ' (.md)</button> ' +
        '<button class="btn sec" type="button" id="r-print">' + esc(T.t_rep_print) + '</button></p>';
      bindCopy($('r-copy'), function () { return mdText; });
      $('r-dl').addEventListener('click', function () { download('network-report.md', mdText); });
      $('r-print').addEventListener('click', function () { window.print(); });
    });
  }

  var inits = { lab: initLab, generator: initGenerator, safe: initSafe, diff: initDiff, report: initReport };
  if (inits[tool]) inits[tool]();
})();
