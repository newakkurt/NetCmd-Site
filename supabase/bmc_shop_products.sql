-- BMC Shop one-time product entitlements. Separate from the monthly PRO membership.
create table if not exists public.netcmd_product_entitlements (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_slug text not null check (product_slug in (
    'config-auditor-pro',
    'topology-discovery-pro',
    'troubleshooting-pro',
    'bulk-automation-pro',
    'network-intelligence-reports-pro'
  )),
  bmc_order_id bigint not null,
  supporter_email text not null,
  active boolean not null default true,
  last_event_created bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bmc_order_id, product_slug)
);
create index if not exists netcmd_product_entitlements_user_idx
  on public.netcmd_product_entitlements(user_id, active);

alter table public.netcmd_product_entitlements enable row level security;
revoke all on public.netcmd_product_entitlements from anon, authenticated;
grant select on public.netcmd_product_entitlements to authenticated;
create policy "users_read_own_product_entitlements"
  on public.netcmd_product_entitlements for select
  to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.bmc_shop_webhook_events (
  event_id text not null,
  product_slug text not null,
  processed_at timestamptz not null default now(),
  primary key (event_id, product_slug)
);
alter table public.bmc_shop_webhook_events enable row level security;
revoke all on public.bmc_shop_webhook_events from anon, authenticated;

create or replace function public.apply_bmc_shop_entitlement(
  p_event_id text,
  p_event_created bigint,
  p_order_id bigint,
  p_product_slug text,
  p_supporter_email text,
  p_active boolean
) returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_inserted text;
begin
  if p_product_slug not in (
    'config-auditor-pro',
    'topology-discovery-pro',
    'troubleshooting-pro',
    'bulk-automation-pro',
    'network-intelligence-reports-pro'
  ) then
    return 'invalid_product';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_supporter_email))
  limit 1;

  if v_user_id is null then
    return 'netcmd_account_email_not_found';
  end if;

  insert into public.bmc_shop_webhook_events(event_id, product_slug)
  values (p_event_id, p_product_slug)
  on conflict do nothing
  returning event_id into v_inserted;

  if v_inserted is null then
    return 'duplicate';
  end if;

  insert into public.netcmd_product_entitlements(
    user_id, product_slug, bmc_order_id, supporter_email,
    active, last_event_created, updated_at
  ) values (
    v_user_id, p_product_slug, p_order_id, lower(trim(p_supporter_email)),
    p_active, p_event_created, now()
  )
  on conflict (bmc_order_id, product_slug) do update set
    user_id = excluded.user_id,
    supporter_email = excluded.supporter_email,
    active = excluded.active,
    last_event_created = excluded.last_event_created,
    updated_at = now()
  where excluded.last_event_created >= public.netcmd_product_entitlements.last_event_created;

  return 'processed';
end;
$$;

revoke all on function public.apply_bmc_shop_entitlement(text, bigint, bigint, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_bmc_shop_entitlement(text, bigint, bigint, text, text, boolean)
  to service_role;
