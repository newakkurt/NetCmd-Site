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

Product asset rows now stored in `premium_assets`:
- `plib-config-auditor` — premium audit rules + Compliance engine
- `plib-topology` — topology parser/visualizer + read-only Discovery Collector
- `plib-bulk-automation` — bulk script generator
- `plib-premium-intel` — Network Intelligence Reports
- Troubleshooting PRO does not require a separate JS asset; it uses the public troubleshooting engine and gates the expanded guidance by entitlement.

The matching private Storage filenames remain reserved by RLS policy, but the frontend currently loads the isolated product code from `premium_assets`.

## Current integration status

- `assets/premium.js` reads the signed-in user's active `product_slug` entitlements and loads only the exact asset associated with the current tool. A Shop buyer is never sent the shared monthly `plib-premium` bundle.
- Monthly Premium continues to use the existing shared `plib-premium` bundle and its existing RLS policy.
- Troubleshooting PRO uses the public troubleshooting engine and unlocks expanded step-by-step guidance only for an active `troubleshooting-pro` entitlement.
- The entitlement map is isolated in `assets/shop-entitlements.js`, loaded before `premium.js`, and covered by Node tests for product-to-tool mapping, cross-product denial, revoked/malformed access, and full Troubleshooting PRO unlock.
- Four isolated product modules are now stored in `premium_assets`: Config Auditor + Compliance, Topology Discovery + read-only Collector, Bulk Automation, and Network Intelligence Reports.
- Smoke tests compiled and loaded all four modules together with the public `plib.js` base. The checks exercised extra audit findings, Compliance rules, five sample topology links, Collector generation, Bulk Automation generation and rejection of a dangerous `reload` command, and Intelligence Reports for Cisco IOS, Huawei VRP, and Aruba sample configurations. The report-diff check detected a changed device.
- The product-specific SELECT policies map each slug to its exact asset row in `premium_assets`. Existing monthly policies are unchanged. Product JavaScript is currently fetched from this table; the private Storage files are not needed by the current loader.

## Remaining launch blockers — do not merge or announce working product unlocks yet

1. Add automated browser/frontend entitlement-loader tests: no session => no product assets; inactive entitlement => locked; active product A => only asset A requested; product A must not request B/C/D/E or `plib-premium`; monthly Premium retains its existing shared bundle.
2. Test signed purchase, duplicate delivery, refund, stale-event ordering, wrong email, and buyer email/account matching with safe test events.
3. Complete a real BMC test purchase and confirm the matching NetCmd account receives only the purchased product. Supabase currently reports 0 active Shop entitlements.
4. Run and review the full GitHub validation workflow and verify the generated `/tr/tools/intel/` and `/en/tools/intel/` pages before merging.

Existing monthly membership behavior and secrets must remain unchanged.
