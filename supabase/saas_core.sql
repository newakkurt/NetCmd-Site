-- NetCmd SaaS foundation. Apply only after reviewing the matching app release.
-- All tables are backend-only: RLS enabled and no anon/authenticated grants.

create table if not exists public.netcmd_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 80),
  key_prefix text not null,
  key_hash text not null unique check (char_length(key_hash) = 64),
  scopes text[] not null default array['jobs:read','jobs:write']::text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists netcmd_api_keys_user_idx
  on public.netcmd_api_keys(user_id, created_at desc);

create table if not exists public.netcmd_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid references public.netcmd_api_keys(id) on delete set null,
  request_id text check (request_id is null or char_length(request_id) <= 80),
  product_slug text not null check (product_slug in (
    'config-auditor-pro','topology-discovery-pro','troubleshooting-pro',
    'bulk-automation-pro','network-intelligence-reports-pro'
  )),
  job_kind text not null check (job_kind in (
    'config_audit','topology_discovery','troubleshooting',
    'bulk_automation','network_report','snmp_poll'
  )),
  status text not null default 'queued' check (status in (
    'queued','running','succeeded','failed','cancelled'
  )),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists netcmd_jobs_user_created_idx
  on public.netcmd_automation_jobs(user_id, created_at desc);
create index if not exists netcmd_jobs_queue_idx
  on public.netcmd_automation_jobs(status, created_at)
  where status = 'queued';
create unique index if not exists netcmd_jobs_request_id_unique
  on public.netcmd_automation_jobs(user_id, request_id)
  where request_id is not null;

create table if not exists public.netcmd_api_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid references public.netcmd_api_keys(id) on delete set null,
  route text not null check (char_length(route) <= 160),
  status_code integer not null check (status_code between 100 and 599),
  created_at timestamptz not null default now()
);
create index if not exists netcmd_api_usage_user_created_idx
  on public.netcmd_api_usage(user_id, created_at desc);

alter table public.netcmd_api_keys enable row level security;
alter table public.netcmd_automation_jobs enable row level security;
alter table public.netcmd_api_usage enable row level security;

revoke all on public.netcmd_api_keys from anon, authenticated;
revoke all on public.netcmd_automation_jobs from anon, authenticated;
revoke all on public.netcmd_api_usage from anon, authenticated;
grant all on public.netcmd_api_keys to service_role;
grant all on public.netcmd_automation_jobs to service_role;
grant all on public.netcmd_api_usage to service_role;

comment on table public.netcmd_api_keys is
  'Backend-only API key registry. Store HMAC-SHA256 digests, never raw API keys.';
comment on table public.netcmd_automation_jobs is
  'Backend-only job queue. A separately isolated worker must claim and execute allow-listed job kinds.';
comment on table public.netcmd_api_usage is
  'Backend-only API usage audit trail; apply quotas/rate limits at the API gateway or worker layer.';


-- Atomic queue claim: only service_role may claim jobs; SKIP LOCKED prevents
-- two workers from processing the same queued row.
create or replace function public.netcmd_claim_job()
returns setof public.netcmd_automation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_job as (
    select id
    from public.netcmd_automation_jobs
    where status = 'queued'
    order by created_at
    for update skip locked
    limit 1
  )
  update public.netcmd_automation_jobs j
     set status = 'running', started_at = now(), updated_at = now()
    from next_job
   where j.id = next_job.id
  returning j.*;
end;
$$;

create or replace function public.netcmd_finish_job(
  p_job_id uuid,
  p_status text,
  p_result jsonb default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('succeeded','failed','cancelled') then
    raise exception 'invalid terminal status';
  end if;
  update public.netcmd_automation_jobs
     set status = p_status,
         result = p_result,
         error = left(p_error, 1000),
         finished_at = now(),
         updated_at = now()
   where id = p_job_id and status = 'running';
  return found;
end;
$$;

revoke all on function public.netcmd_claim_job() from public, anon, authenticated;
revoke all on function public.netcmd_finish_job(uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.netcmd_claim_job() to service_role;
grant execute on function public.netcmd_finish_job(uuid,text,jsonb,text) to service_role;
