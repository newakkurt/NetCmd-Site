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

## Launch blockers — do not publish product buttons as working unlocks yet

- `assets/premium.js` currently checks only the monthly `profiles.is_premium` membership.
- The `premium_assets` table and private `premium` Storage bucket currently allow reads only to monthly Premium members.
- The shared `plib-premium` module contains multiple products' code. Granting that whole file to a one-product buyer would expose unrelated PRO features.
- Network Intelligence Reports has a separate `plib-premium-intel` row, but its dependency on the shared core and its product-specific access policy still need to be separated and tested.
- Split the remaining products into independent modules, add product-specific entitlement-aware read policies, and test purchase, duplicate delivery, refund, stale-event ordering, and email/account matching before merging the website checkout UI.

Existing monthly membership behavior and secrets must remain unchanged.
