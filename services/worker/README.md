# NetCmd Cloud Worker

This queue consumer uses Supabase Postgres RPCs and atomic
`FOR UPDATE SKIP LOCKED` job claiming, so concurrent workers cannot claim
the same queued job.

## Zero-cost deployment option

The repository includes a GitHub Actions workflow at
`.github/workflows/netcmd-worker.yml`. It runs every 15 minutes, can also be
started manually, and processes up to 20 queued jobs per run. This avoids
creating a paid Render background worker. Private repositories consume the
account's included GitHub Actions minutes; public repositories use the
standard hosted runner without per-minute charges, subject to GitHub limits.

Add these repository Actions secrets to enable it:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side secret; never expose in browser code)

The workflow safely skips processing until both secrets exist.

## Supported job handlers

The initial handler supports `config_audit` on supplied configuration text.
Other job kinds are deliberately marked failed until their isolated handlers,
credential storage, vendor-specific tests, and explicit change approvals exist.
The worker never executes user-provided shell/Python, never makes SSH sessions,
and never changes network devices.

The worker is capped at 20 jobs per scheduled run by default. Override
`NETCMD_MAX_JOBS_PER_RUN` only after testing runtime and quota usage.

Apply `supabase/saas_core.sql` through a reviewed migration before enabling
queue processing. The API hosting path is separate; the GitHub Actions worker
does not itself expose a public API endpoint.
