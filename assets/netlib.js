/* NetLib: tarayıcıda çalışan, cihaza bağlanmayan saf fonksiyonlar (Node'da da test edilebilir). */
(function (root) {
  'use strict';

  var READ = {
    cisco: /^(show|ping|traceroute|dir|more|terminal\s+(length|width)|do\s+show)\b/i,
    aruba: /^(show|ping|traceroute|dir|more|do\s+show)\b/i,
    huawei: /^(display|ping|tracert|dir|screen-length)\b/i
  };

  /* ---------- 1) Komut sınıflandırma ---------- */
  function classify(vendor, raw) {
    var line = (raw || '').trim();
    if (!line || /^[!#]/.test(line)) return { kind: 'skip', risk: 'none', notes: [] };
    var l = line.toLowerCase().replace(/\s+/g, ' ');
    var v = READ[vendor] ? vendor : 'cisco';
    var notes = [];

    if (/^(reload|reboot)\b/.test(l)) return { kind: 'danger', risk: 'high', notes: ['reload'] };
    if (/^(write erase|erase\b|delete\b|format\b|factory-reset|reset saved-configuration|reset factory)/.test(l))
      return { kind: 'danger', risk: 'high', notes: ['erase'] };
    if (/^(default interface|boot system|startup system-software|startup saved-configuration)/.test(l))
      return { kind: 'danger', risk: 'high', notes: ['default_if'] };

    if (READ[v].test(line)) return { kind: 'read', risk: 'none', notes: [] };

    if (/^(end|exit|quit|return|abort)$/.test(l)) return { kind: 'nav', risk: 'none', notes: [] };
    if (/^(configure terminal|configure|conf t|config t|system-view|sys)$/.test(l))
      return { kind: 'context', risk: 'low', notes: [] };
    if (/^(write memory|write mem|write|wr|copy running-config startup-config|copy run start|save|save force)$/.test(l))
      return { kind: 'save', risk: 'low', notes: ['save'] };

    if (/^(clear|reset)\b/.test(l)) {
      if (/dhcp snooping|dhcp-snooping|ip dhcp|arp inspection/.test(l)) notes.push('clear_binding');
      return { kind: 'state', risk: notes.length ? 'medium' : 'low', notes: notes };
    }

    if (/^(interface|int|vlan\s+\d|line|router|ip access-list|ipv6 access-list|acl\b|policy-map|class-map|aaa|stp region-configuration)/.test(l) &&
        !/^(no|undo)\b/.test(l) && !/^vlan batch/.test(l)) {
      return { kind: 'context', risk: 'low', notes: [] };
    }

    // buradan sonrası yapılandırma değişikliği
    var risk = 'low';
    var neg = /^(no|undo)\s+/.test(l);
    var body = l.replace(/^(no|undo)\s+/, '');
    if (/^shutdown$/.test(l)) { risk = 'medium'; notes.push('shutdown'); }
    if (neg && /^vlan\b/.test(body)) { risk = 'high'; notes.push('vlan_delete'); }
    if (/^ip address\b/.test(body)) { risk = 'medium'; notes.push('ip_change'); }
    if (/^switchport trunk allowed vlan\s+(?!add\b|remove\b|except\b|none\b|all\b)\S/.test(l)) {
      risk = 'medium'; notes.push('trunk_replace');
    }
    if (/^(spanning-tree|stp)\s+(mode|priority|root)/.test(body)) { risk = 'medium'; notes.push('stp_change'); }
    return { kind: 'config', risk: risk, notes: notes };
  }

  function inverse(vendor, raw, cls) {
    var line = (raw || '').trim();
    cls = cls || classify(vendor, line);
    if (cls.kind !== 'config') return null;
    var neg = vendor === 'huawei' ? 'undo ' : 'no ';
    var m = line.match(/^(no|undo)\s+(.*)$/i);
    if (m) return m[2];
    return neg + line;
  }

  function precheckCommands(vendor) {
    if (vendor === 'huawei')
      return ['display clock', 'display ip interface brief', 'display interface brief', 'display vlan', 'display stp brief'];
    if (vendor === 'aruba')
      return ['show ip interface brief', 'show interface brief', 'show vlan', 'show spanning-tree'];
    return ['show clock', 'show ip interface brief', 'show interfaces status', 'show vlan brief', 'show interfaces trunk', 'show spanning-tree summary'];
  }

  function backupCommand(vendor) {
    return vendor === 'huawei' ? 'display current-configuration' : 'show running-config';
  }

  function analyzeChange(vendor, text) {
    var rows = [], groups = [], cur = { ctx: null, items: [] };
    groups.push(cur);
    var counts = { read: 0, config: 0, state: 0, danger: 0, context: 0, save: 0, nav: 0, total: 0 };
    text.split(/\r?\n/).forEach(function (raw) {
      var cls = classify(vendor, raw);
      if (cls.kind === 'skip') return;
      var inv = inverse(vendor, raw, cls);
      rows.push({ cmd: raw.trim(), kind: cls.kind, risk: cls.risk, notes: cls.notes, rollback: inv });
      counts.total++;
      counts[cls.kind] = (counts[cls.kind] || 0) + 1;
      if (cls.kind === 'context') { cur = { ctx: raw.trim(), items: [] }; groups.push(cur); }
      else if (cls.kind === 'config' && inv) cur.items.push(inv);
    });
    var rollback = [];
    for (var g = groups.length - 1; g >= 0; g--) {
      var gr = groups[g];
      if (!gr.items.length) continue;
      if (gr.ctx) rollback.push(gr.ctx);
      for (var i = gr.items.length - 1; i >= 0; i--) rollback.push((gr.ctx ? ' ' : '') + gr.items[i]);
    }
    var changing = counts.config + counts.state + counts.danger + counts.save;
    return { rows: rows, counts: counts, rollback: rollback, changing: changing > 0 };
  }

  /* ---------- 2) Config ayrıştırma / karşılaştırma ---------- */
  var SKIP = /^(building configuration|current configuration|last configuration change|nvram config|version\s|return$|end$|ntp clock-period)/i;

  function parseBlocks(text) {
    var blocks = [], map = {}, cur = null;
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      if (!raw.trim()) return;
      var line = raw.replace(/\s+$/, '');
      var t = line.trim();
      if (t === '!' || t === '#') { cur = null; return; }
      if (/^[!#]/.test(t)) return;
      if (SKIP.test(t)) return;
      if (/^\s/.test(line)) { if (cur) cur.lines.push(t); return; }
      cur = map[t];
      if (!cur) { cur = { key: t, lines: [] }; map[t] = cur; blocks.push(cur); }
    });
    return blocks;
  }

  function categorize(key, lines) {
    var k = key.toLowerCase();
    var all = lines.join('\n').toLowerCase();
    if (/^vlan\b/.test(k)) return 'vlan';
    if (/access-list|^acl\b|traffic-filter|access-group|traffic-policy/.test(k + '\n' + all)) return 'acl';
    if (/trunk allowed|trunk allow-pass|trunk native|trunk pvid|link-type trunk|mode trunk|vlan trunk|switchport trunk/.test(all)) return 'trunk';
    if (/^(interface|int)\b/.test(k)) return 'port';
    return 'other';
  }

  function diffConfigs(oldT, newT) {
    var A = parseBlocks(oldT), B = parseBlocks(newT), ma = {}, mb = {}, changes = [];
    A.forEach(function (b) { ma[b.key] = b; });
    B.forEach(function (b) { mb[b.key] = b; });
    function mk(key, status, added, removed) {
      return { key: key, status: status, added: added, removed: removed, category: categorize(key, added.concat(removed)) };
    }
    A.forEach(function (b) {
      var nb = mb[b.key];
      if (!nb) { changes.push(mk(b.key, 'removed', [], b.lines)); return; }
      var add = nb.lines.filter(function (l) { return b.lines.indexOf(l) < 0; });
      var rem = b.lines.filter(function (l) { return nb.lines.indexOf(l) < 0; });
      if (add.length || rem.length) changes.push(mk(b.key, 'modified', add, rem));
    });
    B.forEach(function (b) { if (!ma[b.key]) changes.push(mk(b.key, 'added', b.lines, [])); });
    var counts = { vlan: 0, trunk: 0, acl: 0, port: 0, other: 0 };
    changes.forEach(function (c) { counts[c.category]++; });
    return { changes: changes, counts: counts };
  }

  function normLines(t) {
    return String(t || '').split(/\r?\n/).map(function (s) { return s.replace(/\s+$/, ''); })
      .filter(function (s) { var x = s.trim(); return x && x !== '!' && x !== '#' && !/^[!#]\s*(time|last|nvram)/i.test(x); });
  }

  function lineDiff(oldT, newT) {
    var a = normLines(oldT), b = normLines(newT), out = [], i, j;
    if (a.length * b.length > 6000000) {
      a.forEach(function (s) { if (b.indexOf(s) < 0) out.push({ t: '-', s: s }); });
      b.forEach(function (s) { if (a.indexOf(s) < 0) out.push({ t: '+', s: s }); });
      return out;
    }
    var n = a.length, m = b.length, w = m + 1, Lc = new Int32Array((n + 1) * w);
    for (i = n - 1; i >= 0; i--)
      for (j = m - 1; j >= 0; j--)
        Lc[i * w + j] = a[i] === b[j] ? Lc[(i + 1) * w + j + 1] + 1 : Math.max(Lc[(i + 1) * w + j], Lc[i * w + j + 1]);
    i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { out.push({ t: ' ', s: a[i] }); i++; j++; }
      else if (Lc[(i + 1) * w + j] >= Lc[i * w + j + 1]) { out.push({ t: '-', s: a[i++] }); }
      else { out.push({ t: '+', s: b[j++] }); }
    }
    while (i < n) out.push({ t: '-', s: a[i++] });
    while (j < m) out.push({ t: '+', s: b[j++] });
    return out;
  }

  /* ---------- 3) Rapor ayrıştırıcıları ---------- */
  function parseReachability(text) {
    var res = [], cur = null;
    function finish() {
      if (!cur) return;
      var body = cur.lines.join('\n'), loss = null, m;
      if ((m = body.match(/success rate is\s+(\d+(?:\.\d+)?)\s*percent/i))) loss = 100 - parseFloat(m[1]);
      else if ((m = body.match(/(\d+(?:\.\d+)?)\s*%\s*packet loss/i))) loss = parseFloat(m[1]);
      var status = loss === null ? 'unknown' : (loss >= 100 ? 'down' : (loss > 0 ? 'degraded' : 'up'));
      res.push({ host: cur.host, loss: loss, status: status });
    }
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var h = raw.match(/^\s*#{2,}\s*(.+?)\s*$/);
      if (h) { finish(); cur = { host: h[1], lines: [] }; return; }
      if (!cur) cur = { host: 'device', lines: [] };
      cur.lines.push(raw);
    });
    finish();
    return res.filter(function (r) { return !(r.host === 'device' && r.status === 'unknown' && res.length > 1); });
  }

  function parsePortStatus(text) {
    var ports = [];
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m = line.match(/^(\S+)\s+.*?\b(connected|notconnect|err-disabled|disabled|inactive|suspended|monitoring)\b/i);
      if (m && !/^(port|interface)$/i.test(m[1])) {
        var s = m[2].toLowerCase();
        ports.push({ name: m[1], state: s === 'connected' || s === 'monitoring' ? 'connected' : (s === 'err-disabled' ? 'errdisabled' : (s === 'disabled' ? 'disabled' : 'notconnect')) });
        return;
      }
      m = line.match(/^(\S+)\s+(\*down|\^down|up\(\w\)|up|down)\s+(\*down|\^down|up\(\w\)|up|down)\b/i);
      if (m && !/^(interface|phy)$/i.test(m[1])) {
        var phy = m[2].toLowerCase();
        ports.push({ name: m[1], state: phy.indexOf('up') === 0 ? 'connected' : (phy === '*down' ? 'disabled' : 'notconnect') });
        return;
      }
      m = line.match(/^(\S+)\s+.*?\b(up|down)\b/i);
      if (m && /\d/.test(m[1]) && !/^(vlan|ip)/i.test(m[1])) {
        ports.push({ name: m[1], state: m[2].toLowerCase() === 'up' ? 'connected' : 'notconnect' });
      }
    });
    var c = { connected: 0, notconnect: 0, disabled: 0, errdisabled: 0, total: ports.length };
    ports.forEach(function (p) { c[p.state]++; });
    return { ports: ports, counts: c };
  }

  function parseErrors(text) {
    var perIf = {}, order = [], cur = null;
    function add(name, n) {
      if (!name || !n) return;
      if (!(name in perIf)) { perIf[name] = 0; order.push(name); }
      perIf[name] += n;
    }
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var h = line.match(/^(\S+) is (?:up|down|administratively down)/i) || line.match(/^(\S+)\s+current state\s*:/i);
      if (h) { cur = h[1]; return; }
      var tbl = line.match(/^([A-Za-z][\w\/.\-]*\d[\w\/.\-]*)((?:\s+\d+)+)\s*$/);
      if (tbl) {
        var sum = 0;
        tbl[2].trim().split(/\s+/).forEach(function (x) { sum += parseInt(x, 10); });
        add(tbl[1], sum);
        return;
      }
      var m, re = /(\d+)\s+(input errors|CRC|output errors|runts|giants|collisions|overrun|frame)/ig;
      while ((m = re.exec(line))) add(cur, parseInt(m[1], 10));
      var kv, re2 = /\b(CRC|Input errors?|Output errors?|Total Error|Giants|Runts|Collisions|Overruns)\s*[:=]\s*(\d+)/ig;
      while ((kv = re2.exec(line))) add(cur, parseInt(kv[2], 10));
    });
    var list = order.map(function (n) { return { name: n, errors: perIf[n] }; })
      .filter(function (x) { return x.errors > 0; })
      .sort(function (a, b) { return b.errors - a.errors; });
    return list;
  }

  /* ---------- 4) Netmiko / Ansible üretici (yalnızca salt okunur) ---------- */
  var CHECKS = {
    cisco: [
      'show version', 'show ip interface brief', 'show interfaces status', 'show vlan brief', 'show mac address-table',
      'show ip arp', 'show ip route', 'show lldp neighbors', 'show spanning-tree', 'show ip dhcp snooping binding',
      'show processes cpu sorted', 'show logging', 'show interfaces counters errors', 'show running-config'
    ],
    huawei: [
      'display version', 'display ip interface brief', 'display interface brief', 'display vlan', 'display mac-address',
      'display arp', 'display ip routing-table', 'display lldp neighbor brief', 'display stp brief',
      'display dhcp snooping user-bind all', 'display cpu-usage', 'display logbuffer', 'display current-configuration'
    ],
    aruba: [
      'show version', 'show ip interface brief', 'show interface brief', 'show vlan', 'show mac-address-table',
      'show arp', 'show ip route', 'show lldp neighbor-info', 'show spanning-tree', 'show dhcpv4-snooping binding',
      'show system resource-utilization', 'show logging', 'show running-config'
    ]
  };

  var PLATFORMS = {
    cisco: { netmiko: 'cisco_ios', ansibleOs: 'cisco.ios.ios', family: 'cisco' },
    huawei: { netmiko: 'huawei', ansibleOs: 'community.network.ce', family: 'huawei' },
    aruba_s: { netmiko: 'hp_procurve', ansibleOs: null, family: 'aruba' },
    aruba_cx: { netmiko: null, ansibleOs: 'arubanetworks.aoscx.aoscx', family: 'aruba' }
  };

  function py(s) { return JSON.stringify(String(s)); }

  function buildNetmiko(platform, hosts, cmds) {
    var p = PLATFORMS[platform];
    var L = [];
    L.push('#!/usr/bin/env python3');
    L.push('"""Salt okunur kontroller (NetCmd tarafından üretildi). Yapılandırmayı DEĞİŞTİRMEZ."""');
    L.push('import logging');
    L.push('import os');
    L.push('import sys');
    L.push('from concurrent.futures import ThreadPoolExecutor, as_completed');
    L.push('from datetime import datetime');
    L.push('from pathlib import Path');
    L.push('');
    L.push('from netmiko import ConnectHandler');
    L.push('from netmiko.exceptions import NetmikoAuthenticationException, NetmikoTimeoutException');
    L.push('');
    L.push('DEVICE_TYPE = ' + py(p.netmiko));
    L.push('HOSTS = [');
    hosts.forEach(function (h) { L.push('    ' + py(h) + ','); });
    L.push(']');
    L.push('COMMANDS = [');
    cmds.forEach(function (c) { L.push('    ' + py(c) + ','); });
    L.push(']');
    L.push('');
    L.push('USER = os.environ.get("NET_USER")');
    L.push('PASSWORD = os.environ.get("NET_PASS")');
    L.push('OUT_DIR = Path("output") / datetime.now().strftime("%Y%m%d_%H%M%S")');
    L.push('MAX_WORKERS = 5');
    L.push('');
    L.push('logging.basicConfig(');
    L.push('    level=logging.INFO,');
    L.push('    format="%(asctime)s %(levelname)s %(message)s",');
    L.push('    handlers=[logging.StreamHandler(), logging.FileHandler("collect.log", encoding="utf-8")],');
    L.push(')');
    L.push('log = logging.getLogger("collect")');
    L.push('');
    L.push('');
    L.push('def collect(host):');
    L.push('    params = {');
    L.push('        "device_type": DEVICE_TYPE,');
    L.push('        "host": host,');
    L.push('        "username": USER,');
    L.push('        "password": PASSWORD,');
    L.push('        # Güvenlik: known_hosts içindeki anahtar eşleşmezse bağlantıyı reddet.');
    L.push('        "ssh_strict": True,');
    L.push('        "system_host_keys": True,');
    L.push('        "conn_timeout": 20,');
    L.push('    }');
    L.push('    chunks = []');
    L.push('    try:');
    L.push('        with ConnectHandler(**params) as conn:');
    L.push('            for cmd in COMMANDS:');
    L.push('                try:');
    L.push('                    out = conn.send_command(cmd, read_timeout=60)');
    L.push('                except Exception as exc:  # tek komut hatası diğerlerini durdurmasın');
    L.push('                    log.error("%s: komut hatası (%s): %s", host, cmd, exc)');
    L.push('                    out = "HATA: %s" % exc');
    L.push('                chunks.append("### %s\\n%s\\n" % (cmd, out))');
    L.push('    except NetmikoAuthenticationException:');
    L.push('        log.error("%s: kimlik doğrulama hatası", host)');
    L.push('        return host, False');
    L.push('    except NetmikoTimeoutException:');
    L.push('        log.error("%s: zaman aşımı / erişilemiyor", host)');
    L.push('        return host, False');
    L.push('    except Exception as exc:');
    L.push('        log.error("%s: beklenmeyen hata: %s", host, exc)');
    L.push('        return host, False');
    L.push('    OUT_DIR.mkdir(parents=True, exist_ok=True)');
    L.push('    (OUT_DIR / ("%s.txt" % host)).write_text("\\n".join(chunks), encoding="utf-8")');
    L.push('    log.info("%s: tamam (%d komut)", host, len(COMMANDS))');
    L.push('    return host, True');
    L.push('');
    L.push('');
    L.push('def main():');
    L.push('    if not USER or not PASSWORD:');
    L.push('        sys.exit("NET_USER ve NET_PASS ortam değişkenlerini ayarla.")');
    L.push('    failed = []');
    L.push('    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:');
    L.push('        for fut in as_completed([pool.submit(collect, h) for h in HOSTS]):');
    L.push('            host, ok = fut.result()');
    L.push('            if not ok:');
    L.push('                failed.append(host)');
    L.push('    log.info("Bitti: %d başarılı, %d başarısız", len(HOSTS) - len(failed), len(failed))');
    L.push('    if failed:');
    L.push('        log.warning("Başarısız: %s", ", ".join(failed))');
    L.push('        sys.exit(1)');
    L.push('');
    L.push('');
    L.push('if __name__ == "__main__":');
    L.push('    main()');
    return L.join('\n') + '\n';
  }

  function buildAnsible(platform, hosts, cmds) {
    var p = PLATFORMS[platform];
    var inv = [];
    inv.push('# inventory.yml');
    inv.push('all:');
    inv.push('  hosts:');
    hosts.forEach(function (h) { inv.push('    ' + py(h) + ':'); });
    inv.push('  vars:');
    if (platform === 'aruba_cx') {
      inv.push('    ansible_connection: arubanetworks.aoscx.aoscx');
      inv.push('    ansible_network_os: arubanetworks.aoscx.aoscx');
      inv.push('    ansible_httpapi_use_ssl: true');
      inv.push('    ansible_httpapi_validate_certs: true');
    } else {
      inv.push('    ansible_connection: ansible.netcommon.network_cli');
      inv.push('    ansible_network_os: ' + p.ansibleOs);
    }
    inv.push('    ansible_user: "{{ lookup(\'env\', \'NET_USER\') }}"');
    inv.push('    ansible_password: "{{ lookup(\'env\', \'NET_PASS\') }}"');

    var pb = [];
    pb.push('# playbook.yml  (salt okunur; yapılandırmayı değiştirmez)');
    pb.push('- name: Salt okunur kontroller');
    pb.push('  hosts: all');
    pb.push('  gather_facts: false');
    pb.push('  vars:');
    pb.push('    out_dir: "output/{{ lookup(\'pipe\', \'date +%Y%m%d_%H%M%S\') }}"');
    pb.push('  tasks:');
    if (platform === 'cisco') {
      pb.push('    - name: Komutları çalıştır');
      pb.push('      cisco.ios.ios_command:');
      pb.push('        commands:');
      cmds.forEach(function (c) { pb.push('          - ' + py(c)); });
      pb.push('      register: result');
    } else if (platform === 'aruba_cx') {
      pb.push('    - name: Komutları çalıştır');
      pb.push('      arubanetworks.aoscx.aoscx_command:');
      pb.push('        commands:');
      cmds.forEach(function (c) { pb.push('          - ' + py(c)); });
      pb.push('      register: result');
    } else {
      pb.push('    - name: Komutları çalıştır');
      pb.push('      ansible.netcommon.cli_command:');
      pb.push('        command: "{{ item }}"');
      pb.push('      loop:');
      cmds.forEach(function (c) { pb.push('        - ' + py(c)); });
      pb.push('      register: result');
    }
    pb.push('');
    pb.push('    - name: Çıktıyı dosyaya yaz');
    pb.push('      ansible.builtin.copy:');
    if (platform === 'huawei') {
      pb.push('        content: "{{ result.results | map(attribute=\'stdout\') | join(\'\\n---\\n\') }}"');
    } else {
      pb.push('        content: "{{ result.stdout | join(\'\\n---\\n\') }}"');
    }
    pb.push('        dest: "{{ out_dir }}/{{ inventory_hostname }}.txt"');
    pb.push('        mode: "0600"');
    pb.push('      delegate_to: localhost');
    return { inventory: inv.join('\n') + '\n', playbook: pb.join('\n') + '\n' };
  }

  var api = {
    classify: classify, inverse: inverse, analyzeChange: analyzeChange,
    precheckCommands: precheckCommands, backupCommand: backupCommand,
    parseBlocks: parseBlocks, categorize: categorize, diffConfigs: diffConfigs, lineDiff: lineDiff,
    parseReachability: parseReachability, parsePortStatus: parsePortStatus, parseErrors: parseErrors,
    CHECKS: CHECKS, PLATFORMS: PLATFORMS, buildNetmiko: buildNetmiko, buildAnsible: buildAnsible
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetLib = api;
})(typeof window !== 'undefined' ? window : this);
