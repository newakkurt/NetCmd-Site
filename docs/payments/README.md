# NetCmd payment integration plan

This document records the two selected payment paths without enabling either one
in production. Existing payment work remains in its own review branches until
the provider and live-event checks are complete.

## Selected paths

### 1. Direct bank transfer (IBAN / FAST / EFT)

- Create a server-side order with an immutable order reference, product/plan,
  amount, currency, expiry and owner.
- Display the beneficiary details only from server-side environment/configuration.
- Require the customer to put the order reference in the transfer description.
- Mark the order as `reported` when the customer says they paid.
- Reconcile against bank-originated transaction data; never unlock a paid product
  from a client-side "I paid" click or an uploaded receipt alone.
- Keep an admin exception path for unmatched transfers and partial/duplicate
  amounts; record who approved and why.

### 2. Automatic provider events

- Keep the existing BMC monthly membership webhook separate from one-time Shop
  purchases.
- Verify the provider signature over the raw request body.
- Make event handling idempotent and reject stale event updates.
- Grant only the exact product entitlement after a successful paid event.
- Revoke or expire entitlements on refunds/cancellations according to the
  provider's authoritative event.
- Do not treat a provider's test-mode event as a live purchase.

## Ziraat Bankası integration research

The official Ziraat API portal lists account movement and incoming money
transfer query APIs. Ziraat also documents corporate MT940/942 statement
integration delivered by web service, e-mail, FTP or SFTP, with scheduled
statement frequencies. These are promising routes for automatic IBAN
reconciliation, but access is subject to the account holder's bank agreement,
application, credentials, allowed IPs and enabled services.

Official references:
- https://developers.ziraatbank.com.tr/pages/apis.html
- https://www.ziraatbank.com.tr/tr/kurumsal/nakit-yonetimi/hesap-hareketleri-entegrasyonu/text-swift-mt-940-formatinda-muhasebe-entegrasyonu

No undocumented endpoint, online-banking password scraping, or browser
automation will be used. Until the bank confirms access, use a secure statement
import/manual reconciliation workflow; do not claim automatic confirmation.

## Production prerequisites

- Confirm the legal seller identity, contact details, tax status and applicable
  distance-sales/refund terms with an accountant/legal adviser.
- Confirm the account holder and IBAN with the bank. Keep the IBAN out of Git.
- Obtain Ziraat API/statement service approval and technical docs if automation
  is wanted.
- Configure provider secrets in Supabase Edge Function secrets, never in
  `data/site.json` or browser JavaScript.
- Run signed test events, then a low-value real purchase/transfer and refund
  before turning on public entitlement grants.

## Current implementation status

- IBAN order-code / admin approval flow: included in `feature/launch-readiness`
  (`supabase/iban_orders.sql`, Premium page panel, Telegram one-tap approval).
  The panel stays hidden until `BANK_IBAN` and `BANK_HOLDER` build env vars are set
  on Render; the IBAN is mod-97 validated at build time and never committed.
  No automatic bank reconciliation: an admin confirms each transfer.
- BMC monthly membership: automatic via signed webhook; `premium_until` expires access.
- Legal pages: Terms, Privacy/KVKK, Refund & Withdrawal, Distance Sales. Seller
  `address` / `tax_no` in `data/site.json` must be filled before taking payments.
- Account page shows plan and period end date.
- SaaS API foundation / worker: merged earlier; worker stays idle until the
  GitHub Actions secrets are added (see FREE_SAAS_ARCHITECTURE.md).
