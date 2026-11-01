-- Paddle Billing monthly subscriptions for NetCmd PRO.
-- Webhook events are recorded once and applied transactionally via RPC.

create table if not exists public.paddle_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  status text not null,
  current_period_ends_at timestamptz,
  scheduled_change jsonb,
  last_event_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paddle_subscriptions_user_id_idx
  on public.paddle_subscriptions(user_id);

create table if not exists public.paddle_webhook_events (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  processed_at timestamptz not null default now()
);

alter table public.paddle_subscriptions enable row level security;
alter table public.paddle_webhook_events enable row level security;
revoke all on public.paddle_subscriptions from anon, authenticated;
revoke all on public.paddle_webhook_events from anon, authenticated;

create or replace function public.apply_paddle_subscription_event(
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_user_id uuid,
  p_subscription_id text,
  p_customer_id text,
  p_status text,
  p_period_ends_at timestamptz,
  p_scheduled_change jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_inserted text;
  v_status text;
  v_period_end timestamptz;
begin
  insert into public.paddle_webhook_events(event_id, event_type, occurred_at)
  values (p_event_id, p_event_type, p_occurred_at)
  on conflict (event_id) do nothing
  returning event_id into v_inserted;

  if v_inserted is null then
    return 'duplicate';
  end if;

  v_user_id := p_user_id;
  if v_user_id is null then
    select user_id into v_user_id
    from public.paddle_subscriptions
    where paddle_subscription_id = p_subscription_id;
  end if;

  if v_user_id is null then
    raise exception 'No NetCmd user mapped to Paddle subscription %', p_subscription_id;
  end if;

  insert into public.paddle_subscriptions(
    user_id, paddle_subscription_id, paddle_customer_id, status,
    current_period_ends_at, scheduled_change, last_event_at, updated_at
  )
  values (
    v_user_id, p_subscription_id, p_customer_id, p_status,
    p_period_ends_at, p_scheduled_change, p_occurred_at, now()
  )
  on conflict (paddle_subscription_id) do update set
    user_id = excluded.user_id,
    paddle_customer_id = excluded.paddle_customer_id,
    status = excluded.status,
    current_period_ends_at = excluded.current_period_ends_at,
    scheduled_change = excluded.scheduled_change,
    last_event_at = excluded.last_event_at,
    updated_at = now()
  where excluded.last_event_at >= public.paddle_subscriptions.last_event_at;

  select status, current_period_ends_at
    into v_status, v_period_end
  from public.paddle_subscriptions
  where paddle_subscription_id = p_subscription_id;

  insert into public.profiles(id, is_premium, premium_until)
  values (
    v_user_id,
    v_status in ('active', 'trialing') and (v_period_end is null or v_period_end > now()),
    v_period_end
  )
  on conflict (id) do update set
    is_premium = excluded.is_premium,
    premium_until = excluded.premium_until;

  return 'processed';
end;
$$;

revoke all on function public.apply_paddle_subscription_event(
  text, text, timestamptz, uuid, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_paddle_subscription_event(
  text, text, timestamptz, uuid, text, text, text, timestamptz, jsonb
) to service_role;
