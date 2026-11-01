-- Buy Me a Coffee membership -> NetCmd PRO entitlement.
-- Only the configured PRO membership level grants access. Webhook events are idempotent.

create table if not exists public.bmc_memberships (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bmc_membership_id bigint not null unique,
  supporter_id bigint,
  supporter_email text not null,
  membership_level_id bigint not null,
  membership_level_name text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  paused boolean not null default false,
  last_event_created bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bmc_memberships_user_id_idx on public.bmc_memberships(user_id);

create table if not exists public.bmc_webhook_events (
  event_id text primary key,
  event_type text not null,
  event_created bigint not null,
  processed_at timestamptz not null default now()
);

alter table public.bmc_memberships enable row level security;
alter table public.bmc_webhook_events enable row level security;
revoke all on public.bmc_memberships from anon, authenticated;
revoke all on public.bmc_webhook_events from anon, authenticated;

create or replace function public.apply_bmc_membership_event(
  p_event_id text,
  p_event_type text,
  p_event_created bigint,
  p_membership_id bigint,
  p_supporter_id bigint,
  p_supporter_email text,
  p_membership_level_id bigint,
  p_membership_level_name text,
  p_status text,
  p_current_period_end bigint,
  p_cancel_at_period_end boolean,
  p_paused boolean,
  p_expected_level_id bigint
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_inserted text;
  v_period_end timestamptz;
  v_premium boolean;
begin
  if p_membership_level_id is distinct from p_expected_level_id then
    return 'ignored_membership_level';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_supporter_email))
  limit 1;

  if v_user_id is null then
    return 'netcmd_account_email_not_found';
  end if;

  insert into public.bmc_webhook_events(event_id, event_type, event_created)
  values (p_event_id, p_event_type, p_event_created)
  on conflict (event_id) do nothing
  returning event_id into v_inserted;

  if v_inserted is null then
    return 'duplicate';
  end if;

  v_period_end := case when p_current_period_end is null then null
    else to_timestamp(p_current_period_end) end;

  insert into public.bmc_memberships(
    user_id, bmc_membership_id, supporter_id, supporter_email,
    membership_level_id, membership_level_name, status,
    current_period_end, cancel_at_period_end, paused, last_event_created, updated_at
  ) values (
    v_user_id, p_membership_id, p_supporter_id, lower(trim(p_supporter_email)),
    p_membership_level_id, p_membership_level_name, p_status,
    v_period_end, p_cancel_at_period_end, p_paused, p_event_created, now()
  )
  on conflict (bmc_membership_id) do update set
    user_id = excluded.user_id,
    supporter_id = excluded.supporter_id,
    supporter_email = excluded.supporter_email,
    membership_level_id = excluded.membership_level_id,
    membership_level_name = excluded.membership_level_name,
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    paused = excluded.paused,
    last_event_created = excluded.last_event_created,
    updated_at = now()
  where excluded.last_event_created >= public.bmc_memberships.last_event_created;

  select
    ((status = 'active' and not paused)
    or (status = 'canceled' and cancel_at_period_end and current_period_end > now())),
    current_period_end
  into v_premium, v_period_end
  from public.bmc_memberships
  where bmc_membership_id = p_membership_id and user_id = v_user_id;

  insert into public.profiles(id, is_premium, premium_until)
  values (v_user_id, coalesce(v_premium, false), v_period_end)
  on conflict (id) do update set
    is_premium = excluded.is_premium,
    premium_until = excluded.premium_until;

  return 'processed';
end;
$$;

revoke all on function public.apply_bmc_membership_event(
  text, text, bigint, bigint, bigint, text, bigint, text, text, bigint, boolean, boolean, bigint
) from public, anon, authenticated;
grant execute on function public.apply_bmc_membership_event(
  text, text, bigint, bigint, bigint, text, bigint, text, text, bigint, boolean, boolean, bigint
) to service_role;
