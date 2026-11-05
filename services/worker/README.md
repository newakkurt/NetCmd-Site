# NetCmd Cloud Worker

The queue worker claims jobs atomically through Supabase Postgres RPCs using
`FOR UPDATE SKIP LOCKED`. It runs as a short-lived GitHub Actions job.

## Free-tier deployment

The active workflow is
`.github/workflows/netcmd-free-worker.yml`. It is scheduled every 15 minutes,
can be dispatched manually from GitHub Actions, and processes at most 20 jobs
per invocation. It does not require a paid Render Worker.

Configure these repository secrets under GitHub → Settings → Secrets and
variables → Actions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The workflow safely skips processing until both exist. Never put the service
role key in browser code, source files, issues, or chat. Free-tier quotas and
fair-use limits apply.

## Implemented safe handlers

All handlers work only on data supplied in the job payload. The worker does
not scan networks, open SSH/SNMP sessions, execute arbitrary shell/Python,
or apply configuration to devices.

- `config_audit`: deterministic checks on supplied configuration text.
- `topology_discovery`: validates and summarizes a supplied nodes/links graph;
  this is not live network discovery.
- `troubleshooting`: matches supplied symptoms and command output against
  initial diagnostic rules; results are hypotheses for human verification.
- `bulk_automation`: creates a vendor-specific configuration plan in
  mandatory dry-run mode; shutdown plans require an approval reference. It
  never executes commands.
- `network_report`: summarizes supplied device/interface inventory.
- `snmp_poll`: classifies supplied SNMP varbinds and flags unknown OIDs; it
  does not poll devices.

## Safety limits

- Job payloads are validated and bounded.
- Bulk configuration generation is dry-run only.
- No network device credentials are accepted or used by these handlers.
- No device changes occur. A separate credential vault, live polling design,
  approval workflow, and isolated execution environment are required before
  any real network operations are introduced.
- The workflow processes up to 20 jobs per scheduled run by default.
