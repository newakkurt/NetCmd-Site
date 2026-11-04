# NetCmd zero-extra-hosting-cost deployment path

This branch does not provision a new Render API or background worker. The existing NetCmd static site remains untouched.

## Free-tier architecture (within provider quotas)

- Frontend: existing Render Static Site.
- Authentication and database: existing Supabase project.
- Job execution: GitHub Actions runner, one job per workflow invocation.
- Queue: additive SQL in `supabase/saas_core.sql`; it has not been applied to production.
- API ingress: `supabase/functions/netcmd-jobs/index.ts` provides authenticated job submission and owner-scoped status lookup.
- Python handler: `services/worker/worker.py`, with an allow-list and no arbitrary shell/Python execution.

## Required setup before enabling the queue

After reviewing and applying the additive SQL migration, add these repository Actions secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Never put the service-role key in frontend files, commits, issue comments, or chat. The workflow is configured for one-shot processing and at most one queued job per run. Scheduled workflows run from the repository default branch; the cron schedule becomes active only after this workflow is merged to the default branch. Manual dispatch can be used for controlled testing on the feature branch.

## Rollout gates

1. No production SQL has been applied by this branch.
2. No GitHub secrets have been created or changed.
3. The Edge Function is source-only until deployed; deployment requires the reviewed SQL migration and function secrets.
4. Only `config_audit` is implemented; other job kinds fail closed.
5. GitHub and Supabase free tiers have quotas and fair-use limits. Monitor usage and never upgrade or enable paid resources automatically.
6. Existing Buy Me a Coffee membership and webhook logic is not changed by this free worker path.
