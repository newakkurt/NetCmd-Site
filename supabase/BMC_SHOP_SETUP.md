# Buy Me a Coffee Shop products (one-time $30 purchases)

This flow is separate from the monthly NetCmd PRO membership. Keep the monthly webhook, secret, and membership level unchanged.

## Live BMC Shop items

The five USD 30 Shop items already created by the owner are:

| Product slug | BMC Extra ID | Checkout |
|---|---:|---|
| config-auditor-pro | 594541 | https://buymeacoffee.com/sevketkaynar/e/594541 |
| topology-discovery-pro | 594543 | https://buymeacoffee.com/sevketkaynar/e/594543 |
| troubleshooting-pro | 594544 | https://buymeacoffee.com/sevketkaynar/e/594544 |
| bulk-automation-pro | 594545 | https://buymeacoffee.com/sevketkaynar/e/594545 |
| network-intelligence-reports-pro | 594548 | https://buymeacoffee.com/sevketkaynar/e/594548 |

The webhook currently contains this exact Extra-ID-to-slug mapping in `supabase/functions/bmc-shop-webhook/index.ts`. It does **not** currently read `BMC_SHOP_PRODUCT_MAP` from environment variables; do not configure or rely on that variable unless the function is changed to support it.

## Supabase webhook

1. Edge Function name: `bmc-shop-webhook`.
2. Endpoint:
   `https://olbyrzqjdbxxsfaonsew.supabase.co/functions/v1/bmc-shop-webhook`
3. JWT verification is disabled for this endpoint because the function verifies BMC's HMAC-SHA256 signature from `x-signature-sha256`.
4. Required secrets: `BMC_SHOP_WEBHOOK_SECRET`, plus Supabase's platform-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
5. Subscribe to `extra_purchase.created`, `extra_purchase.updated`, and `extra_purchase.refunded`.

The webhook grants only mapped line items whose amount is exactly USD 30 and whose payment status is `succeeded`. Refund events revoke the order's entitlement. Buyers must register in NetCmd with the same email used at BMC checkout. If the account does not exist yet, the webhook returns HTTP 409 so BMC can retry after signup.

## Product-specific asset policies now applied

Migration `20261104120000_bmc_shop_product_asset_read_policies.sql` is applied to Supabase. It adds SELECT policies for exact product asset names in `premium_assets` and exact filenames in the private `premium` bucket. The existing monthly Premium policies are unchanged. Product entitlements are still empty until real purchases arrive.

Expected asset names:
- `plib-config-auditor` / `plib-config-auditor.js`
- `plib-topology` / `plib-topology.js`
- `plib-troubleshooting` / `plib-troubleshooting.js`
- `plib-bulk-automation` / `plib-bulk-automation.js`
- `plib-premium-intel` / `plib-premium-intel.js`

## Launch blockers — do not publish product buttons as working unlocks yet

- `assets/premium.js` still loads the shared `plib-premium` bundle for monthly members only; product-specific bundle loading is not implemented yet.
- The private `premium` Storage bucket and `premium_assets` table now have product-specific read policies, but the four new product assets do not exist yet.
- The shared `plib-premium` module contains multiple products' code. Granting that whole file to a one-product buyer would expose unrelated PRO features.
- Network Intelligence Reports has a separate `plib-premium-intel` row, but its dependency on the shared core and its product-specific access policy still need to be separated and tested.
- Split the remaining products into independent modules, add product-specific entitlement-aware read policies, and test purchase, duplicate delivery, refund, stale-event ordering, and email/account matching before merging the website checkout UI.

Existing monthly membership behavior and secrets must remain unchanged.
