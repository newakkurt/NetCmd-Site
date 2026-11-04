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

## Current integration status

- `assets/premium.js` reads the signed-in user's active `product_slug` entitlements and loads only the exact asset associated with the current tool. A Shop buyer is never sent the shared monthly `plib-premium` bundle.
- Monthly Premium continues to use the existing shared `plib-premium` bundle and its existing RLS policy.
- Troubleshooting PRO uses the public troubleshooting engine and unlocks the expanded step-by-step guidance only for an active `troubleshooting-pro` entitlement; it does not need a separate JavaScript asset.
- Network Intelligence Reports has a separate `tools/intel/` page and loads only `plib-premium-intel` for an active `network-intelligence-reports-pro` entitlement. The module uses the public `plib.js` helpers and does not load the private shared monthly bundle.
- The Intelligence Reports module was exercised against sample Cisco IOS, Huawei VRP, and Aruba configurations. All three returned device/port/VLAN summaries, and the period-diff check detected a changed device. These are logic smoke tests, not production acceptance tests.
- Three product-specific JavaScript assets are still missing: `plib-config-auditor`, `plib-topology`, and `plib-bulk-automation`. The Config Auditor asset should contain its premium audit rules and the Compliance engine. Topology Discovery should contain the topology parser/visualizer and read-only collector. Bulk Automation should contain only its generator and required export helpers.
- The product-specific SELECT policies already map each slug to its exact row/file in `premium_assets` and the private `premium` bucket. Existing monthly policies are unchanged.

## Remaining launch blockers — do not merge or announce working product unlocks yet

1. Create and test the three missing isolated assets above; verify each module exports the exact flag expected by `assets/premium.js`.
2. Add automated entitlement-loader tests: no session => no product assets; inactive entitlement => locked; active product A => only asset A requested; product A must not request B/C/D/E or `plib-premium`; monthly Premium retains its existing shared bundle.
3. Test signed purchase, duplicate delivery, refund, stale-event ordering, wrong email, and buyer email/account matching with safe test events.
4. Complete a real BMC test purchase and confirm the matching NetCmd account receives only the purchased product. Supabase currently reports 0 active Shop entitlements.

Existing monthly membership behavior and secrets must remain unchanged.
