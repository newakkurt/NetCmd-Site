# NetCmd Cloud API (foundation)

This service is additive. The existing static site generator and current Supabase
Edge Functions remain unchanged.

## Endpoints

- `GET /health`: liveness check.
- `GET /v1/me`: validates a Supabase Auth access token using the project's JWKS.
- `POST /v1/api-keys`: creates an API key; the raw key is returned once and only
  an HMAC-SHA256 digest is stored.
- `DELETE /v1/api-keys/{id}`: revokes a key belonging to the authenticated user.
- `POST /v1/jobs`: accepts an allow-listed job into the database queue.
- `GET /v1/jobs/{id}`: reads only a job owned by the API-key owner.

**Important:** job submission is not job execution. A separate isolated worker,
quotas, and per-job authorization must be deployed and tested before advertising
cloud automation as available. No user-supplied shell, Python, or Ansible text is
executed by this API.

## Environment

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side secret only; never expose to browser)
- `NETCMD_API_KEY_PEPPER` (long random secret; keep stable or all issued keys stop working)
- `ALLOWED_ORIGINS` (comma-separated exact origins)

Apply `supabase/saas_core.sql` to the NetCmd Supabase project before enabling
this service. Use a separate Render web service with Docker runtime and a
private/internal URL if the frontend does not need direct public access.

## Local

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Security boundaries

- JWT validation is signature-, issuer-, audience-, and expiry-checked.
- API keys are high-entropy, HMAC-digested, scope-limited, and revocable.
- The service role key is read only from server environment variables.
- Database tables have RLS enabled and no client-role grants.
- Job types are allow-listed; payload size is capped.
- Production deployment still needs request rate limiting, usage accounting,
  worker isolation, secrets encryption for device credentials, and audit review.
