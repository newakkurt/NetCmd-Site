-- Product-specific reads for one-time BMC Shop purchases.
-- Monthly Premium policies remain unchanged. A Shop entitlement can read only
-- the exact asset row/object assigned to its own product slug.

drop policy if exists shop_product_assets_read on public.premium_assets;
create policy shop_product_assets_read
  on public.premium_assets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.netcmd_product_entitlements e
      where e.user_id = (select auth.uid())
        and e.active = true
        and (
          (e.product_slug = 'config-auditor-pro' and premium_assets.name = 'plib-config-auditor')
          or (e.product_slug = 'topology-discovery-pro' and premium_assets.name = 'plib-topology')
          or (e.product_slug = 'troubleshooting-pro' and premium_assets.name = 'plib-troubleshooting')
          or (e.product_slug = 'bulk-automation-pro' and premium_assets.name = 'plib-bulk-automation')
          or (e.product_slug = 'network-intelligence-reports-pro' and premium_assets.name = 'plib-premium-intel')
        )
    )
  );

drop policy if exists shop_product_storage_read on storage.objects;
create policy shop_product_storage_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'premium'
    and exists (
      select 1
      from public.netcmd_product_entitlements e
      where e.user_id = (select auth.uid())
        and e.active = true
        and (
          (e.product_slug = 'config-auditor-pro' and storage.objects.name = 'plib-config-auditor.js')
          or (e.product_slug = 'topology-discovery-pro' and storage.objects.name = 'plib-topology.js')
          or (e.product_slug = 'troubleshooting-pro' and storage.objects.name = 'plib-troubleshooting.js')
          or (e.product_slug = 'bulk-automation-pro' and storage.objects.name = 'plib-bulk-automation.js')
          or (e.product_slug = 'network-intelligence-reports-pro' and storage.objects.name = 'plib-premium-intel.js')
        )
    )
  );
