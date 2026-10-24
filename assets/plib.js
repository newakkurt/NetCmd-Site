/* NetCmd araç kütüphanesi (herkese açık kısım): config denetimi (temel kurallar) ve sorun giderme.
   Premium kuralları, uyumluluk, topoloji ve dışa aktarım Supabase'de saklanır; yalnızca Premium üyelere sunulur. */
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


  /* ---------- 1) Config Auditor (temel kurallar) ---------- */
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
        return { ev: find(c, /^ip ssh/i) || '-', fix: 'ip domain-name <d> / crypto key generate rsa modulus 2048 / ip ssh version 2' }; } }
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
        return has(c, /^stelnet server enable/i) ? null : { ev: '-', fix: 'rsa local-key-pair create / stelnet server enable / ssh user <u> authentication-type password' }; } }
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
        return has(c, /^ip ssh\b|^ssh server/i) ? null : { ev: '-', fix: 'ip ssh / crypto key generate ssh (AOS-S) · ssh server vrf mgmt (AOS-CX)' }; } }
    ]
  };
  var PREMIUM_RULE_COUNT = {"cisco": 11, "huawei": 11, "aruba": 9};
  var SEV_ORDER = { high: 0, medium: 1, low: 2 };

  function audit(vendor, text, premium) {
    var cfg = parse(text);
    var base = RULES[vendor] || RULES.cisco;
    var extra = premium && api.EXTRA ? (api.EXTRA[vendor] || api.EXTRA.cisco) : [];
    var out = [];
    if (!cfg.all.length) return { findings: [], hidden: 0, empty: true, lines: 0 };
    base.concat(extra).forEach(function (r) {
      var res = r.test(cfg);
      if (res) out.push({ id: r.id, sev: r.sev, ev: res.ev, fix: res.fix });
    });
    out.sort(function (a, b) { return SEV_ORDER[a.sev] - SEV_ORDER[b.sev]; });
    var hidden = premium && api.EXTRA ? 0 : (PREMIUM_RULE_COUNT[vendor] || PREMIUM_RULE_COUNT.cisco);
    return { findings: out, hidden: hidden, empty: false, lines: cfg.all.length };
  }

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

  /* Ücretsiz demo için hazır topoloji (gerçek motor yalnızca Premium'da yüklenir) */
  var DEMO = {"svg":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 760 520\" width=\"100%\" font-family=\"monospace\" font-size=\"11\" direction=\"ltr\"><rect width=\"100%\" height=\"100%\" fill=\"#050a0f\"/><line x1=\"380\" y1=\"70\" x2=\"545\" y2=\"165\" stroke=\"#3de0ff\" stroke-opacity=\".6\"/><text x=\"416\" y=\"91\" fill=\"#8fa8a0\" font-size=\"9\">Gig1/0/1</text><text x=\"509\" y=\"144\" fill=\"#8fa8a0\" font-size=\"9\">Gig1/0/48</text><line x1=\"380\" y1=\"70\" x2=\"545\" y2=\"355\" stroke=\"#3de0ff\" stroke-opacity=\".6\"/><text x=\"416\" y=\"133\" fill=\"#8fa8a0\" font-size=\"9\">Gig1/0/2</text><text x=\"509\" y=\"292\" fill=\"#8fa8a0\" font-size=\"9\">GE0/0/1</text><line x1=\"545\" y1=\"165\" x2=\"380\" y2=\"450\" stroke=\"#3de0ff\" stroke-opacity=\".6\"/><text x=\"509\" y=\"228\" fill=\"#8fa8a0\" font-size=\"9\">Gig1/0/10</text><text x=\"416\" y=\"387\" fill=\"#8fa8a0\" font-size=\"9\">Gig0/1</text><line x1=\"545\" y1=\"165\" x2=\"215\" y2=\"355\" stroke=\"#3de0ff\" stroke-opacity=\".6\"/><text x=\"472\" y=\"207\" fill=\"#8fa8a0\" font-size=\"9\">Gig1/0/20</text><text x=\"288\" y=\"313\" fill=\"#8fa8a0\" font-size=\"9\">Gig0/1</text><line x1=\"545\" y1=\"355\" x2=\"215\" y2=\"165\" stroke=\"#3de0ff\" stroke-opacity=\".6\"/><text x=\"472\" y=\"313\" fill=\"#8fa8a0\" font-size=\"9\">GE0/0/2</text><text x=\"288\" y=\"207\" fill=\"#8fa8a0\" font-size=\"9\">GE0/0/24</text><rect x=\"346\" y=\"57\" width=\"68\" height=\"26\" rx=\"5\" fill=\"#09141a\" stroke=\"#39ff9c\"/><text x=\"380\" y=\"74\" fill=\"#39ff9c\" text-anchor=\"middle\">CORE1</text><rect x=\"511\" y=\"152\" width=\"68\" height=\"26\" rx=\"5\" fill=\"#09141a\" stroke=\"#39ff9c\"/><text x=\"545\" y=\"169\" fill=\"#39ff9c\" text-anchor=\"middle\">DIST1</text><rect x=\"511\" y=\"342\" width=\"68\" height=\"26\" rx=\"5\" fill=\"#09141a\" stroke=\"#39ff9c\"/><text x=\"545\" y=\"359\" fill=\"#39ff9c\" text-anchor=\"middle\">DIST2</text><rect x=\"346\" y=\"437\" width=\"68\" height=\"26\" rx=\"5\" fill=\"#09141a\" stroke=\"#39ff9c\"/><text x=\"380\" y=\"454\" fill=\"#39ff9c\" text-anchor=\"middle\">ACC1</text><rect x=\"181\" y=\"342\" width=\"68\" height=\"26\" rx=\"5\" fill=\"#09141a\" stroke=\"#ff6b6b\"/><text x=\"215\" y=\"359\" fill=\"#ff6b6b\" text-anchor=\"middle\">ROGUE-SW</text><rect x=\"181\" y=\"152\" width=\"68\" height=\"26\" rx=\"5\" fill=\"#09141a\" stroke=\"#39ff9c\"/><text x=\"215\" y=\"169\" fill=\"#39ff9c\" text-anchor=\"middle\">ACC2</text></svg>","links":[{"a":"CORE1","ai":"Gig1/0/1","b":"DIST1","bi":"Gig1/0/48"},{"a":"CORE1","ai":"Gig1/0/2","b":"DIST2","bi":"GE0/0/1"},{"a":"DIST1","ai":"Gig1/0/10","b":"ACC1","bi":"Gig0/1"},{"a":"DIST1","ai":"Gig1/0/20","b":"ROGUE-SW","bi":"Gig0/1"},{"a":"DIST2","ai":"GE0/0/2","b":"ACC2","bi":"GE0/0/24"}],"unknown":["ROGUE-SW"],"missing":["ACC3"]};


  var api = {
    parse: parse, audit: audit, troubleshoot: troubleshoot, vlanInList: vlanInList, DEMO: DEMO,
    _h: { lines: lines, parse: parse, has: has, find: find, ifBlocks: ifBlocks, SEV_ORDER: SEV_ORDER }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
