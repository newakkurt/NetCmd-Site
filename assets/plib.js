/* NetCmd Premium kütüphanesi: Config Auditor, Compliance, Troubleshooting, Topology.
   Saf fonksiyonlar; cihaza bağlanmaz, Node'da test edilebilir. */
(function (root) {
  'use strict';

  /* ---------- ortak: config'i bloklara ayır ---------- */
  function lines(text) {
    return String(text || '').replace(/\r/g, '').split('\n');
  }
  function parse(text) {
    var all = [], blocks = [], cur = null;
    lines(text).forEach(function (raw) {
      if (!raw.trim()) return;
      var indented = /^\s/.test(raw);
      var t = raw.trim();
      if (/^[!#]+$/.test(t)) { cur = null; return; }
      all.push(t);
      if (!indented) { cur = { head: t, body: [] }; blocks.push(cur); }
      else if (cur) cur.body.push(t);
    });
    return { all: all, blocks: blocks };
  }
  function has(cfg, re) { return cfg.all.some(function (l) { return re.test(l); }); }
  function find(cfg, re) {
    for (var i = 0; i < cfg.all.length; i++) if (re.test(cfg.all[i])) return cfg.all[i];
    return '';
  }
  function ifBlocks(cfg, vendor) {
    var re = vendor === 'aruba' ? /^interface\s+/i : /^interface\s+/i;
    return cfg.blocks.filter(function (b) { return re.test(b.head) && !/^interface\s+(vlan|loopback|null|lo\b|tunnel|mgmt|vlanif|nve|stack)/i.test(b.head); });
  }

  /* ---------- 1) Config Auditor ---------- */
  /* Her kural: id, sev, free (ücretsiz sürümde çalışır mı), test(cfg) -> {ev, fix} | null */
  var RULES = {
    cisco: [
      { id: 'telnet', sev: 'high', free: true, test: function (c) {
        var ev = find(c, /^transport input .*(telnet|all)\b/i);
        return ev ? { ev: ev, fix: 'line vty 0 15 / transport input ssh' } : null; } },
      { id: 'snmp_default', sev: 'high', free: true, test: function (c) {
        var ev = find(c, /^snmp-server community\s+"?(public|private)"?(\s|$)/i);
        return ev ? { ev: ev, fix: 'no snmp-server community <name> / snmp-server group ... v3 priv' } : null; } },
      { id: 'plain_pw', sev: 'high', free: true, test: function (c) {
        var ev = find(c, /^enable password\b/i);
        if (ev) return { ev: ev, fix: 'enable secret <pw> / no enable password' };
        if (c.all.length > 5 && !has(c, /^service password-encryption/i)) return { ev: 'service password-encryption ?', fix: 'service password-encryption' };
        return null; } },
      { id: 'no_ssh', sev: 'medium', free: true, test: function (c) {
        if (has(c, /^ip ssh version 2/i)) return null;
        return { ev: find(c, /^ip ssh/i) || '-', fix: 'ip domain-name <d> / crypto key generate rsa modulus 2048 / ip ssh version 2' }; } },
      { id: 'no_aaa', sev: 'medium', test: function (c) {
        return has(c, /^aaa new-model/i) ? null : { ev: '-', fix: 'aaa new-model / aaa authentication login default group tacacs+ local' }; } },
      { id: 'no_logging', sev: 'low', test: function (c) {
        return has(c, /^logging (host|\d)/i) ? null : { ev: '-', fix: 'logging host <ip>' }; } },
      { id: 'no_ntp', sev: 'low', test: function (c) {
        return has(c, /^ntp server/i) ? null : { ev: '-', fix: 'ntp server <ip>' }; } },
      { id: 'no_bpdu', sev: 'medium', test: function (c) {
        return has(c, /^spanning-tree portfast (edge )?bpduguard default|^spanning-tree bpduguard enable/i) ? null : { ev: '-', fix: 'spanning-tree portfast bpduguard default' }; } },
      { id: 'no_dhcp_snoop', sev: 'medium', test: function (c) {
        return has(c, /^ip dhcp snooping$/i) ? null : { ev: '-', fix: 'ip dhcp snooping / ip dhcp snooping vlan <ids>' }; } },
      { id: 'no_dai_ipsg', sev: 'low', test: function (c) {
        return has(c, /^ip arp inspection vlan/i) && has(c, /ip verify source/i) ? null : { ev: '-', fix: 'ip arp inspection vlan <ids> / ip verify source (interface)' }; } },
      { id: 'no_port_sec', sev: 'medium', test: function (c) {
        var n = ifBlocks(c, 'cisco').filter(function (b) {
          return b.body.some(function (l) { return /^switchport mode access/i.test(l); }) &&
            !b.body.some(function (l) { return /^switchport port-security/i.test(l); }) &&
            !b.body.some(function (l) { return /^shutdown/i.test(l); });
        });
        return n.length ? { ev: n.length + ' x access port: ' + n.slice(0, 3).map(function (b) { return b.head.replace(/^interface\s+/i, ''); }).join(', '), fix: 'switchport port-security / switchport port-security maximum 2' } : null; } },
      { id: 'trunk_all', sev: 'medium', test: function (c) {
        var n = ifBlocks(c, 'cisco').filter(function (b) {
          return b.body.some(function (l) { return /^switchport mode trunk/i.test(l); }) &&
            !b.body.some(function (l) { return /^switchport trunk allowed vlan/i.test(l); });
        });
        return n.length ? { ev: n.length + ' x trunk: ' + n.slice(0, 3).map(function (b) { return b.head.replace(/^interface\s+/i, ''); }).join(', '), fix: 'switchport trunk allowed vlan <ids>' } : null; } },
      { id: 'http_server', sev: 'medium', test: function (c) {
        var ev = find(c, /^ip http (server|secure-server)$/i);
        return ev && /^ip http server$/i.test(ev) ? { ev: ev, fix: 'no ip http server' } : null; } },
      { id: 'unused_ports', sev: 'medium', test: function (c) {
        var n = ifBlocks(c, 'cisco').filter(function (b) { return b.body.length === 0 && !/port-channel/i.test(b.head); });
        return n.length ? { ev: n.length + ' x empty interface', fix: 'interface range <..> / shutdown / switchport access vlan <unused>' } : null; } },
      { id: 'no_banner', sev: 'low', test: function (c) {
        return has(c, /^banner (login|motd|exec)/i) ? null : { ev: '-', fix: 'banner login ^ Authorized access only ^' }; } }
    ],
    huawei: [
      { id: 'telnet', sev: 'high', free: true, test: function (c) {
        var ev = find(c, /^telnet server enable/i) || find(c, /^protocol inbound (telnet|all)/i);
        return ev ? { ev: ev, fix: 'undo telnet server enable / user-interface vty 0 4 / protocol inbound ssh' } : null; } },
      { id: 'snmp_default', sev: 'high', free: true, test: function (c) {
        var ev = find(c, /^snmp-agent community\s+(read|write)\s+(cipher\s+)?(simple\s+)?\S*(public|private)\b/i) ||
          find(c, /^snmp-agent sys-info version .*(v1|v2c|all)\b/i);
        return ev ? { ev: ev, fix: 'snmp-agent sys-info version v3 / undo snmp-agent community ...' } : null; } },
      { id: 'plain_pw', sev: 'high', free: true, test: function (c) {
        var ev = find(c, /password simple\b/i) || find(c, /^authentication-mode password/i);
        return ev ? { ev: ev, fix: 'local-user <u> password irreversible-cipher <pw> / authentication-mode aaa' } : null; } },
      { id: 'no_ssh', sev: 'medium', free: true, test: function (c) {
        return has(c, /^stelnet server enable/i) ? null : { ev: '-', fix: 'rsa local-key-pair create / stelnet server enable / ssh user <u> authentication-type password' }; } },
      { id: 'no_aaa', sev: 'medium', test: function (c) {
        return has(c, /^authentication-mode aaa/i) || has(c, /^hwtacacs-server|^hwtacacs/i) ? null : { ev: '-', fix: 'user-interface vty 0 4 / authentication-mode aaa' }; } },
      { id: 'no_logging', sev: 'low', test: function (c) {
        return has(c, /^info-center loghost/i) ? null : { ev: '-', fix: 'info-center loghost <ip>' }; } },
      { id: 'no_ntp', sev: 'low', test: function (c) {
        return has(c, /^ntp-service unicast-server/i) ? null : { ev: '-', fix: 'ntp-service unicast-server <ip>' }; } },
      { id: 'no_bpdu', sev: 'medium', test: function (c) {
        return has(c, /^stp bpdu-protection/i) ? null : { ev: '-', fix: 'stp bpdu-protection / stp edged-port enable (interface)' }; } },
      { id: 'no_dhcp_snoop', sev: 'medium', test: function (c) {
        return has(c, /^dhcp snooping enable/i) ? null : { ev: '-', fix: 'dhcp enable / dhcp snooping enable / dhcp snooping enable vlan <ids>' }; } },
      { id: 'no_dai_ipsg', sev: 'low', test: function (c) {
        return has(c, /arp anti-attack check user-bind enable/i) && has(c, /ip source check user-bind enable/i) ? null : { ev: '-', fix: 'arp anti-attack check user-bind enable / ip source check user-bind enable' }; } },
      { id: 'no_port_sec', sev: 'medium', test: function (c) {
        var n = ifBlocks(c, 'huawei').filter(function (b) {
          return b.body.some(function (l) { return /^port link-type access|^port default vlan/i.test(l); });
        });
        var any = n.some(function (b) { return b.body.some(function (l) { return /^port-security enable/i.test(l); }); });
        return n.length && !any ? { ev: n.length + ' x access port', fix: 'port-security enable / port-security max-mac-num 2' } : null; } },
      { id: 'trunk_all', sev: 'medium', test: function (c) {
        var ev = find(c, /^port trunk allow-pass vlan (all|1 to 4094)/i);
        return ev ? { ev: ev, fix: 'port trunk allow-pass vlan <ids>' } : null; } },
      { id: 'http_server', sev: 'medium', test: function (c) {
        var ev = find(c, /^http server enable/i);
        return ev ? { ev: ev, fix: 'undo http server enable / http secure-server enable' } : null; } },
      { id: 'unused_ports', sev: 'medium', test: function (c) {
        var n = ifBlocks(c, 'huawei').filter(function (b) { return b.body.length === 0 || (b.body.length === 1 && /^description/i.test(b.body[0])); });
        return n.length ? { ev: n.length + ' x empty interface', fix: 'interface range <..> / shutdown' } : null; } },
      { id: 'no_banner', sev: 'low', test: function (c) {
        return has(c, /^header (login|shell)/i) ? null : { ev: '-', fix: 'header login information "Authorized access only"' }; } }
    ],
    aruba: [
      { id: 'telnet', sev: 'high', free: true, test: function (c) {
        if (has(c, /^no telnet-server/i)) return null;
        var ev = find(c, /^telnet[- ]server/i);
        return ev ? { ev: ev, fix: 'no telnet-server (AOS-S) / no telnet server (AOS-CX)' } : null; } },
      { id: 'snmp_default', sev: 'high', free: true, test: function (c) {
        var ev = find(c, /^snmp-server community\s+"?(public|private)"?(\s|$)/i);
        return ev ? { ev: ev, fix: 'no snmp-server community public / snmpv3 enable' } : null; } },
      { id: 'plain_pw', sev: 'high', free: true, test: function (c) {
        var ev = find(c, /password .*plaintext/i);
        return ev ? { ev: ev, fix: 'password manager (hashed) / aaa authentication ...' } : null; } },
      { id: 'no_ssh', sev: 'medium', free: true, test: function (c) {
        return has(c, /^ip ssh\b|^ssh server/i) ? null : { ev: '-', fix: 'ip ssh / crypto key generate ssh (AOS-S) · ssh server vrf mgmt (AOS-CX)' }; } },
      { id: 'no_aaa', sev: 'medium', test: function (c) {
        return has(c, /^aaa authentication/i) ? null : { ev: '-', fix: 'aaa authentication login default group tacacs local' }; } },
      { id: 'no_logging', sev: 'low', test: function (c) {
        return has(c, /^logging\s+\S+/i) ? null : { ev: '-', fix: 'logging <ip>' }; } },
      { id: 'no_ntp', sev: 'low', test: function (c) {
        return has(c, /^(sntp|ntp) server/i) ? null : { ev: '-', fix: 'sntp server <ip> (AOS-S) · ntp server <ip> (AOS-CX)' }; } },
      { id: 'no_bpdu', sev: 'medium', test: function (c) {
        return has(c, /bpdu-(protection|guard)/i) ? null : { ev: '-', fix: 'spanning-tree <ports> bpdu-protection (AOS-S) · spanning-tree bpdu-guard (AOS-CX)' }; } },
      { id: 'no_dhcp_snoop', sev: 'medium', test: function (c) {
        return has(c, /^dhcp(v4)?-snooping/i) ? null : { ev: '-', fix: 'dhcp-snooping / dhcp-snooping vlan <ids>' }; } },
      { id: 'no_dai_ipsg', sev: 'low', test: function (c) {
        return has(c, /^arp-protect|^ip source-lockdown|^arp inspection/i) ? null : { ev: '-', fix: 'arp-protect / arp-protect vlan <ids> · ip source-lockdown' }; } },
      { id: 'no_port_sec', sev: 'medium', test: function (c) {
        return has(c, /port-security|port-access/i) ? null : { ev: '-', fix: 'port-security <ports> learn-mode limited-continuous address-limit 2' }; } },
      { id: 'http_server', sev: 'medium', test: function (c) {
        var ev = find(c, /^web-management plaintext/i);
        return ev ? { ev: ev, fix: 'no web-management plaintext / web-management ssl' } : null; } },
      { id: 'no_banner', sev: 'low', test: function (c) {
        return has(c, /^banner (motd|exec)/i) ? null : { ev: '-', fix: 'banner motd "Authorized access only"' }; } }
    ]
  };
  var SEV_ORDER = { high: 0, medium: 1, low: 2 };

  function audit(vendor, text, premium) {
    var cfg = parse(text);
    var rules = RULES[vendor] || RULES.cisco;
    var out = [], hidden = 0;
    if (!cfg.all.length) return { findings: [], hidden: 0, empty: true, lines: 0 };
    rules.forEach(function (r) {
      if (!premium && !r.free) { hidden++; return; }
      var res = r.test(cfg);
      if (res) out.push({ id: r.id, sev: r.sev, ev: res.ev, fix: res.fix });
    });
    out.sort(function (a, b) { return SEV_ORDER[a.sev] - SEV_ORDER[b.sev]; });
    return { findings: out, hidden: hidden, empty: false, lines: cfg.all.length };
  }

  /* ---------- 2) Compliance Engine ---------- */
  /* Politika sözdizimi: "+ metin" (olmalı) · "- metin" (olmamalı) · "# yorum"; /regex/ desteklenir. */
  function parsePolicy(text) {
    var rules = [];
    lines(text).forEach(function (raw) {
      var s = raw.trim();
      if (!s || s[0] === '#') return;
      var m = /^([+-])\s*(.+)$/.exec(s);
      if (!m) return;
      var pat = m[2].trim(), re = null;
      var rm = /^\/(.+)\/([i]?)$/.exec(pat);
      try { re = rm ? new RegExp(rm[1], 'i') : null; } catch (e) { re = null; }
      rules.push({ type: m[1] === '+' ? 'require' : 'forbid', label: pat, re: re });
    });
    return rules;
  }
  function matchLine(rule, line) {
    if (rule.re) return rule.re.test(line);
    return line.toLowerCase().indexOf(rule.label.toLowerCase()) !== -1;
  }
  function comply(policyText, cfgText) {
    var rules = parsePolicy(policyText);
    var cfg = parse(cfgText);
    var results = rules.map(function (r) {
      var hit = '';
      for (var i = 0; i < cfg.all.length; i++) if (matchLine(r, cfg.all[i])) { hit = cfg.all[i]; break; }
      var ok = r.type === 'require' ? !!hit : !hit;
      return { type: r.type, label: r.label, ok: ok, ev: hit };
    });
    var pass = results.filter(function (r) { return r.ok; }).length;
    return { results: results, pass: pass, total: results.length, score: results.length ? Math.round(pass * 100 / results.length) : 0, empty: !cfg.all.length };
  }
  var PRESETS = {
    cisco: '# Cisco IOS baz politika\n+ service password-encryption\n+ aaa new-model\n+ ip ssh version 2\n+ ntp server\n+ logging host\n+ spanning-tree portfast bpduguard default\n+ ip dhcp snooping\n- transport input telnet\n- ip http server\n- /snmp-server community (public|private)/',
    huawei: '# Huawei VRP baz politika\n+ stelnet server enable\n+ authentication-mode aaa\n+ ntp-service unicast-server\n+ info-center loghost\n+ stp bpdu-protection\n+ dhcp snooping enable\n- telnet server enable\n- http server enable\n- /password simple/\n- /snmp-agent community .*(public|private)/',
    aruba: '# Aruba baz politika\n+ ip ssh\n+ aaa authentication\n+ sntp server\n+ logging\n+ dhcp-snooping\n+ arp-protect\n- telnet-server\n- web-management plaintext\n- /snmp-server community "?(public|private)/'
  };

  /* ---------- 3) Troubleshooting Assistant ---------- */
  function vlanInList(spec, vlan) {
    var found = false;
    String(spec).replace(/(\d+)\s*(?:-|to)\s*(\d+)|(\d+)/g, function (_, a, b, c) {
      if (c !== undefined) { if (+c === vlan) found = true; }
      else if (vlan >= +a && vlan <= +b) found = true;
      return _;
    });
    return found;
  }
  function troubleshoot(text, vlan) {
    var out = [];
    var src = lines(text);
    function add(id, sev, ev) { out.push({ id: id, sev: sev, ev: ev }); }
    var seen = {};
    function once(id, sev, ev) { var k = id; if (seen[k]) return; seen[k] = 1; add(id, sev, ev); }

    src.forEach(function (l) {
      var s = l.trim();
      if (!s) return;
      if (/\b(INIT|Init)\b(\/|\s|$)/.test(s) && /\d+\.\d+\.\d+\.\d+/.test(s)) once('ospf_init', 'high', s);
      else if (/\b(2WAY|2-Way)\b/i.test(s) && /\d+\.\d+\.\d+\.\d+/.test(s) && !/DROTHER/i.test(s)) once('ospf_2way', 'medium', s);
      else if (/\b(EXSTART|ExStart|EXCHANGE|Exchange)\b/.test(s) && /\d+\.\d+\.\d+\.\d+/.test(s)) once('ospf_exstart', 'high', s);
      if (/err-?disabled/i.test(s)) once('errdis', 'high', s);
      if (/security.*violation|secure-shutdown|\bviolation\b/i.test(s)) once('portsec', 'high', s);
      var crc = /(\d+)\s+CRC\b/i.exec(s) || /\bCRC\s*[:=]\s*(\d+)/i.exec(s);
      if (crc && +crc[1] > 0) once('crc', +crc[1] > 100 ? 'high' : 'medium', s);
      if (/\bhalf[- ]duplex\b|\bHalf\b/.test(s) && /duplex|Half/i.test(s)) once('duplex', 'medium', s);
      if (/\b(BLK|BLOCKING|DISCARDING)\b/.test(s) && /\b(Desg|Root|Altn|Back|Mstr|FWD|BLK|Alternate|Backup)/i.test(s)) once('stp_block', 'low', s);
      if (/^\s*(Gi|Fa|Te|Eth|Po|GE|XGE)\S*\s+.*\b(notconnect|down)\b.*$/i.test(s) && /(notconnect|\bdown\b)/i.test(s) && !/administratively/i.test(s) && !/err-?dis/i.test(s)) once('link_down', 'medium', s);
    });

    if (vlan) {
      var v = +vlan;
      var trunkSeen = false, allowedOk = false, allowedLine = '';
      src.forEach(function (l, i) {
        if (/vlans allowed on trunk|allow-pass vlan|trunk allowed vlan/i.test(l)) {
          trunkSeen = true;
          var spec = l.replace(/^.*?(allowed on trunk|allow-pass vlan|allowed vlan( add)?)/i, '');
          // Cisco tablosunda değerler bir alt satırda olur
          var next = (src[i + 1] || '');
          var chunk = /\d/.test(spec) ? spec : next;
          if (/\ball\b/i.test(chunk) || vlanInList(chunk, v)) allowedOk = true;
          else allowedLine = l.trim() + ' ' + chunk.trim();
        }
      });
      if (trunkSeen && !allowedOk) add('trunk_vlan', 'high', allowedLine);
      var vlanTable = src.some(function (l) { return /VLAN\s+Name\s+Status|VID\s+Type\s+Ports|VLAN\s+ID/i.test(l); });
      if (vlanTable) {
        var inDb = src.some(function (l) { return new RegExp('^\\s*' + v + '\\s').test(l); });
        if (!inDb) add('vlan_missing', 'high', 'VLAN ' + v);
      }
    }
    out.sort(function (a, b) { return SEV_ORDER[a.sev] - SEV_ORDER[b.sev]; });
    return out;
  }

  /* ---------- 4) Topology ---------- */
  var IFR = /^(?:TenGigabitEthernet|GigabitEthernet|FastEthernet|XGigabitEthernet|Ethernet|Eth-Trunk|Port-channel|Tengig|Gig|Gi|Fas|Fa|Ten|Te|Eth|Et|Po|XGE|GE|MGE|Twe|Fo|Hu)\d+(?:[\/.:]\d+)*$/i;
  var PORTNUM = /^\d+\/\d+(?:\/\d+)?$/;
  function shortName(n) {
    n = String(n || '').trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(n) || /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i.test(n)) return n;
    return n.replace(/\..*$/, '') || n;
  }
  function isIf(t) { return IFR.test(t) || PORTNUM.test(t); }
  function parseNeighbors(text) {
    var current = '';
    var devices = {};
    var raw = [];
    var src = lines(text).map(function (l) {
      // "Gig 1/0/1" -> "Gig1/0/1"
      return l.replace(/\b(TenGigabitEthernet|GigabitEthernet|FastEthernet|Ethernet|Port-channel|Tengig|Gig|Gi|Fas|Fa|Ten|Te|Eth|Twe|Fo|Hu)\s+(\d)/gi, '$1$2');
    });
    for (var i = 0; i < src.length; i++) {
      var l = src[i].trim();
      if (!l) continue;
      var m = /^#{2,}\s*(\S+)/.exec(l) || /^<([\w.-]+)>/.exec(l) || /^([\w.-]+)#\s*(show|sh)\b/i.exec(l);
      if (m) { current = shortName(m[1]); devices[current] = 1; if (/^[\w.-]+#|^<[\w.-]+>/.test(l) || /^#/.test(l)) {} continue; }
      if (/^(Device ID|Local Intf|Local Interface|Capability codes|Total|Port\s+Device|System Name|-{3,})/i.test(l)) continue;
      // sarmalanmış satır: tek token + sonraki satır girintili
      var next = src[i + 1] || '';
      if (l.split(/\s+/).length === 1 && /^\s+\S/.test(next) && !isIf(l)) { l = l + ' ' + next.trim(); i++; }
      var tk = l.split(/\s+/);
      var idx = [];
      tk.forEach(function (t, k) { if (isIf(t)) idx.push(k); });
      if (!idx.length || !current) continue;
      var local, remote, dev;
      if (idx[0] === 0) {          // Huawei: local, device, remote...
        if (idx.length < 2 && tk.length < 3) continue;
        local = tk[0]; dev = tk[1];
        remote = idx.length > 1 ? tk[idx[idx.length - 1]] : tk[2];
      } else {                     // Cisco: device, local, ..., remote
        if (idx.length < 2) continue;
        dev = tk[0]; local = tk[idx[0]]; remote = tk[idx[idx.length - 1]];
      }
      dev = shortName(dev);
      if (!dev || isIf(dev) || dev.toLowerCase() === current.toLowerCase()) continue;
      raw.push({ a: current, ai: local, b: dev, bi: remote });
    }
    // çift yönlü kayıtları tekilleştir
    var seen = {}, links = [];
    raw.forEach(function (r) {
      var k1 = (r.a + ':' + r.ai).toLowerCase(), k2 = (r.b + ':' + r.bi).toLowerCase();
      var key = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
      if (seen[key]) return;
      seen[key] = 1;
      links.push(r);
    });
    return { links: links, sources: Object.keys(devices) };
  }
  function topology(text, inventoryText) {
    var p = parseNeighbors(text);
    var inv = {};
    lines(inventoryText).forEach(function (l) { var n = shortName(l.trim()); if (n) inv[n.toLowerCase()] = n; });
    var names = {};
    var src = {};
    p.sources.forEach(function (s) { src[s.toLowerCase()] = 1; });
    p.links.forEach(function (l) { names[l.a] = 1; names[l.b] = 1; });
    var hasInv = Object.keys(inv).length > 0;
    var nodes = Object.keys(names).map(function (n) {
      var k = n.toLowerCase();
      var known = hasInv ? !!inv[k] : !!src[k];
      return { name: n, known: known };
    });
    var missing = hasInv ? Object.keys(inv).filter(function (k) { return !names[inv[k]] && !Object.keys(names).some(function (n) { return n.toLowerCase() === k; }); }).map(function (k) { return inv[k]; }) : [];
    return { nodes: nodes, links: p.links, unknown: nodes.filter(function (n) { return !n.known; }).map(function (n) { return n.name; }), missing: missing };
  }
  function linkKey(l) {
    var a = (l.a + ':' + l.ai).toLowerCase(), b = (l.b + ':' + l.bi).toLowerCase();
    return a < b ? a + ' <-> ' + b : b + ' <-> ' + a;
  }
  function topoDiff(oldLinks, newLinks) {
    var o = {}, n = {};
    oldLinks.forEach(function (l) { o[linkKey(l)] = 1; });
    newLinks.forEach(function (l) { n[linkKey(l)] = 1; });
    return {
      added: Object.keys(n).filter(function (k) { return !o[k]; }),
      removed: Object.keys(o).filter(function (k) { return !n[k]; })
    };
  }
  function xmlEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function topoSvg(topo) {
    var N = topo.nodes, W = 760, H = 520, cx = W / 2, cy = H / 2;
    var R = Math.min(W, H) / 2 - 70;
    var pos = {};
    N.forEach(function (n, i) {
      if (N.length === 1) { pos[n.name] = [cx, cy]; return; }
      var a = (2 * Math.PI * i) / N.length - Math.PI / 2;
      pos[n.name] = [Math.round(cx + R * Math.cos(a)), Math.round(cy + R * Math.sin(a))];
    });
    var s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" font-family="monospace" font-size="11" direction="ltr">',
      '<rect width="100%" height="100%" fill="#050a0f"/>'];
    topo.links.forEach(function (l) {
      var a = pos[l.a], b = pos[l.b];
      if (!a || !b) return;
      s.push('<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="#3de0ff" stroke-opacity=".6"/>');
      s.push('<text x="' + Math.round(a[0] + (b[0] - a[0]) * 0.22) + '" y="' + Math.round(a[1] + (b[1] - a[1]) * 0.22) + '" fill="#8fa8a0" font-size="9">' + xmlEsc(l.ai) + '</text>');
      s.push('<text x="' + Math.round(a[0] + (b[0] - a[0]) * 0.78) + '" y="' + Math.round(a[1] + (b[1] - a[1]) * 0.78) + '" fill="#8fa8a0" font-size="9">' + xmlEsc(l.bi) + '</text>');
    });
    N.forEach(function (n) {
      var p = pos[n.name], col = n.known ? '#39ff9c' : '#ff6b6b';
      s.push('<rect x="' + (p[0] - 34) + '" y="' + (p[1] - 13) + '" width="68" height="26" rx="5" fill="#09141a" stroke="' + col + '"/>');
      s.push('<text x="' + p[0] + '" y="' + (p[1] + 4) + '" fill="' + col + '" text-anchor="middle">' + xmlEsc(n.name.length > 11 ? n.name.slice(0, 10) + '…' : n.name) + '</text>');
    });
    s.push('</svg>');
    return s.join('');
  }
  var SAMPLE = '### CORE1\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\nDIST1.corp.local Gig 1/0/1         150        R S I       WS-C3850  Gig 1/0/48\nDIST2            Gig 1/0/2         150        R S I       S5735     GE0/0/1\n\n### DIST1\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\nCORE1            Gig 1/0/48        150        R S I       WS-C3850  Gig 1/0/1\nACC1             Gig 1/0/10        150        S I         WS-C2960  Gig 0/1\nROGUE-SW         Gig 1/0/20        150        S           Unknown   Gig 0/1\n\n<DIST2>display lldp neighbor brief\nLocal Intf   Neighbor Dev     Neighbor Intf     Exptime(s)\nGE0/0/1      CORE1            Gig1/0/2          100\nGE0/0/2      ACC2             GE0/0/24          100\n';

  var api = {
    parse: parse, audit: audit, RULES: RULES, comply: comply, parsePolicy: parsePolicy, PRESETS: PRESETS,
    troubleshoot: troubleshoot, parseNeighbors: parseNeighbors, topology: topology, topoDiff: topoDiff,
    topoSvg: topoSvg, linkKey: linkKey, SAMPLE: SAMPLE, vlanInList: vlanInList
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
