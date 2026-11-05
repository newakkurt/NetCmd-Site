# NetCmd zero-extra-Render-cost deployment

The existing NetCmd static site remains on Render Static Site. This path adds
no paid Render API or background worker.

## Architecture

- Frontend: existing Render Static Site.
- Authentication/database: existing Supabase project.
- API ingress: deployed Supabase Edge Function `netcmd-jobs`, with JWT
  verification and server-side entitlement checks.
- Queue: additive Supabase Postgres tables and service-role-only RPC functions.
- Worker: `.github/workflows/netcmd-free-worker.yml`, scheduled every
  15 minutes on the default branch and manually dispatchable.
- Payment: existing Buy Me a Coffee membership and webhook flow remains
  unchanged.

## Production status

- SaaS queue tables and RPC functions: applied to Supabase.
- Edge Function `netcmd-jobs`: deployed and ACTIVE.
- PR #22: merged to `main`; CI passed.
- GitHub Actions secrets `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY`: must be added by a repository administrator.
  Until both exist, the worker intentionally skips processing.
- No paid Render service has been provisioned.
- Supabase/GitHub free-tier quotas and fair-use limits still apply.

## Current handler capabilities

The worker supports deterministic analysis of supplied payloads:

1. `config_audit`: configuration text checks.
2. `topology_discovery`: supplied topology graph validation/summary, not live discovery.
3. `troubleshooting`: evidence-based candidate diagnostics from supplied output.
4. `bulk_automation`: vendor-specific configuration plan generation in dry-run only.
5. `network_report`: supplied inventory and interface status aggregation.
6. `snmp_poll`: analysis of supplied SNMP varbinds and unknown OIDs, not live polling.

No handler connects to a switch, executes CLI commands, polls SNMP, or changes
production configuration. Real network operations require separate secure
credential storage, explicit approval, device-specific integration tests,
audit logging, and an isolated execution environment.

## Activation checklist

1. Add the two GitHub Actions repository secrets listed above.
2. Open Actions → NetCmd Free Queue Worker → Run workflow for a controlled test.
3. Submit one test job using a valid authenticated PRO account and verify its
   terminal status and result.
4. Monitor Actions minutes and Supabase usage before increasing worker cadence
   or job limits.
5. Complete payment reconciliation and product usage metering before public
   commercial launch.
