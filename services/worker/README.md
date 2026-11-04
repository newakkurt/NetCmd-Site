# NetCmd Cloud Worker

This is a queue consumer backed by Supabase Postgres RPCs. It uses atomic
`FOR UPDATE SKIP LOCKED` job claiming, so multiple workers cannot claim the
same queued job.

The initial safe handler supports `config_audit` on supplied configuration text.
Other job kinds are deliberately marked failed until their isolated handlers,
credential storage, vendor-specific tests, and explicit change approvals exist.
The worker never executes user-provided shell/Python, never makes SSH sessions,
and never changes network devices.

Required environment:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- optional `POLL_SECONDS` (default 5)

Apply `supabase/saas_core.sql` before deploying. See root `render.yaml` for
the API and worker service definitions. The worker is a paid Render Starter
service; review the current dashboard quote before Blueprint sync.
