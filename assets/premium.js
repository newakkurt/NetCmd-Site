/* NetCmd Premium arayüzü. Üyelik durumu Supabase'den okunur; analiz tarayıcıda yapılır.
   NOT: Premium kapısı istemci tarafındadır (statik site); amaç ücretli özellikleri üyelere ayırmaktır, DRM değildir. */
(function () {
  'use strict';
  var P = window.PLib;
  var dataEl = document.getElementById('tool-data');
  var app = document.getElementById('app');
  if (!dataEl || !app || !P) return;
  var D = JSON.parse(dataEl.textContent);
  var T = D.t, C = D.cfg || {};
  var tool = app.getAttribute('data-tool');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function $(id) { return document.getElementById(id); }
  function fmt(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k] === undefined ? '' : o[k]; }); }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function store(key, val) {
    try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* kapalı olabilir */ }
    return null;
  }
  function sevCell(s) { return '<span class="risk risk-' + s + '">' + esc(T['p_sev_' + s]) + '</span>'; }

  /* ---------- Premium modülü: yalnızca Premium üyeye Supabase'den verilir (RLS) ---------- */
  function loadPro(plan, cb) {
    if (P.PREMIUM_LOADED) { cb(true); return; }
    if (!plan.premium || !plan.sb) { cb(false); return; }
    plan.sb.from('premium_assets').select('code').eq('name', 'plib-premium').maybeSingle().then(function (r) {
      var code = r && r.data && r.data.code;
      if (!code) { cb(false); return; }
      try { (new Function(code))(); cb(!!P.PREMIUM_LOADED); } catch (e) { cb(false); }
    }).catch(function () { cb(false); });
  }
  function bytesDownload(name, bytes, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  /* CSV + Excel + PDF(yazdır) düğmeleri; headers/rows dışa aktarılacak tablo */
  function exportBar(id, base, title, headers, rows) {
    return '<p class="row"><button class="btn sec" id="' + id + '-csv" type="button">' + esc(T.p_dl_csv) + '</button> ' +
      '<button class="btn sec" id="' + id + '-xlsx" type="button">' + esc(T.p_dl_xlsx) + '</button> ' +
      '<button class="btn sec" id="' + id + '-pdf" type="button">' + esc(T.p_dl_pdf) + '</button></p>';
  }
  function wireExport(id, base, title, headers, rows) {
    $(id + '-csv').addEventListener('click', function () {
      var lines = [headers.map(csvCell).join(',')];
      rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
      download(base + '.csv', lines.join('\n'), 'text/csv;charset=utf-8');
    });
    $(id + '-xlsx').addEventListener('click', function () {
      bytesDownload(base + '.xlsx', P.xlsx([headers].concat(rows), title), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
    $(id + '-pdf').addEventListener('click', function () {
      var w = window.open('', '_blank');
      if (!w) return;
      w.document.open(); w.document.write(P.printHtml(title, headers, rows)); w.document.close();
    });
  }

  /* ---------- üyelik durumu ---------- */
  function getPlan(cb) {
    if (!C.url || !C.key || !window.supabase) { cb({ premium: false, logged: false, unavailable: true }); return; }
    var sb;
    try { sb = window.supabase.createClient(C.url, C.key); } catch (e) { cb({ premium: false, logged: false, unavailable: true }); return; }
    sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { cb({ premium: false, logged: false, sb: sb }); return; }
      sb.from('profiles').select('is_premium,premium_until').eq('id', s.user.id).maybeSingle().then(function (p) {
        var d = p.data || {};
        var ok = !!d.is_premium && (!d.premium_until || new Date(d.premium_until) > new Date());
        cb({ premium: ok, logged: true, sb: sb, user: s.user });
      }).catch(function () { cb({ premium: false, logged: true, sb: sb, user: s.user }); });
    }).catch(function () { cb({ premium: false, logged: false, unavailable: true }); });
  }

  function planBar(plan) {
    var h = '<div class="note planbar"><strong>' + esc(T.p_plan) + ':</strong> ' +
      esc(plan.premium ? T.p_plan_premium : T.p_plan_free) + ' ';
    if (plan.unavailable) h += '<span>· ' + esc(T.p_unavailable) + '</span> ';
    if (plan.premium && !plan.pro) h += '<span class="msg err">' + esc(T.p_pro_fail) + '</span> ';
    if (!plan.premium) {
      if (!plan.logged) h += '<a class="btn sec" href="' + esc(C.loginPath) + '">' + esc(T.p_login) + '</a> ';
      h += '<a class="btn" href="' + esc(C.premiumPath) + '">' + esc(T.p_upgrade) + '</a>';
    }
    return h + '</div>';
  }
  function upsell(msg) {
    return '<div class="panel"><p>' + esc(msg) + '</p><p><a class="btn" href="' + esc(C.premiumPath) + '">' + esc(T.p_upgrade) + '</a></p></div>';
  }

  /* ---------- 1) Config Auditor ---------- */
  function renderAuditor(plan) {
    app.innerHTML = planBar(plan) +
      '<div class="row"><label for="a-v">' + esc(T.p_vendor) + '</label><select id="a-v"><option value="cisco">Cisco IOS</option><option value="huawei">Huawei VRP</option><option value="aruba">Aruba AOS-S / AOS-CX</option></select></div>' +
      '<label for="a-in">' + esc(T.p_aud_paste) + '</label><textarea id="a-in" rows="12" dir="ltr" spellcheck="false"></textarea>' +
      '<p><label for="a-f">' + esc(T.p_aud_files) + '</label> <input type="file" id="a-f" accept=".txt,.cfg,.conf,.log,text/plain"' + (plan.pro ? ' multiple' : '') + '></p>' +
      '<p><button class="btn" id="a-run" type="button">' + esc(T.p_run) + '</button></p>' +
      '<div id="a-out"></div>';
    var files = [];
    $('a-f').addEventListener('change', function (e) {
      files = [];
      var list = [].slice.call(e.target.files || [], 0, plan.pro ? 20 : 1);
      var left = list.length;
      if (!left) return;
      list.forEach(function (f) {
        var r = new FileReader();
        r.onload = function () { files.push({ name: f.name, text: String(r.result || '').slice(0, 2000000) }); left--; if (!left) $('a-in').placeholder = files.map(function (x) { return x.name; }).join(', '); };
        r.readAsText(f);
      });
    });
    $('a-run').addEventListener('click', function () {
      var v = $('a-v').value, txt = $('a-in').value;
      var inputs = txt.trim() ? [{ name: '-', text: txt }] : [];
      inputs = inputs.concat(files);
      var out = $('a-out');
      if (!inputs.length) { out.innerHTML = '<div class="msg err">' + esc(T.p_empty) + '</div>'; return; }
      var rows = [], hidden = 0, cnt = { high: 0, medium: 0, low: 0 };
      inputs.forEach(function (inp) {
        var r = P.audit(v, inp.text, plan.pro);
        hidden = r.hidden;
        r.findings.forEach(function (f) { cnt[f.sev]++; rows.push({ file: inp.name, f: f }); });
      });
      var html = '<p><strong>' + esc(fmt(T.p_aud_summary, { n: rows.length, h: cnt.high, m: cnt.medium, l: cnt.low, f: inputs.length })) + '</strong></p>';
      if (!rows.length) html += '<div class="msg ok">' + esc(T.p_none) + '</div>';
      else {
        html += '<div class="tablewrap"><table><tr><th>' + esc(T.p_col_sev) + '</th>' + (inputs.length > 1 ? '<th>' + esc(T.p_col_file) + '</th>' : '') +
          '<th>' + esc(T.p_col_find) + '</th><th>' + esc(T.p_col_ev) + '</th><th>' + esc(T.p_col_fix) + '</th></tr>';
        rows.forEach(function (x) {
          html += '<tr><td>' + sevCell(x.f.sev) + '</td>' + (inputs.length > 1 ? '<td>' + esc(x.file) + '</td>' : '') +
            '<td>' + esc(T['p_r_' + x.f.id]) + '</td><td dir="ltr"><code>' + esc(x.f.ev) + '</code></td><td dir="ltr"><code>' + esc(x.f.fix) + '</code></td></tr>';
        });
        html += '</table></div>';
      }
      if (!plan.pro && hidden) html += upsell(fmt(T.p_aud_hidden, { n: hidden }));
      var eh = ['file', 'severity', 'finding', 'evidence', 'fix'];
      var er = rows.map(function (x) { return [x.file, x.f.sev, T['p_r_' + x.f.id], x.f.ev, x.f.fix]; });
      if (plan.pro && rows.length) html += exportBar('a', 'netcmd-audit', 'NetCmd Config Audit', eh, er);
      out.innerHTML = html;
      if (plan.pro && rows.length) wireExport('a', 'netcmd-audit', 'NetCmd Config Audit', eh, er);
    });
  }

  /* ---------- 2) Troubleshooting ---------- */
  function renderTrouble(plan) {
    app.innerHTML = planBar(plan) +
      '<label for="t-in">' + esc(T.p_ts_paste) + '</label><textarea id="t-in" rows="12" dir="ltr" spellcheck="false"></textarea>' +
      '<p><label for="t-v">' + esc(T.p_ts_vlan) + '</label> <input id="t-v" type="number" min="1" max="4094" style="max-width:140px"></p>' +
      '<p><button class="btn" id="t-run" type="button">' + esc(T.p_run) + '</button></p><div id="t-out"></div>';
    $('t-run').addEventListener('click', function () {
      var txt = $('t-in').value, out = $('t-out');
      if (!txt.trim()) { out.innerHTML = '<div class="msg err">' + esc(T.p_empty) + '</div>'; return; }
      var vl = parseInt($('t-v').value, 10);
      var res = P.troubleshoot(txt, vl > 0 && vl < 4095 ? vl : 0);
      if (!res.length) { out.innerHTML = '<div class="msg ok">' + esc(T.p_none) + '</div>'; return; }
      var shown = plan.premium ? res : res.slice(0, 1);
      var html = '';
      shown.forEach(function (f) {
        html += '<div class="panel"><h3 style="margin-top:0">' + sevCell(f.sev) + ' ' + esc(T['p_ts_' + f.id + '_t']) + '</h3>' +
          '<p dir="ltr"><code>' + esc(f.ev) + '</code></p>';
        if (plan.premium) {
          html += '<p><strong>' + esc(T.p_ts_steps) + ':</strong></p><ol>' +
            String(T['p_ts_' + f.id + '_s']).split('|').map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
        }
        html += '</div>';
      });
      if (!plan.premium) html += upsell(res.length > 1 ? fmt(T.p_ts_hidden, { n: res.length - 1 }) : T.p_limited);
      out.innerHTML = html;
    });
  }

  /* ---------- 3) Compliance ---------- */
  var KEY_PROF = 'netcmd.policies.v1';
  function renderCompliance(plan) {
    if (!plan.pro) { app.innerHTML = planBar(plan) + upsell(T.p_locked); return; }
    var profs = store(KEY_PROF) || {};
    app.innerHTML = planBar(plan) +
      '<div class="row"><label for="c-p">' + esc(T.p_cmp_profile) + '</label><select id="c-p"></select> ' +
      '<button class="btn sec" id="c-del" type="button">' + esc(T.p_cmp_del) + '</button></div>' +
      '<div class="row"><label for="c-pre">' + esc(T.p_cmp_preset) + '</label><select id="c-pre"><option value="">–</option><option value="cisco">Cisco IOS</option><option value="huawei">Huawei VRP</option><option value="aruba">Aruba</option></select></div>' +
      '<label for="c-rules">' + esc(T.p_cmp_rules) + '</label><textarea id="c-rules" rows="9" dir="ltr" spellcheck="false"></textarea>' +
      '<p class="stat">' + esc(T.p_cmp_help) + '</p>' +
      '<div class="row"><input id="c-name" placeholder="' + esc(T.p_cmp_name) + '" style="max-width:260px"> <button class="btn sec" id="c-save" type="button">' + esc(T.p_cmp_save) + '</button> <span id="c-saved"></span></div>' +
      '<label for="c-cfg">' + esc(T.p_cmp_cfg) + '</label><textarea id="c-cfg" rows="10" dir="ltr" spellcheck="false"></textarea>' +
      '<p><button class="btn" id="c-run" type="button">' + esc(T.p_run) + '</button></p><div id="c-out"></div>';
    function fillSelect() {
      var sel = $('c-p'), names = Object.keys(profs);
      sel.innerHTML = '<option value="">–</option>' + names.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');
    }
    fillSelect();
    $('c-p').addEventListener('change', function () {
      var n = this.value;
      if (n && profs[n] !== undefined) { $('c-rules').value = profs[n]; $('c-name').value = n; }
    });
    $('c-pre').addEventListener('change', function () { if (this.value) $('c-rules').value = P.PRESETS[this.value]; });
    $('c-save').addEventListener('click', function () {
      var n = $('c-name').value.trim().slice(0, 60);
      if (!n || !$('c-rules').value.trim()) { $('c-saved').textContent = T.p_cmp_norules; return; }
      profs[n] = $('c-rules').value;
      store(KEY_PROF, profs);
      fillSelect();
      $('c-p').value = n;
      $('c-saved').textContent = T.p_cmp_saved;
    });
    $('c-del').addEventListener('click', function () {
      var n = $('c-p').value;
      if (n) { delete profs[n]; store(KEY_PROF, profs); fillSelect(); }
    });
    $('c-run').addEventListener('click', function () {
      var out = $('c-out');
      if (!$('c-cfg').value.trim()) { out.innerHTML = '<div class="msg err">' + esc(T.p_empty) + '</div>'; return; }
      var r = P.comply($('c-rules').value, $('c-cfg').value);
      if (!r.total) { out.innerHTML = '<div class="msg err">' + esc(T.p_cmp_norules) + '</div>'; return; }
      var html = '<p><strong>' + esc(fmt(T.p_cmp_score, { s: r.score, p: r.pass, t: r.total })) + '</strong></p><div class="tablewrap"><table><tr><th></th><th>' + esc(T.p_col_find) + '</th><th>' + esc(T.p_col_ev) + '</th></tr>';
      r.results.forEach(function (x) {
        html += '<tr><td>' + (x.ok ? '<span class="risk risk-low">' + esc(T.p_cmp_ok) + '</span>' : '<span class="risk risk-high">' + esc(T.p_cmp_fail) + '</span>') +
          '</td><td dir="ltr"><code>' + (x.type === 'require' ? '+ ' : '- ') + esc(x.label) + '</code> <small>(' + esc(x.type === 'require' ? T.p_cmp_require : T.p_cmp_forbid) + ')</small></td><td dir="ltr"><code>' + esc(x.ev) + '</code></td></tr>';
      });
      var ch = ['type', 'rule', 'result', 'evidence'];
      var cr = r.results.map(function (x) { return [x.type, x.label, x.ok ? 'pass' : 'fail', x.ev]; });
      html += '</table></div>' + exportBar('c', 'netcmd-compliance', 'NetCmd Compliance', ch, cr);
      out.innerHTML = html;
      wireExport('c', 'netcmd-compliance', 'NetCmd Compliance', ch, cr);
    });
  }

  /* ---------- 4) Topology ---------- */
  var KEY_TOPO = 'netcmd.topology.last.v1';
  function linksTable(links) {
    return '<h3>' + esc(T.p_top_links) + ' (' + links.length + ')</h3><div class="tablewrap"><table><tr><th>A</th><th>A port</th><th>B</th><th>B port</th></tr>' +
      links.map(function (l) { return '<tr><td>' + esc(l.a) + '</td><td dir="ltr"><code>' + esc(l.ai) + '</code></td><td>' + esc(l.b) + '</td><td dir="ltr"><code>' + esc(l.bi) + '</code></td></tr>'; }).join('') + '</table></div>';
  }
  function renderTopology(plan) {
    if (!plan.pro) {
      var d = P.DEMO;
      app.innerHTML = planBar(plan) + '<div class="note">' + esc(T.p_top_demo) + '</div><div class="panel">' + d.svg + '</div>' + linksTable(d.links) +
        '<p class="msg err"><strong>' + esc(T.p_top_unknown) + ':</strong> ' + esc(d.unknown.join(', ')) + '</p>' +
        '<p class="msg err"><strong>' + esc(T.p_top_missing) + ':</strong> ' + esc(d.missing.join(', ')) + '</p>' + upsell(T.p_locked);
      return;
    }
    app.innerHTML = planBar(plan) +
      '<label for="p-in">' + esc(T.p_top_in) + '</label><textarea id="p-in" rows="14" dir="ltr" spellcheck="false"></textarea>' +
      '<p class="stat">' + esc(T.p_top_help) + '</p>' +
      '<label for="p-inv">' + esc(T.p_top_inv) + '</label><textarea id="p-inv" rows="4" dir="ltr" spellcheck="false"></textarea><p><button class="btn sec" id="p-sample" type="button">' + esc(T.p_top_sample) + '</button></p>' +
      '<p><button class="btn" id="p-run" type="button">' + esc(T.p_run) + '</button></p><div id="p-out"></div>';
    $('p-in').value = P.SAMPLE;
    $('p-sample').addEventListener('click', function () { $('p-in').value = P.SAMPLE; $('p-inv').value = 'CORE1\nDIST1\nDIST2\nACC1\nACC2\nACC3'; });
    $('p-run').addEventListener('click', function () {
      var out = $('p-out');
      var topo = P.topology($('p-in').value, $('p-inv').value);
      if (!topo.links.length) { out.innerHTML = '<div class="msg err">' + esc(T.p_top_none) + '</div>'; return; }
      var svg = P.topoSvg(topo);
      var html = '<div class="panel">' + svg + '</div>' + linksTable(topo.links);
      if (topo.unknown.length) html += '<p class="msg err"><strong>' + esc(T.p_top_unknown) + ':</strong> ' + esc(topo.unknown.join(', ')) + '</p>';
      if (topo.missing.length) html += '<p class="msg err"><strong>' + esc(T.p_top_missing) + ':</strong> ' + esc(topo.missing.join(', ')) + '</p>';
      var prev = store(KEY_TOPO);
      html += '<h3>' + esc(T.p_top_changes) + '</h3>';
      if (!prev) html += '<p>' + esc(T.p_top_first) + '</p>';
      else {
        var df = P.topoDiff(prev, topo.links);
        if (!df.added.length && !df.removed.length) html += '<p>' + esc(T.p_top_nochange) + '</p>';
        else html += '<ul dir="ltr">' + df.added.map(function (k) { return '<li>+ ' + esc(T.p_top_new) + ': <code>' + esc(k) + '</code></li>'; }).join('') +
          df.removed.map(function (k) { return '<li>− ' + esc(T.p_top_gone) + ': <code>' + esc(k) + '</code></li>'; }).join('') + '</ul>';
      }
      store(KEY_TOPO, topo.links);
      var th = ['a', 'a_port', 'b', 'b_port'];
      var tr = topo.links.map(function (l) { return [l.a, l.ai, l.b, l.bi]; });
      html += exportBar('p', 'netcmd-topology', 'NetCmd Topology', th, tr) + '<p><button class="btn sec" id="p-svg" type="button">' + esc(T.p_top_svg) + '</button></p>';
      out.innerHTML = html;
      wireExport('p', 'netcmd-topology', 'NetCmd Topology', th, tr);
      $('p-svg').addEventListener('click', function () { download('netcmd-topology.svg', svg, 'image/svg+xml'); });
    });
  }

  /* ---------- 5) Bulk Automation Builder ---------- */
  function fileBox(id, name, text) {
    return '<div class="panel"><h3 style="margin-top:0"><code>' + esc(name) + '</code></h3><p class="row"><button class="btn sec" id="' + id + '-c" type="button">' + esc(T.p_copy) + '</button> ' +
      '<button class="btn sec" id="' + id + '-d" type="button">' + esc(T.p_download) + '</button></p><pre dir="ltr"><code>' + esc(text) + '</code></pre></div>';
  }
  function wireFile(id, name, text) {
    $(id + '-c').addEventListener('click', function () {
      var b = this, o = b.textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { b.textContent = T.p_copied; setTimeout(function () { b.textContent = o; }, 1200); });
    });
    $(id + '-d').addEventListener('click', function () { download(name, text, 'text/plain;charset=utf-8'); });
  }
  function genError(r) {
    var k = { danger: 'p_b_err_danger', notread: 'p_b_err_notread', host: 'p_b_err_host', hosts: 'p_b_err_hosts', cmds: 'p_b_err_cmds' }[r.error];
    return '<div class="msg err">' + esc(fmt(T[k] || T.p_pro_fail, { c: r.bad || '' })) + '</div>';
  }
  function platSelect(id) {
    return '<select id="' + id + '"><option value="cisco">Cisco IOS</option><option value="huawei">Huawei VRP</option><option value="aruba_s">Aruba AOS-S (hp_procurve)</option></select>';
  }
  function renderBulk(plan) {
    if (!plan.pro) { app.innerHTML = planBar(plan) + upsell(T.p_locked); return; }
    app.innerHTML = planBar(plan) +
      '<div class="row"><label for="b-p">' + esc(T.p_b_platform) + '</label>' + platSelect('b-p') + '</div>' +
      '<div class="row"><label for="b-m">' + esc(T.p_b_mode) + '</label><select id="b-m"><option value="show">' + esc(T.p_b_show) + '</option><option value="config">' + esc(T.p_b_cfg) + '</option></select></div>' +
      '<label for="b-h">' + esc(T.p_b_hosts) + '</label><textarea id="b-h" rows="6" dir="ltr" spellcheck="false" placeholder="10.0.0.1,SW-CORE1&#10;10.0.0.2"></textarea>' +
      '<label for="b-c">' + esc(T.p_b_cmds) + '</label><textarea id="b-c" rows="6" dir="ltr" spellcheck="false" placeholder="show version&#10;show vlan brief"></textarea>' +
      '<div class="row"><label for="b-w">' + esc(T.p_b_workers) + '</label><input id="b-w" type="number" min="1" max="20" value="5" style="max-width:90px"> ' +
      '<label for="b-r">' + esc(T.p_b_retries) + '</label><input id="b-r" type="number" min="0" max="5" value="2" style="max-width:90px"></div>' +
      '<p><label><input type="checkbox" id="b-b" checked> ' + esc(T.p_b_backup) + '</label><br><label><input type="checkbox" id="b-s"> ' + esc(T.p_b_save) + '</label></p>' +
      '<p><button class="btn" id="b-go" type="button">' + esc(T.p_b_gen) + '</button></p><div id="b-out"></div>';
    $('b-go').addEventListener('click', function () {
      var r = P.genBulk({ platform: $('b-p').value, mode: $('b-m').value, hosts: $('b-h').value, cmds: $('b-c').value,
        workers: $('b-w').value, retries: $('b-r').value, backup: $('b-b').checked, save: $('b-s').checked });
      var out = $('b-out');
      if (r.error) { out.innerHTML = genError(r); return; }
      out.innerHTML = '<div class="note">' + esc(T.p_b_howto) + '</div>' + fileBox('f1', 'bulk.py', r.script) + fileBox('f2', 'inventory.csv', r.inventory) + fileBox('f3', 'README.md', r.readme);
      wireFile('f1', 'bulk.py', r.script); wireFile('f2', 'inventory.csv', r.inventory); wireFile('f3', 'README.md', r.readme);
    });
  }

  /* ---------- 6) Discovery Collector ---------- */
  function renderCollector(plan) {
    if (!plan.pro) { app.innerHTML = planBar(plan) + upsell(T.p_locked); return; }
    app.innerHTML = planBar(plan) + '<div class="note">' + esc(T.p_k_note) + '</div>' +
      '<div class="row"><label for="k-p">' + esc(T.p_b_platform) + '</label><select id="k-p"><option value="cisco">Cisco CDP</option><option value="cisco_lldp">Cisco LLDP</option><option value="huawei">Huawei LLDP</option><option value="aruba_s">Aruba AOS-S LLDP</option></select></div>' +
      '<label for="k-h">' + esc(T.p_b_hosts.replace(/\s*\(.*$/, '')) + '</label><textarea id="k-h" rows="6" dir="ltr" spellcheck="false" placeholder="10.0.0.1&#10;10.0.0.2"></textarea>' +
      '<p><button class="btn" id="k-go" type="button">' + esc(T.p_k_gen) + '</button></p><div id="k-out"></div>';
    $('k-go').addEventListener('click', function () {
      var r = P.genCollector({ platform: $('k-p').value, hosts: $('k-h').value });
      var out = $('k-out');
      if (r.error) { out.innerHTML = genError(r); return; }
      out.innerHTML = fileBox('k1', 'collect.py', r.script);
      wireFile('k1', 'collect.py', r.script);
    });
  }

  /* ---------- Premium sayfası: durum + talep ---------- */
  function renderPremiumPage(plan) {
    var box = $('prem-box');
    if (!box) return;
    if (plan.premium) { box.innerHTML = '<div class="msg ok">' + esc(T.p_already) + '</div>'; return; }
    if (!plan.logged) { box.innerHTML = '<p>' + esc(T.p_login_req) + '</p><p><a class="btn" href="' + esc(C.loginPath) + '">' + esc(T.p_login) + '</a> <a class="btn sec" href="' + esc(C.signupPath) + '">' + esc(C.signupText) + '</a></p>'; return; }
    box.innerHTML = '<h2>' + esc(T.p_req_title) + '</h2><form class="box" id="rq"><label for="rq-ref">' + esc(T.p_req_ref) + '</label>' +
      '<input id="rq-ref" maxlength="200" minlength="3" required><p><button class="btn" id="rq-b" type="submit">' + esc(T.p_req_btn) + '</button></p></form><div id="rq-m" class="msg" hidden></div>';
    function msg(t, ok) { var m = $('rq-m'); m.textContent = t; m.className = 'msg ' + (ok ? 'ok' : 'err'); m.hidden = false; }
    plan.sb.from('premium_requests').select('status').eq('status', 'pending').limit(1).then(function (r) {
      if (r.data && r.data.length) { msg(T.p_req_pending, true); }
    });
    $('rq').addEventListener('submit', function (e) {
      e.preventDefault();
      var b = $('rq-b'); b.disabled = true;
      plan.sb.from('premium_requests').insert({ reference: $('rq-ref').value.trim() }).then(function (r) {
        b.disabled = false;
        if (r.error) { msg(T.p_req_err, false); return; }
        msg(T.p_req_ok, true); $('rq').reset();
      }).catch(function () { b.disabled = false; msg(T.p_req_err, false); });
    });
  }

  getPlan(function (plan) {
    function go() {
      try {
        if (tool === 'premium') renderPremiumPage(plan);
        else if (tool === 'aud') renderAuditor(plan);
        else if (tool === 'trouble') renderTrouble(plan);
        else if (tool === 'comp') renderCompliance(plan);
        else if (tool === 'topo') renderTopology(plan);
        else if (tool === 'bulk') renderBulk(plan);
        else if (tool === 'coll') renderCollector(plan);
      } catch (e) {
        app.innerHTML = '<div class="msg err">' + esc(String(e && e.message || e)) + '</div>';
      }
    }
    if (tool === 'premium' || !plan.premium) { plan.pro = false; go(); return; }
    app.innerHTML = '<div class="note">' + esc(T.p_pro_loading) + '</div>';
    loadPro(plan, function (ok) { plan.pro = ok; go(); });
  });
})();
