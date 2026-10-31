const test = require('node:test');
const assert = require('node:assert/strict');
const NetLib = require('../assets/netlib.js');

test('classifies show/display commands as read-only', () => {
  assert.equal(NetLib.classify('cisco', 'show vlan brief').kind, 'read');
  assert.equal(NetLib.classify('huawei', 'display current-configuration').kind, 'read');
});

test('marks destructive commands as dangerous', () => {
  assert.equal(NetLib.classify('cisco', 'reload').kind, 'danger');
  assert.equal(NetLib.classify('huawei', 'reset factory-configuration').kind, 'danger');
});

test('detects configuration changes and provides prechecks', () => {
  const result = NetLib.analyzeChange('cisco', 'interface GigabitEthernet1/0/1\n shutdown');
  assert.equal(result.changing, true);
  assert.ok(result.counts.config >= 1);
  assert.ok(NetLib.precheckCommands('cisco').includes('show interfaces status'));
});

test('generated Netmiko collector rejects unknown or changed SSH host keys', () => {
  const script = NetLib.buildNetmiko('cisco', ['192.0.2.10'], ['show version']);
  assert.match(script, /"ssh_strict": True/);
  assert.match(script, /"system_host_keys": True/);
});

test('generated Aruba AOS-CX inventory validates TLS certificates', () => {
  const generated = NetLib.buildAnsible('aruba_cx', ['192.0.2.20'], ['show version']);
  assert.match(generated.inventory, /ansible_httpapi_validate_certs: true/);
  assert.doesNotMatch(generated.inventory, /ansible_httpapi_validate_certs: false/);
});

test('config diff reports changed VLAN and interface blocks', () => {
  const before = 'vlan 10\n name USERS\n!\ninterface Gi1/0/1\n switchport access vlan 10\n!';
  const after = 'vlan 10\n name STAFF\n!\ninterface Gi1/0/1\n switchport access vlan 20\n!';
  const diff = NetLib.diffConfigs(before, after);
  assert.equal(diff.changes.length, 2);
  assert.equal(diff.counts.vlan, 1);
  assert.equal(diff.counts.port, 1);
});
