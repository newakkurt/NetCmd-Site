# Buy Me a Coffee Shop products (one-time $30 purchases)

This flow is deliberately separate from the monthly NetCmd PRO membership and its existing webhook.

## Shop setup

Create five digital Shop items in Buy Me a Coffee, each priced at **USD 30**:

- Config Auditor PRO
- Topology Discovery PRO
- Troubleshooting Assistant PRO
- Bulk Automation PRO
- Network Intelligence Reports PRO

Use the same names as the NetCmd project cards. BMC Shop can deliver a downloadable file or redirect buyers after checkout; use the redirect option only after the NetCmd account-based access flow is finished.

For each Shop item, note its numeric Extra ID from a real `extra_purchase.created` delivery. The BMC webhook schema includes `data.extras[].id`, title, amount, currency and quantity. The signed webhook uses the `x-signature-sha256` HMAC-SHA256 header.

## Supabase setup

1. Apply `supabase/bmc_shop_products.sql` to the existing Supabase project.
2. Deploy `supabase/functions/bmc-shop-webhook/index.ts` as Edge Function `bmc-shop-webhook`, with JWT verification disabled (it verifies BMC's signature itself).
3. Set Edge Function secrets:
   - `BMC_SHOP_WEBHOOK_SECRET`: the signing secret for this Shop webhook (each BMC webhook has its own secret).
   - `BMC_SHOP_PRODUCT_MAP`: JSON mapping BMC Extra IDs to NetCmd product slugs, e.g. `{"12345":"config-auditor-pro","23456":"topology-discovery-pro"}`.
4. In BMC Integrations, create a separate webhook pointed at:
   `https://olbyrzqjdbxxsfaonsew.supabase.co/functions/v1/bmc-shop-webhook`
   Subscribe to `extra_purchase.created`, `extra_purchase.updated`, and `extra_purchase.refunded`.
5. Send test events, then make a real low-risk test purchase/refund before launch.

## Important status

This is the server-side entitlement foundation only. Do not publish the Shop purchase buttons or claim that one-time purchases unlock a tool until the frontend checks `netcmd_product_entitlements` and the premium module's RLS policy is updated and tested. Existing monthly membership behavior is unchanged.

The webhook only grants a mapped product when the item line is exactly USD 30 and the BMC payment status is `succeeded`; refunds revoke that order's entitlement. Buyers must register in NetCmd with the same email used at BMC checkout.
