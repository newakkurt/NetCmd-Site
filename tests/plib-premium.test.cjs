'use strict';
// Premium modül testleri. private/plib-premium.js repoda yoktur (gitignore); yoksa testler atlanır.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'private', 'plib-premium.js');
const file = path.join(__dirname, '..', 'private', 'plib-premium-intel.js');
const skip = !(fs.existsSync(base) && fs.existsSync(file)) && 'private/plib-premium*.js yok';

test('Network Intelligence Reports: rapor, snapshot ve diff', { skip }, () => {
  const PLib = require('../assets/plib.js');
  globalThis.PLib = PLib;
  new Function('PLib', fs.readFileSync(base, 'utf8'))(PLib);
  new Function('PLib', fs.readFileSync(file, 'utf8'))(PLib);
  const cfg = 'hostname SW-A\nvlan 10\nvlan 20,30\ninterface GigabitEthernet1/0/1\n switchport mode access\ninterface GigabitEthernet1/0/2\n switchport mode trunk\ninterface GigabitEthernet1/0/3\n shutdown\nline vty 0 15\n transport input telnet\n';
  const r = PLib.report('cisco', [{ name: 'a.cfg', text: cfg }, { name: 'b.cfg', text: cfg }, { name: 'x', text: ' ' }]);
  assert.strictEqual(r.devices.length, 2);
  assert.notStrictEqual(r.devices[0].host.toLowerCase(), r.devices[1].host.toLowerCase());
  const d = r.devices.find((x) => x.host === 'SW-A');
  assert.strictEqual(d.vlans, 3);
  assert.strictEqual(d.ports, 3);
  assert.strictEqual(d.shut, 1);
  const fixed = PLib.report('cisco', [{ name: 'a.cfg', text: cfg.replace('telnet', 'ssh') }]);
  const df = PLib.reportDiff(PLib.reportSnapshot(r), fixed);
  assert.ok(df.changed.some((c) => c.fixed.includes('telnet')));
  assert.ok(df.removed.length === 1);
});
