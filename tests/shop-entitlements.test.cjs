'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/shop-entitlements.js', 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context, { filename: 'shop-entitlements.js' });
const shop = context.window.NetCmdShop;

test('every paid tool maps only to its intended Shop product and asset', () => {
  const expected = {
    aud: ['config-auditor-pro', 'plib-config-auditor'],
    trouble: ['troubleshooting-pro', ''],
    comp: ['config-auditor-pro', 'plib-config-auditor'],
    topo: ['topology-discovery-pro', 'plib-topology'],
    bulk: ['bulk-automation-pro', 'plib-bulk-automation'],
    coll: ['topology-discovery-pro', 'plib-topology'],
    intel: ['network-intelligence-reports-pro', 'plib-premium-intel']
  };
  for (const [tool, [slug, asset]] of Object.entries(expected)) {
    const result = shop.resolve(tool, [slug]);
    assert.equal(result.allowed, true, tool);
    assert.equal(result.product.slug, slug, tool);
    assert.equal(result.product.asset, asset, tool);
  }
});

test('a product purchase cannot unlock another product', () => {
  for (const [tool, slug] of [
    ['aud', 'config-auditor-pro'], ['topo', 'topology-discovery-pro'],
    ['bulk', 'bulk-automation-pro'], ['intel', 'network-intelligence-reports-pro']
  ]) {
    const otherSlugs = ['config-auditor-pro', 'topology-discovery-pro', 'bulk-automation-pro',
      'network-intelligence-reports-pro', 'troubleshooting-pro'].filter(x => x !== slug);
    assert.equal(shop.resolve(tool, otherSlugs).allowed, false, tool);
  }
});

test('revoked, missing, malformed and unknown tool access is denied', () => {
  assert.equal(shop.resolve('bulk', []).allowed, false);
  assert.equal(shop.resolve('bulk', null).allowed, false);
  assert.equal(shop.resolve('bulk', 'bulk-automation-pro').allowed, false);
  assert.equal(shop.resolve('unknown', ['bulk-automation-pro']).allowed, false);
  assert.equal(shop.resolve('', ['config-auditor-pro']).allowed, false);
});

test('related pages share only their intended product entitlement', () => {
  assert.equal(shop.resolve('aud', ['config-auditor-pro']).allowed, true);
  assert.equal(shop.resolve('comp', ['config-auditor-pro']).allowed, true);
  assert.equal(shop.resolve('topo', ['topology-discovery-pro']).allowed, true);
  assert.equal(shop.resolve('coll', ['topology-discovery-pro']).allowed, true);
});
