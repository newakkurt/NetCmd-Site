/* NetCmd Shop entitlement map. No network calls; shared by UI and tests. */
(function (root) {
  'use strict';
  var MAP = {
    aud: { slug: 'config-auditor-pro', asset: 'plib-config-auditor', flag: 'CONFIG_AUDITOR_PRO_LOADED' },
    trouble: { slug: 'troubleshooting-pro', asset: '', flag: '' },
    comp: { slug: 'config-auditor-pro', asset: 'plib-config-auditor', flag: 'CONFIG_AUDITOR_PRO_LOADED' },
    topo: { slug: 'topology-discovery-pro', asset: 'plib-topology', flag: 'TOPOLOGY_PRO_LOADED' },
    bulk: { slug: 'bulk-automation-pro', asset: 'plib-bulk-automation', flag: 'BULK_AUTOMATION_PRO_LOADED' },
    coll: { slug: 'topology-discovery-pro', asset: 'plib-topology', flag: 'TOPOLOGY_PRO_LOADED' },
    intel: { slug: 'network-intelligence-reports-pro', asset: 'plib-premium-intel', flag: 'INTEL_LOADED' }
  };
  function forTool(tool) {
    var item = MAP[String(tool || '')];
    return item ? { slug: item.slug, asset: item.asset, flag: item.flag } : null;
  }
  function resolve(tool, activeSlugs) {
    var item = forTool(tool), list = Array.isArray(activeSlugs) ? activeSlugs : [];
    return { product: item, allowed: !!item && list.indexOf(item.slug) !== -1 };
  }
  root.NetCmdShop = { forTool: forTool, resolve: resolve };
})(typeof window !== 'undefined' ? window : globalThis);
